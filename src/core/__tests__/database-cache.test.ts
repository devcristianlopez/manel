/**
 * Tests for src/core/database/cache
 *
 * Tests the SQLite-backed cache for version and vulnerability data.
 * Uses in-memory SQLite for isolation.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initDatabase, closeDatabase, getDatabase } from '../database'
import {
  getCachedVersion,
  setCachedVersion,
  clearExpiredVersions,
  getCachedVulnerabilities,
  setCachedVulnerabilities,
  clearExpiredVulnerabilities,
} from '../database/cache'
import type { CoreVulnerability } from '../types'

describe('Database Cache', () => {
  beforeAll(() => {
    // Use in-memory SQLite for testing
    initDatabase(':memory:')
  })

  afterAll(() => {
    closeDatabase()
  })

  beforeEach(() => {
    // Clear all cache tables between tests
    const db = getDatabase()
    db.exec('DELETE FROM version_cache')
    db.exec('DELETE FROM vulnerability_cache')
  })

  describe('Version Cache', () => {
    it('should store and retrieve a version', () => {
      setCachedVersion('node', '22.0.0')
      const result = getCachedVersion('node')
      expect(result).toBe('22.0.0')
    })

    it('should return null for missing key', () => {
      const result = getCachedVersion('nonexistent')
      expect(result).toBeNull()
    })

    it('should overwrite existing version', () => {
      setCachedVersion('npm', '10.8.0')
      setCachedVersion('npm', '10.9.0')
      const result = getCachedVersion('npm')
      expect(result).toBe('10.9.0')
    })

    it('should store multiple technologies', () => {
      setCachedVersion('node', '22.0.0')
      setCachedVersion('npm', '10.9.0')
      setCachedVersion('git', '2.47.0')
      expect(getCachedVersion('node')).toBe('22.0.0')
      expect(getCachedVersion('npm')).toBe('10.9.0')
      expect(getCachedVersion('git')).toBe('2.47.0')
    })

    it('should clear expired entries', () => {
      // Manually insert an expired entry
      const db = getDatabase()
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
      db.prepare(
        'INSERT OR REPLACE INTO version_cache (tech_name, latest_version, fetched_at) VALUES (?, ?, ?)'
      ).run('old-tech', '1.0.0', oldTimestamp)

      // Insert a fresh entry
      setCachedVersion('new-tech', '2.0.0')

      clearExpiredVersions()

      expect(getCachedVersion('old-tech')).toBeNull()
      expect(getCachedVersion('new-tech')).toBe('2.0.0')
    })
  })

  describe('Vulnerability Cache', () => {
    const mockVulnerabilities: CoreVulnerability[] = [
      {
        cve: 'CVE-2024-0001',
        severity: 'HIGH',
        description: 'Test vulnerability',
        softwareId: '',
        fixedVersion: '2.0.0',
        source: 'OSV',
      },
      {
        cve: 'CVE-2024-0002',
        severity: 'MEDIUM',
        description: 'Another vulnerability',
        softwareId: '',
        fixedVersion: '',
        source: 'NVD',
      },
    ]

    it('should store and retrieve vulnerabilities', () => {
      setCachedVulnerabilities('npm:lodash:4.17.21', mockVulnerabilities)
      const result = getCachedVulnerabilities('npm:lodash:4.17.21')
      expect(result).toHaveLength(2)
      expect(result![0].cve).toBe('CVE-2024-0001')
      expect(result![1].cve).toBe('CVE-2024-0002')
    })

    it('should return null for missing key', () => {
      const result = getCachedVulnerabilities('nonexistent')
      expect(result).toBeNull()
    })

    it('should handle empty vulnerability array', () => {
      setCachedVulnerabilities('npm:safe:1.0.0', [])
      const result = getCachedVulnerabilities('npm:safe:1.0.0')
      expect(result).toEqual([])
    })

    it('should overwrite existing vulnerabilities', () => {
      const single = [mockVulnerabilities[0]]
      setCachedVulnerabilities('npm:test:1.0.0', single)
      setCachedVulnerabilities('npm:test:1.0.0', mockVulnerabilities)
      const result = getCachedVulnerabilities('npm:test:1.0.0')
      expect(result).toHaveLength(2)
    })

    it('should store different packages separately', () => {
      setCachedVulnerabilities('npm:lodash:4.17.21', [mockVulnerabilities[0]])
      setCachedVulnerabilities('npm:express:4.18.0', [mockVulnerabilities[1]])
      expect(getCachedVulnerabilities('npm:lodash:4.17.21')).toHaveLength(1)
      expect(getCachedVulnerabilities('npm:express:4.18.0')).toHaveLength(1)
    })

    it('should preserve severity levels through serialization', () => {
      const vuln: CoreVulnerability = {
        cve: 'CVE-2024-9999',
        severity: 'CRITICAL',
        description: 'Critical vuln with special chars: <>&"\'',
        softwareId: '',
        fixedVersion: '1.2.3-beta+build.123',
        source: 'GHSA',
      }
      setCachedVulnerabilities('npm:pkg:1.0.0', [vuln])
      const result = getCachedVulnerabilities('npm:pkg:1.0.0')
      expect(result![0].severity).toBe('CRITICAL')
      expect(result![0].description).toContain('<>&"\'')
      expect(result![0].fixedVersion).toBe('1.2.3-beta+build.123')
    })

    it('should clear expired entries', () => {
      // Manually insert an expired entry
      const db = getDatabase()
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
      db.prepare(
        'INSERT OR REPLACE INTO vulnerability_cache (cache_key, data, fetched_at) VALUES (?, ?, ?)'
      ).run('old:key', JSON.stringify(mockVulnerabilities), oldTimestamp)

      // Insert a fresh entry
      setCachedVulnerabilities('fresh:key', [mockVulnerabilities[0]])

      clearExpiredVulnerabilities()

      expect(getCachedVulnerabilities('old:key')).toBeNull()
      expect(getCachedVulnerabilities('fresh:key')).toHaveLength(1)
    })
  })
})
