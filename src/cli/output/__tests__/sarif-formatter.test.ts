/**
 * Tests for src/cli/output/sarif-formatter
 */
import { describe, it, expect } from 'vitest'
import { formatSarif, formatSarifObject } from '../sarif-formatter'
import { SCAN_RESULT, makeScanResult, VULNERABILITIES } from './fixtures'
import type { SarifReport } from '@shared/types'

describe('SARIF Formatter', () => {
  describe('formatSarif', () => {
    it('should produce valid JSON', () => {
      const output = formatSarif(SCAN_RESULT)
      expect(() => JSON.parse(output)).not.toThrow()
    })

    it('should have SARIF version 2.1.0', () => {
      const output = formatSarif(SCAN_RESULT)
      const report: SarifReport = JSON.parse(output)

      expect(report.version).toBe('2.1.0')
    })

    it('should include $schema URI', () => {
      const report = formatSarifObject(SCAN_RESULT)
      expect(report.$schema).toContain('sarif-schema')
    })

    it('should include tool metadata', () => {
      const report = formatSarifObject(SCAN_RESULT, { version: '0.1.0' })

      expect(report.runs[0].tool.driver.name).toBe('manel')
      expect(report.runs[0].tool.driver.version).toBe('0.1.0')
      expect(report.runs[0].tool.driver.semanticVersion).toBe('0.1.0')
    })

    it('should generate rules from vulnerabilities', () => {
      const report = formatSarifObject(SCAN_RESULT)

      // Should have rules for each unique vulnerability
      expect(report.runs[0].tool.driver.rules.length).toBeGreaterThan(0)
    })

    it('should map vulnerabilities to SARIF results', () => {
      const report = formatSarifObject(SCAN_RESULT)

      const results = report.runs[0].results
      expect(results.length).toBeGreaterThan(0)

      // Check that each vulnerability has a result
      for (const vuln of VULNERABILITIES) {
        const result = results.find(r => r.ruleId === vuln.id)
        expect(result).toBeDefined()
        expect(result!.message.text).toContain(vuln.title)
      }
    })

    it('should map severity to SARIF levels', () => {
      const report = formatSarifObject(SCAN_RESULT)
      const results = report.runs[0].results

      // CRITICAL/HIGH should be 'error'
      const criticalResult = results.find(r => r.ruleId === 'CVE-2024-0001')
      expect(criticalResult?.level).toBe('error')

      // MEDIUM should be 'warning'
      const mediumResult = results.find(r => r.ruleId === 'CVE-2024-0003')
      expect(mediumResult?.level).toBe('warning')

      // LOW should be 'note'
      const lowResult = results.find(r => r.ruleId === 'CVE-2024-0004')
      expect(lowResult?.level).toBe('note')
    })

    it('should include fix suggestions when available', () => {
      const report = formatSarifObject(SCAN_RESULT)

      // CVE-2024-0001 has fixedVersion: '2.0.0'
      const result = report.runs[0].results.find(r => r.ruleId === 'CVE-2024-0001')
      expect(result?.fixes).toBeDefined()
      expect(result?.fixes?.[0].description.text).toContain('2.0.0')
    })

    it('should include fingerprints for deduplication', () => {
      const report = formatSarifObject(SCAN_RESULT)

      for (const result of report.runs[0].results) {
        expect(result.fingerprints).toBeDefined()
        expect(Object.keys(result.fingerprints).length).toBeGreaterThan(0)
      }
    })

    it('should include invocation record', () => {
      const report = formatSarifObject(SCAN_RESULT)

      expect(report.runs[0].invocations).toHaveLength(1)
      expect(report.runs[0].invocations[0].executionSuccessful).toBe(true)
      expect(report.runs[0].invocations[0].exitCode).toBe(0)
    })

    it('should map failing hardening checks to results', () => {
      const report = formatSarifObject(SCAN_RESULT)
      const results = report.runs[0].results

      // Should have hardening results for fail and warning checks
      const hardeningResults = results.filter(r => r.ruleId.startsWith('HARDENING-'))
      expect(hardeningResults.length).toBeGreaterThan(0)
    })

    it('should handle empty scan result', () => {
      const emptyScan = makeScanResult({
        technologies: [],
        vulnerabilities: [],
        hardening: [],
      })
      const report = formatSarifObject(emptyScan)

      expect(report.runs[0].results).toHaveLength(0)
      expect(report.runs[0].tool.driver.rules).toHaveLength(0)
    })
  })

  describe('formatSarifObject', () => {
    it('should return a SarifReport object', () => {
      const report = formatSarifObject(SCAN_RESULT)

      expect(report).toHaveProperty('version', '2.1.0')
      expect(report).toHaveProperty('runs')
      expect(Array.isArray(report.runs)).toBe(true)
    })

    it('should include version from options', () => {
      const report = formatSarifObject(SCAN_RESULT, { version: '2.0.0-beta' })
      expect(report.runs[0].tool.driver.version).toBe('2.0.0-beta')
    })
  })
})
