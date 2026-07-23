/**
 * Tests for src/cli/output/table-formatter
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { formatTable } from '../table-formatter'
import {
  SCAN_RESULT,
  TECHNOLOGIES,
  VULNERABILITIES,
  HARDENING_RESULTS,
  SCORE,
  UPDATE_INFOS,
  makeScanResult,
  makeScore,
  makeHardeningResult,
} from './fixtures'
import type {
  OutputScanResult,
  OutputVulnerability,
  OutputHardeningResult,
  OutputSecurityScore,
} from '../types'
import type { UpdateInfo } from '@shared/types'

describe('Table Formatter', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.FORCE_COLOR
    delete process.env.NO_COLOR
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('formatTable — ScanResult', () => {
    it('should format a complete scan result', () => {
      const output = formatTable(SCAN_RESULT, { color: false })
      expect(output).toContain('Technologies')
      expect(output).toContain('node')
      expect(output).toContain('python')
      expect(output).toContain('18.0.0')
    })

    it('should include summary section', () => {
      const output = formatTable(SCAN_RESULT, { color: false })
      expect(output).toContain('Summary')
      expect(output).toContain('72/100')
      expect(output).toContain('3/4 detected')
    })

    it('should include vulnerabilities when present', () => {
      const output = formatTable(SCAN_RESULT, { color: false })
      expect(output).toContain('Vulnerabilities')
      expect(output).toContain('CRITICAL')
      expect(output).toContain('lodash')
    })

    it('should include hardening when present', () => {
      const output = formatTable(SCAN_RESULT, { color: false })
      expect(output).toContain('Hardening Checks')
    })

    it('should use Unicode borders for TTY', () => {
      const output = formatTable(SCAN_RESULT, { color: false, isTTY: true })
      expect(output).toContain('┌')
      expect(output).toContain('─')
      expect(output).toContain('┐')
    })

    it('should use ASCII borders for non-TTY', () => {
      const output = formatTable(SCAN_RESULT, { color: false, isTTY: false })
      expect(output).toContain('+')
      expect(output).toContain('-')
    })

    it('should handle scan with no vulnerabilities or hardening', () => {
      const cleanScan = makeScanResult({
        vulnerabilities: [],
        hardening: [],
        summary: {
          totalTechnologies: 2,
          detectedTechnologies: 2,
          totalVulnerabilities: 0,
          criticalVulnerabilities: 0,
          highVulnerabilities: 0,
          hardeningPassRate: 100,
        },
      })
      const output = formatTable(cleanScan, { color: false })
      expect(output).toContain('Technologies')
      // Should not contain a separate "Vulnerabilities" table header
      const vulnTableIdx = output.indexOf('Vulnerabilities\n+')
      expect(vulnTableIdx).toBe(-1)
    })

    it('should handle technologies with null version', () => {
      const scan = makeScanResult({
        technologies: [{ name: 'rust', version: null, detected: false, ecosystem: 'unknown' }],
      })
      const output = formatTable(scan, { color: false })
      expect(output).toContain('unknown')
    })
  })

  describe('formatTable — Vulnerability[]', () => {
    it('should format vulnerability array', () => {
      const output = formatTable(VULNERABILITIES, { color: false })
      expect(output).toContain('Vulnerabilities')
      expect(output).toContain('CRITICAL')
      expect(output).toContain('lodash')
      expect(output).toContain('CVE-2024-0001')
    })

    it('should sort by severity (critical first)', () => {
      const output = formatTable(VULNERABILITIES, { color: false })
      const lines = output.split('\n')
      const critIdx = lines.findIndex(l => l.includes('CRITICAL'))
      const lowIdx = lines.findIndex(l => l.includes('LOW'))
      expect(critIdx).toBeLessThan(lowIdx)
    })

    it('should show "n/a" for vulnerabilities without fix', () => {
      const vulns: OutputVulnerability[] = [
        {
          id: 'NO-FIX',
          source: 'NVD',
          severity: 'HIGH',
          title: 'No Fix Available',
          description: '',
          affectedPackage: 'pkg',
          affectedVersions: '<1.0.0',
          references: [],
        },
      ]
      const output = formatTable(vulns, { color: false })
      expect(output).toContain('n/a')
    })
  })

  describe('formatTable — HardeningResult[]', () => {
    it('should format hardening results', () => {
      const output = formatTable(HARDENING_RESULTS, { color: false })
      expect(output).toContain('Hardening Checks')
      expect(output).toContain('Firewall is active')
      expect(output).toContain('SSH root login disabled')
    })

    it('should sort failures first', () => {
      const output = formatTable(HARDENING_RESULTS, { color: false })
      const lines = output.split('\n')
      const failIdx = lines.findIndex(l => l.includes('fail'))
      const passIdx = lines.findIndex(l => l.includes('pass'))
      // Fail should appear before pass (after header separator)
      expect(failIdx).toBeLessThan(passIdx)
    })

    it('should show check icons', () => {
      const output = formatTable(HARDENING_RESULTS, { color: false })
      expect(output).toContain('✓') // pass
      expect(output).toContain('✗') // fail
      expect(output).toContain('⚠') // warning
    })
  })

  describe('formatTable — SecurityScore', () => {
    it('should format score with visual bars', () => {
      const output = formatTable(SCORE, { color: false })
      expect(output).toContain('Security Score')
      expect(output).toContain('72/100')
      expect(output).toContain('█')
      expect(output).toContain('░')
    })

    it('should show all breakdown categories', () => {
      const output = formatTable(SCORE, { color: false })
      expect(output).toContain('OS')
      expect(output).toContain('Hardening')
      expect(output).toContain('Tools')
      expect(output).toContain('Dependencies')
      expect(output).toContain('Databases')
    })

    it('should show score percentages', () => {
      const output = formatTable(SCORE, { color: false })
      expect(output).toContain('80%')
      expect(output).toContain('60%')
    })
  })

  describe('formatTable — UpdateInfo[]', () => {
    it('should format update info', () => {
      const output = formatTable(UPDATE_INFOS, { color: false })
      expect(output).toContain('Available Updates')
      expect(output).toContain('node')
      expect(output).toContain('20.0.0')
    })

    it('should list up-to-date technologies', () => {
      const output = formatTable(UPDATE_INFOS, { color: false })
      expect(output).toContain('Up to date')
      expect(output).toContain('python')
    })

    it('should handle all up-to-date', () => {
      const allUpdated: UpdateInfo[] = [
        { technology: 'node', currentVersion: '20.0.0', latestVersion: '20.0.0', updateAvailable: false, source: 'test' },
      ]
      const output = formatTable(allUpdated, { color: false })
      expect(output).toContain('Up to date')
      expect(output).not.toContain('Available Updates')
    })
  })

  describe('formatTable — edge cases', () => {
    it('should return empty string for empty array', () => {
      const output = formatTable([], { color: false })
      expect(output).toBe('')
    })

    it('should handle unsupported data type', () => {
      const output = formatTable('unsupported' as unknown as OutputScanResult, { color: false })
      expect(output).toContain('Unsupported')
    })
  })

  describe('formatTable — color mode', () => {
    it('should include ANSI codes when color is true', () => {
      const output = formatTable(SCORE, { color: true })
      expect(output).toContain('\x1b[')
    })

    it('should not include ANSI codes when color is false', () => {
      const output = formatTable(SCORE, { color: false })
      expect(output).not.toContain('\x1b[')
    })
  })
})
