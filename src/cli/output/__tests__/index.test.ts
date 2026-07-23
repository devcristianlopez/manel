/**
 * Tests for src/cli/output/index (main formatOutput function)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { formatOutput } from '../index'
import {
  SCAN_RESULT,
  VULNERABILITIES,
  HARDENING_RESULTS,
  SCORE,
  UPDATE_INFOS,
} from './fixtures'

describe('formatOutput — Main Entry Point', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.FORCE_COLOR
    delete process.env.NO_COLOR
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('table format', () => {
    it('should format ScanResult as table', () => {
      const output = formatOutput(SCAN_RESULT, 'table', { color: false })
      expect(output).toContain('Technologies')
      expect(output).toContain('node')
    })

    it('should format Vulnerability[] as table', () => {
      const output = formatOutput(VULNERABILITIES, 'table', { color: false })
      expect(output).toContain('Vulnerabilities')
    })

    it('should format SecurityScore as table', () => {
      const output = formatOutput(SCORE, 'table', { color: false })
      expect(output).toContain('Security Score')
    })

    it('should format UpdateInfo[] as table', () => {
      const output = formatOutput(UPDATE_INFOS, 'table', { color: false })
      expect(output).toContain('Available Updates')
    })
  })

  describe('json format', () => {
    it('should format any data as JSON envelope', () => {
      const output = formatOutput(SCAN_RESULT, 'json', { pretty: false })
      const parsed = JSON.parse(output)

      expect(parsed.ok).toBe(true)
      expect(parsed.data).toBeDefined()
      expect(parsed.meta).toBeDefined()
    })

    it('should pretty-print by default', () => {
      const output = formatOutput(SCAN_RESULT, 'json')
      expect(output).toContain('\n')
    })

    it('should include version in meta', () => {
      const output = formatOutput(SCAN_RESULT, 'json', { version: '1.0.0', pretty: false })
      const parsed = JSON.parse(output)
      expect(parsed.meta.version).toBe('1.0.0')
    })
  })

  describe('sarif format', () => {
    it('should format ScanResult as SARIF', () => {
      const output = formatOutput(SCAN_RESULT, 'sarif')
      const report = JSON.parse(output)

      expect(report.version).toBe('2.1.0')
      expect(report.runs).toHaveLength(1)
    })

    it('should gracefully degrade for non-ScanResult data', () => {
      const output = formatOutput(VULNERABILITIES, 'sarif')
      const report = JSON.parse(output)
      expect(report.version).toBe('2.1.0')
      expect(report.runs).toHaveLength(1)
    })

    it('should gracefully degrade for SecurityScore', () => {
      const output = formatOutput(SCORE, 'sarif')
      const report = JSON.parse(output)
      expect(report.version).toBe('2.1.0')
      expect(report.runs).toHaveLength(1)
    })
  })

  describe('ndjson format', () => {
    it('should format ScanResult as NDJSON', () => {
      const output = formatOutput(SCAN_RESULT, 'ndjson')
      const lines = output.split('\n')

      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow()
      }
    })

    it('should gracefully degrade for non-ScanResult data', () => {
      const output = formatOutput(VULNERABILITIES, 'ndjson')
      const lines = output.split('\n').filter(l => l.trim())
      expect(lines.length).toBeGreaterThan(0)
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow()
      }
    })
  })

  describe('unsupported format', () => {
    it('should throw for unknown format', () => {
      expect(() => formatOutput(SCAN_RESULT, 'csv' as any)).toThrow('Unsupported output format')
    })
  })
})
