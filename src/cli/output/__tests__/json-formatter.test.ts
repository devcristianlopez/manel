/**
 * Tests for src/cli/output/json-formatter
 */
import { describe, it, expect } from 'vitest'
import { formatJson, formatJsonError } from '../json-formatter'
import { SCAN_RESULT } from './fixtures'

describe('JSON Formatter', () => {
  describe('formatJson', () => {
    it('should wrap data in ResponseEnvelope', () => {
      const output = formatJson(SCAN_RESULT)
      const parsed = JSON.parse(output)

      expect(parsed).toHaveProperty('ok', true)
      expect(parsed).toHaveProperty('data')
      expect(parsed).toHaveProperty('error', null)
      expect(parsed).toHaveProperty('warnings')
      expect(Array.isArray(parsed.warnings)).toBe(true)
      expect(parsed).toHaveProperty('meta')
    })

    it('should include meta with timestamp, duration, and version', () => {
      const output = formatJson(SCAN_RESULT, { version: '0.1.0', duration: 150 })
      const parsed = JSON.parse(output)

      expect(parsed.meta.version).toBe('0.1.0')
      expect(parsed.meta.duration).toBe(150)
      expect(parsed.meta.timestamp).toBeDefined()
      // Timestamp should be valid ISO 8601
      expect(new Date(parsed.meta.timestamp).toISOString()).toBe(parsed.meta.timestamp)
    })

    it('should pretty-print by default', () => {
      const output = formatJson(SCAN_RESULT)
      // Pretty-printed JSON contains newlines and indentation
      expect(output).toContain('\n')
      expect(output).toContain('  ')
    })

    it('should compact when pretty is false', () => {
      const output = formatJson(SCAN_RESULT, { pretty: false })
      const parsed = JSON.parse(output)
      // Compact JSON should not have newlines between properties
      expect(output).not.toContain('\n')
    })

    it('should use custom indent', () => {
      const output = formatJson(SCAN_RESULT, { pretty: true, indent: 4 })
      // 4-space indent
      expect(output).toContain('    "ok"')
    })

    it('should preserve data structure', () => {
      const output = formatJson(SCAN_RESULT)
      const parsed = JSON.parse(output)

      expect(parsed.data.technologies).toHaveLength(4)
      expect(parsed.data.vulnerabilities).toHaveLength(4)
      expect(parsed.data.score.overall).toBe(72)
    })

    it('should handle null data', () => {
      const output = formatJson(null)
      const parsed = JSON.parse(output)

      expect(parsed.ok).toBe(true)
      expect(parsed.data).toBeNull()
    })

    it('should handle string data', () => {
      const output = formatJson('hello world')
      const parsed = JSON.parse(output)

      expect(parsed.data).toBe('hello world')
    })

    it('should handle array data', () => {
      const arr = [1, 2, 3]
      const output = formatJson(arr)
      const parsed = JSON.parse(output)

      expect(parsed.data).toEqual([1, 2, 3])
    })

    it('should produce valid JSON', () => {
      const output = formatJson(SCAN_RESULT)
      expect(() => JSON.parse(output)).not.toThrow()
    })
  })

  describe('formatJsonError', () => {
    it('should wrap error in ResponseEnvelope', () => {
      const output = formatJsonError('SCAN_FAILED', 'Scan failed', 'internal')
      const parsed = JSON.parse(output)

      expect(parsed.ok).toBe(false)
      expect(parsed.data).toBeNull()
      expect(parsed.error).toEqual({
        code: 'SCAN_FAILED',
        type: 'internal',
        message: 'Scan failed',
        recoverable: false,
      })
    })

    it('should include metadata', () => {
      const output = formatJsonError('ERR', 'msg', 'validation', { version: '1.0.0', duration: 50 })
      const parsed = JSON.parse(output)

      expect(parsed.meta.version).toBe('1.0.0')
      expect(parsed.meta.duration).toBe(50)
    })

    it('should produce valid JSON', () => {
      const output = formatJsonError('ERR', 'msg', 'network')
      expect(() => JSON.parse(output)).not.toThrow()
    })
  })
})
