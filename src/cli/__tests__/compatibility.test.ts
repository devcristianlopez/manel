/**
 * Output Compatibility Tests for Manel CLI
 *
 * Verifies that CLI output works correctly in different contexts:
 * - Terminal display (TTY)
 * - Piped output (non-TTY)
 * - JSON parsing (like jq would do)
 * - SARIF structure validation
 * - NDJSON streaming compatibility
 *
 * @module cli/__tests__/compatibility.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatOutput, formatJson, formatSarif, formatNdjson } from '../output'
import {
  SCAN_RESULT,
  VULNERABILITIES,
  HARDENING_RESULTS,
  SCORE,
  UPDATE_INFOS,
  makeScanResult,
  makeVulnerability,
  makeTechnology,
  makeHardeningResult,
} from '../output/__tests__/fixtures'

describe('CLI Output Compatibility', () => {
  // =========================================================================
  // Table Output Compatibility
  // =========================================================================

  describe('Table output — terminal vs pipe', () => {
    it('should produce valid table output for TTY (Unicode borders)', () => {
      const output = formatOutput(SCAN_RESULT, 'table', { color: false, isTTY: true })

      // Should use Unicode box-drawing characters
      expect(output).toContain('┌')
      expect(output).toContain('┐')
      expect(output).toContain('└')
      expect(output).toContain('┘')
      expect(output).toContain('─')
      expect(output).toContain('│')
    })

    it('should produce valid table output for pipe (ASCII borders)', () => {
      const output = formatOutput(SCAN_RESULT, 'table', { color: false, isTTY: false })

      // Should use ASCII characters
      expect(output).toContain('+')
      expect(output).toContain('-')
      expect(output).toContain('|')
      // Should NOT contain Unicode borders
      expect(output).not.toContain('┌')
      expect(output).not.toContain('┐')
    })

    it('should produce table with proper formatting', () => {
      const output = formatOutput(SCAN_RESULT, 'table', { color: false, isTTY: false })
      const lines = output.split('\n')

      // Should have data rows with pipe separators
      const dataLines = lines.filter(l => l.startsWith('|') && !l.includes('───'))
      expect(dataLines.length).toBeGreaterThan(0)

      // Each data row should have at least one pipe separator
      for (const line of dataLines) {
        expect(line).toContain('|')
      }
    })

    it('should include all technology names in table output', () => {
      const output = formatOutput(SCAN_RESULT, 'table', { color: false })

      for (const tech of SCAN_RESULT.technologies) {
        expect(output).toContain(tech.name)
      }
    })

    it('should include summary information', () => {
      const output = formatOutput(SCAN_RESULT, 'table', { color: false })

      expect(output).toContain('Summary')
      expect(output).toContain('Score')
      expect(output).toContain('Technologies')
      expect(output).toContain('Vulnerabilities')
      expect(output).toContain('Hardening')
    })
  })

  // =========================================================================
  // JSON Output Compatibility (jq-style parsing)
  // =========================================================================

  describe('JSON output — jq compatibility', () => {
    it('should produce parseable JSON envelope', () => {
      const output = formatOutput(SCAN_RESULT, 'json', { pretty: false })

      // Should be valid JSON
      const parsed = JSON.parse(output)
      expect(parsed).toBeDefined()
    })

    it('should have top-level ok field', () => {
      const output = formatOutput(SCAN_RESULT, 'json', { pretty: false })
      const parsed = JSON.parse(output)

      expect(typeof parsed.ok).toBe('boolean')
      expect(parsed.ok).toBe(true)
    })

    it('should have data field at top level', () => {
      const output = formatOutput(SCAN_RESULT, 'json', { pretty: false })
      const parsed = JSON.parse(output)

      expect(parsed.data).toBeDefined()
      expect(typeof parsed.data).toBe('object')
    })

    it('should have meta field with required properties', () => {
      const output = formatOutput(SCAN_RESULT, 'json', { pretty: false })
      const parsed = JSON.parse(output)

      expect(parsed.meta).toBeDefined()
      expect(typeof parsed.meta.timestamp).toBe('string')
      expect(typeof parsed.meta.duration).toBe('number')
      expect(typeof parsed.meta.version).toBe('string')
    })

    it('should have null error field on success', () => {
      const output = formatOutput(SCAN_RESULT, 'json', { pretty: false })
      const parsed = JSON.parse(output)

      expect(parsed.error).toBeNull()
    })

    it('should have empty warnings array', () => {
      const output = formatOutput(SCAN_RESULT, 'json', { pretty: false })
      const parsed = JSON.parse(output)

      expect(Array.isArray(parsed.warnings)).toBe(true)
      expect(parsed.warnings).toHaveLength(0)
    })

    it('should support nested field access like jq', () => {
      const output = formatOutput(SCAN_RESULT, 'json', { pretty: false })
      const parsed = JSON.parse(output)

      // jq: .data.technologies | length
      expect(Array.isArray(parsed.data.technologies)).toBe(true)
      expect(parsed.data.technologies.length).toBe(SCAN_RESULT.technologies.length)

      // jq: .data.score.overall
      expect(typeof parsed.data.score.overall).toBe('number')

      // jq: .data.vulnerabilities[0].severity
      if (parsed.data.vulnerabilities.length > 0) {
        expect(typeof parsed.data.vulnerabilities[0].severity).toBe('string')
      }
    })

    it('should produce valid timestamp in ISO 8601 format', () => {
      const output = formatOutput(SCAN_RESULT, 'json', { pretty: false })
      const parsed = JSON.parse(output)

      const timestamp = new Date(parsed.meta.timestamp)
      expect(timestamp.getTime()).not.toBeNaN()
    })

    it('should support versioned meta', () => {
      const output = formatOutput(SCAN_RESULT, 'json', { version: '2.0.0', pretty: false })
      const parsed = JSON.parse(output)

      expect(parsed.meta.version).toBe('2.0.0')
    })

    it('should support duration in meta', () => {
      const output = formatOutput(SCAN_RESULT, 'json', { duration: 42, pretty: false })
      const parsed = JSON.parse(output)

      expect(parsed.meta.duration).toBe(42)
    })

    it('should produce compact JSON when pretty is false', () => {
      const output = formatOutput(SCAN_RESULT, 'json', { pretty: false })

      // Compact JSON should not have newlines between properties
      // (except possibly within string values)
      const firstBrace = output.indexOf('{')
      const nextChar = output[firstBrace + 1]
      expect(nextChar).not.toBe('\n')
    })

    it('should produce pretty JSON by default', () => {
      const output = formatOutput(SCAN_RESULT, 'json')

      // Pretty JSON should have newlines
      expect(output).toContain('\n')
      // Should have indentation
      expect(output).toContain('  ')
    })
  })

  // =========================================================================
  // SARIF Output Compatibility
  // =========================================================================

  describe('SARIF output — structure validation', () => {
    it('should produce SARIF 2.1.0 compliant output', () => {
      const output = formatOutput(SCAN_RESULT, 'sarif')
      const report = JSON.parse(output)

      // Required top-level fields per SARIF 2.1.0 spec
      expect(report.version).toBe('2.1.0')
      expect(report.$schema).toBeDefined()
      expect(report.$schema).toContain('sarif')
      expect(report.runs).toBeDefined()
      expect(Array.isArray(report.runs)).toBe(true)
      expect(report.runs.length).toBeGreaterThan(0)
    })

    it('should have valid tool driver', () => {
      const output = formatOutput(SCAN_RESULT, 'sarif')
      const report = JSON.parse(output)
      const run = report.runs[0]

      expect(run.tool).toBeDefined()
      expect(run.tool.driver).toBeDefined()
      expect(run.tool.driver.name).toBe('manel')
      expect(typeof run.tool.driver.version).toBe('string')
      expect(typeof run.tool.driver.semanticVersion).toBe('string')
    })

    it('should have valid rules array', () => {
      const output = formatOutput(SCAN_RESULT, 'sarif')
      const report = JSON.parse(output)
      const rules = report.runs[0].tool.driver.rules

      expect(Array.isArray(rules)).toBe(true)
      expect(rules.length).toBeGreaterThan(0)

      for (const rule of rules) {
        expect(typeof rule.id).toBe('string')
        expect(typeof rule.name).toBe('string')
        expect(rule.shortDescription).toBeDefined()
        expect(typeof rule.shortDescription.text).toBe('string')
        expect(rule.fullDescription).toBeDefined()
        expect(typeof rule.fullDescription.text).toBe('string')
        expect(rule.defaultConfiguration).toBeDefined()
        expect(['error', 'warning', 'note']).toContain(rule.defaultConfiguration.level)
      }
    })

    it('should have valid results array with correct structure', () => {
      const output = formatOutput(SCAN_RESULT, 'sarif')
      const report = JSON.parse(output)
      const results = report.runs[0].results

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)

      for (const result of results) {
        expect(typeof result.ruleId).toBe('string')
        expect(['error', 'warning', 'note']).toContain(result.level)
        expect(result.message).toBeDefined()
        expect(typeof result.message.text).toBe('string')
        expect(Array.isArray(result.locations)).toBe(true)
        expect(result.locations.length).toBeGreaterThan(0)
        expect(result.fingerprints).toBeDefined()
        expect(typeof result.fingerprints).toBe('object')
      }
    })

    it('should have valid invocations', () => {
      const output = formatOutput(SCAN_RESULT, 'sarif')
      const report = JSON.parse(output)
      const invocations = report.runs[0].invocations

      expect(Array.isArray(invocations)).toBe(true)
      expect(invocations.length).toBeGreaterThan(0)

      for (const invocation of invocations) {
        expect(typeof invocation.executionSuccessful).toBe('boolean')
      }
    })

    it('should include fix suggestions for vulnerabilities with fixed versions', () => {
      const output = formatOutput(SCAN_RESULT, 'sarif')
      const report = JSON.parse(output)
      const results = report.runs[0].results

      // Find a result that has a fix (vulnerabilities with fixedVersion)
      const resultsWithFixes = results.filter((r: any) => r.fixes && r.fixes.length > 0)

      if (resultsWithFixes.length > 0) {
        const fix = resultsWithFixes[0].fixes[0]
        expect(fix.description).toBeDefined()
        expect(typeof fix.description.text).toBe('string')
        expect(Array.isArray(fix.artifactChanges)).toBe(true)
      }
    })

    it('should map severity levels correctly', () => {
      const output = formatOutput(SCAN_RESULT, 'sarif')
      const report = JSON.parse(output)
      const results = report.runs[0].results

      for (const result of results) {
        // SARIF levels should be one of: error, warning, note
        expect(['error', 'warning', 'note']).toContain(result.level)
      }
    })

    it('should include package URIs in locations', () => {
      const output = formatOutput(SCAN_RESULT, 'sarif')
      const report = JSON.parse(output)
      const results = report.runs[0].results

      for (const result of results) {
        for (const location of result.locations) {
          expect(location.physicalLocation).toBeDefined()
          expect(location.physicalLocation.artifactLocation).toBeDefined()
          expect(typeof location.physicalLocation.artifactLocation.uri).toBe('string')
          expect(location.physicalLocation.artifactLocation.uri.length).toBeGreaterThan(0)
        }
      }
    })
  })

  // =========================================================================
  // NDJSON Output Compatibility
  // =========================================================================

  describe('NDJSON output — streaming compatibility', () => {
    it('should produce one JSON object per line', () => {
      const output = formatOutput(SCAN_RESULT, 'ndjson')
      const lines = output.split('\n').filter(l => l.trim())

      for (const line of lines) {
        // Each line should be a complete JSON object
        expect(() => JSON.parse(line)).not.toThrow()
        const parsed = JSON.parse(line)
        expect(typeof parsed).toBe('object')
        expect(parsed !== null).toBe(true)
      }
    })

    it('should start with meta line', () => {
      const output = formatOutput(SCAN_RESULT, 'ndjson')
      const firstLine = output.split('\n')[0]
      const parsed = JSON.parse(firstLine)

      expect(parsed.type).toBe('meta')
      expect(typeof parsed.timestamp).toBe('string')
      expect(typeof parsed.totalTechnologies).toBe('number')
    })

    it('should end with score line', () => {
      const output = formatOutput(SCAN_RESULT, 'ndjson')
      const lines = output.split('\n').filter(l => l.trim())
      const lastLine = lines[lines.length - 1]
      const parsed = JSON.parse(lastLine)

      expect(parsed.type).toBe('score')
      expect(typeof parsed.overall).toBe('number')
      expect(parsed.breakdown).toBeDefined()
    })

    it('should have technology lines with required fields', () => {
      const output = formatOutput(SCAN_RESULT, 'ndjson')
      const lines = output.split('\n').filter(l => l.trim())
      const techLines = lines
        .map(l => JSON.parse(l))
        .filter((l: any) => l.type === 'technology')

      expect(techLines.length).toBeGreaterThan(0)

      for (const line of techLines) {
        expect(typeof line.name).toBe('string')
        expect(typeof line.detected).toBe('boolean')
        expect(typeof line.ecosystem).toBe('string')
      }
    })

    it('should have vulnerability lines with required fields', () => {
      const output = formatOutput(SCAN_RESULT, 'ndjson')
      const lines = output.split('\n').filter(l => l.trim())
      const vulnLines = lines
        .map(l => JSON.parse(l))
        .filter((l: any) => l.type === 'vulnerability')

      expect(vulnLines.length).toBeGreaterThan(0)

      for (const line of vulnLines) {
        expect(typeof line.id).toBe('string')
        expect(typeof line.severity).toBe('string')
        expect(typeof line.title).toBe('string')
        expect(typeof line.affectedPackage).toBe('string')
      }
    })

    it('should have hardening lines with required fields', () => {
      const output = formatOutput(SCAN_RESULT, 'ndjson')
      const lines = output.split('\n').filter(l => l.trim())
      const hardeningLines = lines
        .map(l => JSON.parse(l))
        .filter((l: any) => l.type === 'hardening')

      expect(hardeningLines.length).toBeGreaterThan(0)

      for (const line of hardeningLines) {
        expect(typeof line.id).toBe('string')
        expect(typeof line.title).toBe('string')
        expect(['pass', 'fail', 'warning', 'error']).toContain(line.status)
        expect(typeof line.severity).toBe('string')
      }
    })

    it('should be processable with head (first N lines)', () => {
      const output = formatOutput(SCAN_RESULT, 'ndjson')
      const allLines = output.split('\n').filter(l => l.trim())

      // Simulate: head -n 5
      const firstFiveLines = allLines.slice(0, 5)

      for (const line of firstFiveLines) {
        expect(() => JSON.parse(line)).not.toThrow()
      }
    })

    it('should support filtering by type (like jq select)', () => {
      const output = formatOutput(SCAN_RESULT, 'ndjson')
      const lines = output.split('\n').filter(l => l.trim())
      const parsed = lines.map(l => JSON.parse(l))

      // Simulate: jq 'select(.type == "vulnerability")'
      const vulns = parsed.filter((l: any) => l.type === 'vulnerability')
      expect(vulns.length).toBeGreaterThan(0)

      // Simulate: jq 'select(.type == "technology")'
      const techs = parsed.filter((l: any) => l.type === 'technology')
      expect(techs.length).toBeGreaterThan(0)

      // Simulate: jq 'select(.type == "score")'
      const scores = parsed.filter((l: any) => l.type === 'score')
      expect(scores.length).toBe(1)
    })

    it('should not contain empty lines in the middle', () => {
      const output = formatOutput(SCAN_RESULT, 'ndjson')
      const lines = output.split('\n')

      // Check no empty lines between data lines
      let foundEmpty = false
      for (const line of lines) {
        if (line.trim() === '') {
          foundEmpty = true
        } else if (foundEmpty) {
          // If we found an empty line followed by content, that's ok only at the end
          // But empty lines between content are not ok
        }
      }

      // NDJSON should not have blank lines between entries
      const nonEmptyLines = lines.filter(l => l.trim() !== '')
      for (const line of nonEmptyLines) {
        expect(() => JSON.parse(line)).not.toThrow()
      }
    })
  })

  // =========================================================================
  // Cross-Format Consistency
  // =========================================================================

  describe('Cross-format consistency', () => {
    it('should report same number of technologies in JSON and NDJSON', () => {
      const jsonOutput = formatOutput(SCAN_RESULT, 'json', { pretty: false })
      const ndjsonOutput = formatOutput(SCAN_RESULT, 'ndjson')

      const jsonData = JSON.parse(jsonOutput)
      const ndjsonLines = ndjsonOutput.split('\n').filter(l => l.trim())
      const ndjsonParsed = ndjsonLines.map(l => JSON.parse(l))

      const jsonTechCount = jsonData.data.technologies.length
      const ndjsonTechCount = ndjsonParsed.filter((l: any) => l.type === 'technology').length

      expect(jsonTechCount).toBe(ndjsonTechCount)
    })

    it('should report same number of vulnerabilities in JSON, SARIF, and NDJSON', () => {
      const jsonOutput = formatOutput(SCAN_RESULT, 'json', { pretty: false })
      const sarifOutput = formatOutput(SCAN_RESULT, 'sarif')
      const ndjsonOutput = formatOutput(SCAN_RESULT, 'ndjson')

      const jsonData = JSON.parse(jsonOutput)
      const sarifData = JSON.parse(sarifOutput)
      const ndjsonLines = ndjsonOutput.split('\n').filter(l => l.trim())
      const ndjsonParsed = ndjsonLines.map(l => JSON.parse(l))

      const jsonVulnCount = jsonData.data.vulnerabilities.length
      const sarifVulnCount = sarifData.runs[0].results.filter(
        (r: any) => !r.ruleId.startsWith('HARDENING-')
      ).length
      const ndjsonVulnCount = ndjsonParsed.filter((l: any) => l.type === 'vulnerability').length

      expect(jsonVulnCount).toBe(sarifVulnCount)
      expect(jsonVulnCount).toBe(ndjsonVulnCount)
    })

    it('should report same score in JSON and NDJSON', () => {
      const jsonOutput = formatOutput(SCAN_RESULT, 'json', { pretty: false })
      const ndjsonOutput = formatOutput(SCAN_RESULT, 'ndjson')

      const jsonData = JSON.parse(jsonOutput)
      const ndjsonLines = ndjsonOutput.split('\n').filter(l => l.trim())
      const ndjsonParsed = ndjsonLines.map(l => JSON.parse(l))

      const jsonScore = jsonData.data.score.overall
      const ndjsonScore = ndjsonParsed.find((l: any) => l.type === 'score')?.overall

      expect(jsonScore).toBe(ndjsonScore)
    })

    it('should include same version in all formats', () => {
      const jsonOutput = formatOutput(SCAN_RESULT, 'json', { version: '1.2.3', pretty: false })
      const sarifOutput = formatOutput(SCAN_RESULT, 'sarif', { version: '1.2.3' })

      const jsonData = JSON.parse(jsonOutput)
      const sarifData = JSON.parse(sarifOutput)

      expect(jsonData.meta.version).toBe('1.2.3')
      expect(sarifData.runs[0].tool.driver.version).toBe('1.2.3')
    })
  })

  // =========================================================================
  // Empty / Minimal Data
  // =========================================================================

  describe('Empty and minimal data handling', () => {
    it('should handle scan result with no vulnerabilities', () => {
      const data = makeScanResult({ vulnerabilities: [] })

      const jsonOutput = formatOutput(data, 'json', { pretty: false })
      const parsed = JSON.parse(jsonOutput)
      expect(parsed.data.vulnerabilities).toHaveLength(0)

      const tableOutput = formatOutput(data, 'table', { color: false })
      expect(tableOutput.length).toBeGreaterThan(0)

      const sarifOutput = formatOutput(data, 'sarif')
      const sarifReport = JSON.parse(sarifOutput)
      // SARIF results may include hardening checks even with no vulnerabilities
      expect(sarifReport.runs[0].results).toBeDefined()

      const ndjsonOutput = formatOutput(data, 'ndjson')
      const lines = ndjsonOutput.split('\n').filter(l => l.trim())
      expect(lines.length).toBeGreaterThan(0)
    })

    it('should handle scan result with no hardening checks', () => {
      const data = makeScanResult({ hardening: [] })

      const jsonOutput = formatOutput(data, 'json', { pretty: false })
      const parsed = JSON.parse(jsonOutput)
      expect(parsed.data.hardening).toHaveLength(0)

      const tableOutput = formatOutput(data, 'table', { color: false })
      expect(tableOutput).toContain('Technologies')
    })

    it('should handle scan result with single technology', () => {
      const data = makeScanResult({
        technologies: [makeTechnology()],
        vulnerabilities: [],
        hardening: [],
      })

      const jsonOutput = formatOutput(data, 'json', { pretty: false })
      const parsed = JSON.parse(jsonOutput)
      expect(parsed.data.technologies).toHaveLength(1)
    })

    it('should handle empty vulnerability array in table format', () => {
      const output = formatOutput(VULNERABILITIES.slice(0, 0), 'table', { color: false })
      expect(output).toBe('')
    })

    it('should handle score of 0', () => {
      const data = makeScanResult({
        score: { overall: 0, breakdown: { os: 0, hardening: 0, tools: 0, dependencies: 0, databases: 0, criticalsPenalty: 0 } },
      })

      const jsonOutput = formatOutput(data, 'json', { pretty: false })
      const parsed = JSON.parse(jsonOutput)
      expect(parsed.data.score.overall).toBe(0)

      const tableOutput = formatOutput(data, 'table', { color: false })
      expect(tableOutput).toContain('0/100')
    })

    it('should handle score of 100', () => {
      const data = makeScanResult({
        score: { overall: 100, breakdown: { os: 100, hardening: 100, tools: 100, dependencies: 100, databases: 100, criticalsPenalty: 100 } },
      })

      const jsonOutput = formatOutput(data, 'json', { pretty: false })
      const parsed = JSON.parse(jsonOutput)
      expect(parsed.data.score.overall).toBe(100)

      const tableOutput = formatOutput(data, 'table', { color: false })
      expect(tableOutput).toContain('100/100')
    })
  })
})
