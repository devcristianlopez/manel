/**
 * Tests for src/cli/output/ndjson-formatter
 */
import { describe, it, expect } from 'vitest'
import { formatNdjson, formatVulnerabilitiesNdjson } from '../ndjson-formatter'
import { SCAN_RESULT, VULNERABILITIES, makeScanResult, TECHNOLOGIES } from './fixtures'
import type { OutputScanResult, OutputTechnology } from '../types'

describe('NDJSON Formatter', () => {
  describe('formatNdjson', () => {
    it('should produce one JSON object per line', () => {
      const output = formatNdjson(SCAN_RESULT)
      const lines = output.split('\n')

      // Every line should be valid JSON
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow()
      }
    })

    it('should start with a meta line', () => {
      const output = formatNdjson(SCAN_RESULT)
      const firstLine = JSON.parse(output.split('\n')[0])

      expect(firstLine.type).toBe('meta')
      expect(firstLine.timestamp).toBeDefined()
      expect(firstLine.totalTechnologies).toBe(4)
      expect(firstLine.totalVulnerabilities).toBe(4)
    })

    it('should include technology lines', () => {
      const output = formatNdjson(SCAN_RESULT)
      const lines = output.split('\n').map(l => JSON.parse(l))

      const techLines = lines.filter(l => l.type === 'technology')
      expect(techLines).toHaveLength(4)

      // Check first technology
      expect(techLines[0].name).toBe('node')
      expect(techLines[0].version).toBe('18.0.0')
      expect(techLines[0].ecosystem).toBe('npm')
    })

    it('should include vulnerability lines', () => {
      const output = formatNdjson(SCAN_RESULT)
      const lines = output.split('\n').map(l => JSON.parse(l))

      const vulnLines = lines.filter(l => l.type === 'vulnerability')
      expect(vulnLines).toHaveLength(4)

      // Check first vulnerability
      expect(vulnLines[0].severity).toBe('CRITICAL')
      expect(vulnLines[0].affectedPackage).toBe('lodash')
    })

    it('should include hardening lines', () => {
      const output = formatNdjson(SCAN_RESULT)
      const lines = output.split('\n').map(l => JSON.parse(l))

      const hardeningLines = lines.filter(l => l.type === 'hardening')
      expect(hardeningLines.length).toBeGreaterThan(0)

      // Each hardening line should have the expected fields
      for (const line of hardeningLines) {
        expect(line).toHaveProperty('id')
        expect(line).toHaveProperty('title')
        expect(line).toHaveProperty('status')
        expect(line).toHaveProperty('severity')
      }
    })

    it('should end with a score line', () => {
      const output = formatNdjson(SCAN_RESULT)
      const lines = output.split('\n').map(l => JSON.parse(l))

      const scoreLine = lines.find(l => l.type === 'score')
      expect(scoreLine).toBeDefined()
      expect(scoreLine.overall).toBe(72)
      expect(scoreLine.breakdown).toBeDefined()
    })

    it('should handle empty scan result', () => {
      const emptyScan = makeScanResult({
        technologies: [],
        vulnerabilities: [],
        hardening: [],
      })
      const output = formatNdjson(emptyScan)
      const lines = output.split('\n')

      // Should have meta and score lines at minimum
      expect(lines.length).toBe(2)
      expect(JSON.parse(lines[0]).type).toBe('meta')
      expect(JSON.parse(lines[1]).type).toBe('score')
    })

    it('should be parseable line by line', () => {
      const output = formatNdjson(SCAN_RESULT)
      const lines = output.split('\n')

      // Simulate processing with head -n 5
      const firstFive = lines.slice(0, 5)
      for (const line of firstFive) {
        const parsed = JSON.parse(line)
        expect(parsed).toHaveProperty('type')
      }
    })

    it('should include optional fields only when present', () => {
      // Create a scan with a technology that has optional fields and one without
      const scanWithMixed: OutputScanResult = {
        ...SCAN_RESULT,
        technologies: [
          { name: 'node', version: '18.0.0', detected: true, ecosystem: 'npm', latestVersion: '20.0.0', updateAvailable: true },
          { name: 'go', version: '1.21', detected: true, ecosystem: 'go' }, // no optional fields
        ],
      }
      const output = formatNdjson(scanWithMixed)
      const lines = output.split('\n').map(l => JSON.parse(l))

      const techWithUpdate = lines.find(l => l.type === 'technology' && l.name === 'node')
      expect(techWithUpdate).toHaveProperty('latestVersion', '20.0.0')
      expect(techWithUpdate).toHaveProperty('updateAvailable', true)

      const techWithoutUpdate = lines.find(l => l.type === 'technology' && l.name === 'go')
      expect(techWithoutUpdate).not.toHaveProperty('latestVersion')
      expect(techWithoutUpdate).not.toHaveProperty('updateAvailable')
    })
  })

  describe('formatVulnerabilitiesNdjson', () => {
    it('should format vulnerability array as NDJSON', () => {
      const output = formatVulnerabilitiesNdjson(VULNERABILITIES)
      const lines = output.split('\n')

      expect(lines).toHaveLength(4)

      for (const line of lines) {
        const parsed = JSON.parse(line)
        expect(parsed.type).toBe('vulnerability')
      }
    })

    it('should handle empty array', () => {
      const output = formatVulnerabilitiesNdjson([])
      expect(output).toBe('')
    })

    it('should produce valid JSON per line', () => {
      const output = formatVulnerabilitiesNdjson(VULNERABILITIES)
      const lines = output.split('\n')

      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow()
      }
    })
  })
})
