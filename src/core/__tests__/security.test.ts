/**
 * Tests for src/core/security/security-engine
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock child_process for hardening module
vi.mock('child_process', () => {
  const mockExecSync = vi.fn()
  return {
    default: { execSync: mockExecSync },
    execSync: mockExecSync,
  }
})

import { execSync } from 'child_process'
import { analyzeTechnology, analyzeAllTechnologies } from '../security/security-engine'
import { runHardeningChecks } from '../security/hardening'
import { VulnerabilityCache } from '../security/cache'
import { SOFTWARE_ECOSYSTEM_MAP } from '../security/ecosystem-map'

const mockExecSync = execSync as ReturnType<typeof vi.fn>

const originalFetch = globalThis.fetch

function mockFetch(data: unknown, status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => data,
  })
}

function mockFetchError() {
  globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
}

describe('Core Security Engine', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('analyzeTechnology', () => {
    it('should return green status when no vulnerabilities and up-to-date', async () => {
      mockFetch({ vulns: [] })
      const result = await analyzeTechnology('npm', '10.9.0', 'sw-1', {
        getLatestVersion: async () => '10.9.0',
      })
      expect(result.status).toBe('green')
      expect(result.name).toBe('npm')
      expect(result.installedVersion).toBe('10.9.0')
      expect(result.latestVersion).toBe('10.9.0')
      expect(result.vulnerabilities).toHaveLength(0)
    })

    it('should handle unknown technology (no ecosystem)', async () => {
      const result = await analyzeTechnology('unknown-tech', '1.0.0', 'sw-1')
      expect(result.status).toBe('green')
      expect(result.vulnerabilities).toHaveLength(0)
    })

    it('should call getLatestVersion when provided', async () => {
      mockFetch({ vulns: [] })
      const getLatest = vi.fn().mockResolvedValue('2.0.0')
      const result = await analyzeTechnology('npm', '1.0.0', 'sw-1', {
        getLatestVersion: getLatest,
      })
      expect(getLatest).toHaveBeenCalledWith('npm')
      expect(result.latestVersion).toBe('2.0.0')
    })

    it('should call saveVulnerabilities when vulns found', async () => {
      mockFetch({
        vulns: [{
          id: 'GHSA-1',
          aliases: ['CVE-2024-0001'],
          summary: 'Test vuln',
          severity: [{ type: 'CVSS_V3', score: '9.8' }],
        }],
      })
      const saveVulns = vi.fn().mockImplementation((vulns) => vulns)
      const result = await analyzeTechnology('npm', '1.0.0', 'sw-1', {
        saveVulnerabilities: saveVulns,
      })
      expect(saveVulns).toHaveBeenCalled()
      expect(result.vulnerabilities.length).toBeGreaterThan(0)
    })

    it('should set black status for critical vuln with exploit keywords', async () => {
      mockFetch({
        vulns: [{
          id: 'GHSA-1',
          aliases: ['CVE-2024-0001'],
          summary: 'Remote code execution vulnerability',
          severity: [{ type: 'CVSS_V3', score: '9.8' }],
        }],
      })
      const result = await analyzeTechnology('npm', '1.0.0', 'sw-1')
      expect(result.status).toBe('black')
      expect(result.recommendation).toContain('CRÍTICO')
    })

    it('should handle getLatestVersion error gracefully', async () => {
      mockFetch({ vulns: [] })
      const result = await analyzeTechnology('npm', '1.0.0', 'sw-1', {
        getLatestVersion: async () => { throw new Error('timeout') },
      })
      expect(result.status).toBe('green')
    })
  })

  describe('analyzeAllTechnologies', () => {
    it('should analyze multiple technologies', async () => {
      mockFetch({ vulns: [] })
      const results = await analyzeAllTechnologies([
        { name: 'npm', version: '10.9.0', id: 'sw-1' },
        { name: 'node', version: '22.0.0', id: 'sw-2' },
      ], {
        getLatestVersion: async () => null,
      })
      expect(results).toHaveLength(2)
    })

    it('should skip failed analyses', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('fail'))
      const results = await analyzeAllTechnologies([
        { name: 'npm', version: '10.9.0', id: 'sw-1' },
        { name: 'unknown-tech', version: '1.0.0', id: 'sw-2' },
      ])
      // unknown-tech should still succeed (no ecosystem = no vuln query)
      expect(results.length).toBeGreaterThanOrEqual(1)
    })
  })
})

describe('Core Hardening Checks', () => {
  const originalPlatform = process.platform
  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  it('should return empty array on non-linux', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    const results = await runHardeningChecks()
    expect(results).toEqual([])
  })

  it('should run 7 checks on linux', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd === 'ufw status') return 'Status: active'
      if (cmd === 'getenforce') return 'Enforcing'
      if (cmd.includes('permitrootlogin')) return 'PermitRootLogin no'
      if (cmd.includes('passwordauthentication')) return 'PasswordAuthentication no'
      if (cmd === 'ss -tlnp') return 'LISTEN 0 128 0.0.0.0:22 0.0.0.0:*'
      if (cmd.includes('apt') && cmd.includes('upgradable')) return ''
      if (cmd.includes('suid_dumpable')) return 'fs.suid_dumpable = 0'
      return null
    })
    const results = await runHardeningChecks()
    expect(results).toHaveLength(7)
    expect(results.every(r => r.status === 'pass')).toBe(true)
  })
})

describe('Core Vulnerability Cache', () => {
  it('should cache and retrieve data', () => {
    const cache = new VulnerabilityCache()
    cache.set('key1', [{ cve: 'CVE-1', severity: 'HIGH', description: '', softwareId: '', fixedVersion: '', source: 'test' }])
    expect(cache.get('key1')).toHaveLength(1)
  })

  it('should return null for cache miss', () => {
    const cache = new VulnerabilityCache()
    expect(cache.get('missing')).toBeNull()
  })

  it('should clear all entries', () => {
    const cache = new VulnerabilityCache()
    cache.set('a', [])
    cache.set('b', [])
    expect(cache.size).toBe(2)
    cache.clear()
    expect(cache.size).toBe(0)
  })
})

describe('Core Ecosystem Map', () => {
  it('should have npm ecosystem for node', () => {
    expect(SOFTWARE_ECOSYSTEM_MAP.node).toBe('npm')
  })

  it('should have PyPI ecosystem for python', () => {
    expect(SOFTWARE_ECOSYSTEM_MAP.python).toBe('PyPI')
  })

  it('should have Maven ecosystem for java', () => {
    expect(SOFTWARE_ECOSYSTEM_MAP.java).toBe('Maven')
  })
})
