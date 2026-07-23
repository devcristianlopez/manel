/**
 * Edge Case Tests for Manel CLI
 *
 * Tests boundary conditions, invalid inputs, and unusual scenarios.
 * Ensures the CLI handles adversarial/malformed input gracefully.
 *
 * @module cli/__tests__/edge-cases.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock child_process for scanner
vi.mock('child_process', () => {
  const mockExecSync = vi.fn()
  return {
    default: { execSync: mockExecSync },
    execSync: mockExecSync,
  }
})

// Mock fs/promises for output writing
const mockWriteFile = vi.fn().mockResolvedValue(undefined)
vi.mock('fs/promises', () => ({
  default: {
    writeFile: mockWriteFile,
  },
  writeFile: mockWriteFile,
}))

import { execSync } from 'child_process'
import { createProgram } from '../index'
import {
  isValidFormat,
  isValidSeverity,
  parseSeverityFilter,
  normalizeFailOn,
} from '../flags'
import {
  createCliError,
  validationError,
  networkError,
  internalError,
  notFoundError,
  errorToExitCode,
  formatErrorForStderr,
  formatErrorForJson,
} from '../errors'

// Read version dynamically from package.json
import { readFileSync } from 'fs'
import { join } from 'path'
const PACKAGE_VERSION = JSON.parse(
  readFileSync(join(process.cwd(), 'package.json'), 'utf-8')
).version

const mockExecSync = execSync as ReturnType<typeof vi.fn>

describe('CLI Edge Cases', () => {
  beforeEach(() => {
    mockExecSync.mockReset()
    mockWriteFile.mockClear()
  })

  // =========================================================================
  // Format Validation Edge Cases
  // =========================================================================

  describe('Invalid format handling', () => {
    it('should reject format with trailing whitespace', () => {
      expect(isValidFormat('json ')).toBe(false)
    })

    it('should reject format with leading whitespace', () => {
      expect(isValidFormat(' json')).toBe(false)
    })

    it('should reject uppercase format', () => {
      expect(isValidFormat('JSON')).toBe(false)
      expect(isValidFormat('Table')).toBe(false)
      expect(isValidFormat('SARIF')).toBe(false)
      expect(isValidFormat('NDJSON')).toBe(false)
    })

    it('should reject empty string', () => {
      expect(isValidFormat('')).toBe(false)
    })

    it('should reject partial format names', () => {
      expect(isValidFormat('js')).toBe(false)
      expect(isValidFormat('jso')).toBe(false)
      expect(isValidFormat('sar')).toBe(false)
      expect(isValidFormat('ndj')).toBe(false)
      expect(isValidFormat('tab')).toBe(false)
    })

    it('should reject formats with special characters', () => {
      expect(isValidFormat('json;')).toBe(false)
      expect(isValidFormat('json\n')).toBe(false)
      expect(isValidFormat('json\t')).toBe(false)
    })

    it('should accept all valid formats', () => {
      expect(isValidFormat('table')).toBe(true)
      expect(isValidFormat('json')).toBe(true)
      expect(isValidFormat('sarif')).toBe(true)
      expect(isValidFormat('ndjson')).toBe(true)
    })
  })

  // =========================================================================
  // Severity Validation Edge Cases
  // =========================================================================

  describe('Invalid severity handling', () => {
    it('should reject severity with trailing whitespace', () => {
      expect(isValidSeverity('CRITICAL ')).toBe(false)
    })

    it('should reject lowercase severity', () => {
      expect(isValidSeverity('critical')).toBe(false)
      expect(isValidSeverity('high')).toBe(false)
      expect(isValidSeverity('medium')).toBe(false)
      expect(isValidSeverity('low')).toBe(false)
    })

    it('should reject severity with extra characters', () => {
      expect(isValidSeverity('CRITICAL!')).toBe(false)
      expect(isValidSeverity('HIGH1')).toBe(false)
      expect(isValidSeverity('MEDIUM_')).toBe(false)
    })

    it('should reject non-severity strings', () => {
      expect(isValidSeverity('FATAL')).toBe(false)
      expect(isValidSeverity('INFO')).toBe(false)
      expect(isValidSeverity('WARNING')).toBe(false)
      expect(isValidSeverity('NONE')).toBe(false)
    })
  })

  // =========================================================================
  // Severity Filter Parsing Edge Cases
  // =========================================================================

  describe('parseSeverityFilter edge cases', () => {
    it('should handle empty string input', () => {
      const result = parseSeverityFilter('')
      expect(result).toEqual([])
    })

    it('should handle whitespace-only input', () => {
      const result = parseSeverityFilter('   ')
      expect(result).toEqual([])
    })

    it('should handle trailing comma', () => {
      const result = parseSeverityFilter('CRITICAL,')
      expect(result).toEqual(['CRITICAL'])
    })

    it('should handle leading comma', () => {
      const result = parseSeverityFilter(',CRITICAL')
      expect(result).toEqual(['CRITICAL'])
    })

    it('should handle double commas', () => {
      const result = parseSeverityFilter('CRITICAL,,HIGH')
      expect(result).toEqual(['CRITICAL', 'HIGH'])
    })

    it('should handle mixed valid and invalid severities', () => {
      const result = parseSeverityFilter('CRITICAL,invalid,HIGH,FATAL,MEDIUM')
      expect(result).toEqual(['CRITICAL', 'HIGH', 'MEDIUM'])
    })

    it('should handle all valid severities', () => {
      const result = parseSeverityFilter('CRITICAL,HIGH,MEDIUM,LOW,UNKNOWN')
      expect(result).toEqual(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'])
    })

    it('should handle extra whitespace around each severity', () => {
      const result = parseSeverityFilter('  CRITICAL ,  HIGH  ,  MEDIUM  ')
      expect(result).toEqual(['CRITICAL', 'HIGH', 'MEDIUM'])
    })

    it('should handle all invalid input', () => {
      const result = parseSeverityFilter('invalid1,invalid2,')
      expect(result).toEqual([])
    })
  })

  // =========================================================================
  // normalizeFailOn Edge Cases
  // =========================================================================

  describe('normalizeFailOn edge cases', () => {
    it('should handle mixed case', () => {
      expect(normalizeFailOn('Critical')).toBe('CRITICAL')
      expect(normalizeFailOn('HiGh')).toBe('HIGH')
      expect(normalizeFailOn('medium')).toBe('MEDIUM')
    })

    it('should handle already uppercase', () => {
      expect(normalizeFailOn('CRITICAL')).toBe('CRITICAL')
    })

    it('should handle all valid values', () => {
      expect(normalizeFailOn('critical')).toBe('CRITICAL')
      expect(normalizeFailOn('high')).toBe('HIGH')
      expect(normalizeFailOn('medium')).toBe('MEDIUM')
      expect(normalizeFailOn('low')).toBe('LOW')
    })
  })

  // =========================================================================
  // Error Handling Edge Cases
  // =========================================================================

  describe('Error factories edge cases', () => {
    it('should create error with empty message', () => {
      const error = validationError('')
      expect(error.message).toBe('')
      expect(error.code).toBe('INVALID_INPUT')
    })

    it('should create error with very long message', () => {
      const longMessage = 'x'.repeat(10000)
      const error = internalError(longMessage)
      expect(error.message).toBe(longMessage)
    })

    it('should create error with special characters in message', () => {
      const error = validationError('Error: <script>alert("xss")</script>')
      expect(error.message).toContain('<script>')
    })

    it('should create error with unicode in message', () => {
      const error = validationError('Error: 网络超时 — ネットワークエラー')
      expect(error.message).toContain('网络超时')
    })

    it('should create error with newlines in message', () => {
      const error = validationError('Line 1\nLine 2\nLine 3')
      expect(error.message).toContain('\n')
    })

    it('should create error with empty suggestions array', () => {
      const error = validationError('test', [])
      expect(error.suggestions).toEqual([])
    })

    it('should create error without suggestions', () => {
      const error = validationError('test')
      expect(error.suggestions).toBeUndefined()
    })
  })

  // =========================================================================
  // Exit Code Mapping Edge Cases
  // =========================================================================

  describe('Exit code mapping edge cases', () => {
    it('should map all validation errors to code 3', () => {
      const error = validationError('test')
      expect(errorToExitCode(error)).toBe(3)
    })

    it('should map all network errors to code 2', () => {
      const error = networkError('test')
      expect(errorToExitCode(error)).toBe(2)
    })

    it('should map all internal errors to code 2', () => {
      const error = internalError('test')
      expect(errorToExitCode(error)).toBe(2)
    })

    it('should map all not-found errors to code 2', () => {
      const error = notFoundError('test')
      expect(errorToExitCode(error)).toBe(2)
    })

    it('should map custom error type to code 2 (default)', () => {
      const error = createCliError('CUSTOM', 'unknown-type' as any, 'test')
      expect(errorToExitCode(error)).toBe(2)
    })
  })

  // =========================================================================
  // Error Formatting Edge Cases
  // =========================================================================

  describe('Error formatting edge cases', () => {
    it('should format error without suggestions', () => {
      const error = validationError('test')
      const formatted = formatErrorForStderr(error, false)

      expect(formatted).toContain('Error: test')
      expect(formatted).toContain('Code: INVALID_INPUT')
      expect(formatted).not.toContain('Suggestions:')
    })

    it('should format error with empty suggestions', () => {
      const error = validationError('test', [])
      const formatted = formatErrorForStderr(error, false)

      expect(formatted).not.toContain('Suggestions:')
    })

    it('should format error with multiple suggestions', () => {
      const error = validationError('test', ['Fix 1', 'Fix 2', 'Fix 3'])
      const formatted = formatErrorForStderr(error, false)

      expect(formatted).toContain('Fix 1')
      expect(formatted).toContain('Fix 2')
      expect(formatted).toContain('Fix 3')
    })

    it('should not include ANSI codes when color is false', () => {
      const error = validationError('test')
      const formatted = formatErrorForStderr(error, false)

      expect(formatted).not.toMatch(/\x1b\[[0-9;]*m/)
    })

    it('should include ANSI codes when color is true', () => {
      const error = validationError('test')
      const formatted = formatErrorForStderr(error, true)

      expect(formatted).toMatch(/\x1b\[[0-9;]*m/)
    })

    it('should format error as valid JSON', () => {
      const error = validationError('test with "quotes"')
      const formatted = formatErrorForJson(error)

      const parsed = JSON.parse(formatted)
      expect(parsed.error).toBeDefined()
      expect(parsed.error.code).toBe('INVALID_INPUT')
      expect(parsed.error.message).toBe('test with "quotes"')
    })

    it('should format network error as recoverable', () => {
      const error = networkError('timeout')
      const formatted = formatErrorForStderr(error, false)

      expect(formatted).toContain('transient')
    })

    it('should not show recoverable message for non-recoverable errors', () => {
      const error = validationError('bad input')
      const formatted = formatErrorForStderr(error, false)

      expect(formatted).not.toContain('transient')
    })
  })

  // =========================================================================
  // Output File Edge Cases
  // =========================================================================

  describe('Output file writing edge cases', () => {
    it('should handle writing to file with --output flag', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeScanCommand } = await import('../commands/scan')
      const exitCode = await executeScanCommand({
        format: 'json',
        color: false,
        quiet: true,
        output: '/tmp/manel-test-scan.json',
      })

      expect(exitCode).toBe(0)
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/tmp/manel-test-scan.json',
        expect.any(String),
        'utf-8'
      )
    })

    it('should not write to file when --output is not specified', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeScanCommand } = await import('../commands/scan')
      await executeScanCommand({ format: 'json', color: false, quiet: true })

      expect(mockWriteFile).not.toHaveBeenCalled()
    })

    it('should write valid content to file', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeScanCommand } = await import('../commands/scan')
      await executeScanCommand({
        format: 'json',
        color: false,
        quiet: true,
        output: '/tmp/manel-test.json',
      })

      const writtenContent = mockWriteFile.mock.calls[0][1]
      const parsed = JSON.parse(writtenContent)
      expect(parsed.ok).toBe(true)
    })
  })

  // =========================================================================
  // Schema Command Edge Cases
  // =========================================================================

  describe('Schema command edge cases', () => {
    it('should produce schema that is valid JSON', async () => {
      let stdoutOutput = ''
      const origWrite = process.stdout.write
      process.stdout.write = vi.fn((chunk: string | Uint8Array) => {
        stdoutOutput += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
        return true
      }) as any

      try {
        const { executeSchemaCommand } = await import('../commands/schema')
        await executeSchemaCommand(createProgram(), { color: false })

        expect(() => JSON.parse(stdoutOutput)).not.toThrow()
      } finally {
        process.stdout.write = origWrite
      }
    })

    it('should include schema version matching package version', async () => {
      let stdoutOutput = ''
      const origWrite = process.stdout.write
      process.stdout.write = vi.fn((chunk: string | Uint8Array) => {
        stdoutOutput += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
        return true
      }) as any

      try {
        const { executeSchemaCommand } = await import('../commands/schema')
        await executeSchemaCommand(createProgram(), { color: false })

        const parsed = JSON.parse(stdoutOutput)
        expect(parsed.version).toBe(PACKAGE_VERSION)
      } finally {
        process.stdout.write = origWrite
      }
    })

    it('should include description field', async () => {
      let stdoutOutput = ''
      const origWrite = process.stdout.write
      process.stdout.write = vi.fn((chunk: string | Uint8Array) => {
        stdoutOutput += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
        return true
      }) as any

      try {
        const { executeSchemaCommand } = await import('../commands/schema')
        await executeSchemaCommand(createProgram(), { color: false })

        const parsed = JSON.parse(stdoutOutput)
        expect(typeof parsed.description).toBe('string')
        expect(parsed.description.length).toBeGreaterThan(0)
      } finally {
        process.stdout.write = origWrite
      }
    })

    it('should include global flags', async () => {
      let stdoutOutput = ''
      const origWrite = process.stdout.write
      process.stdout.write = vi.fn((chunk: string | Uint8Array) => {
        stdoutOutput += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
        return true
      }) as any

      try {
        const { executeSchemaCommand } = await import('../commands/schema')
        await executeSchemaCommand(createProgram(), { color: false })

        const parsed = JSON.parse(stdoutOutput)
        expect(parsed.globalFlags).toBeDefined()
        expect(Array.isArray(parsed.globalFlags)).toBe(true)
        expect(parsed.globalFlags.length).toBeGreaterThan(0)
      } finally {
        process.stdout.write = origWrite
      }
    })
  })

  // =========================================================================
  // Command Execution Without Arguments
  // =========================================================================

  describe('Commands with minimal options', () => {
    it('should execute status with only format specified', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeStatusCommand } = await import('../commands/status')
      const exitCode = await executeStatusCommand({ format: 'json' })

      expect(exitCode).toBe(0)
    })

    it('should execute scan with only format specified', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeScanCommand } = await import('../commands/scan')
      const exitCode = await executeScanCommand({ format: 'json' })

      expect([0, 1]).toContain(exitCode)
    })

    it('should execute score with only format specified', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeScoreCommand } = await import('../commands/score')
      const exitCode = await executeScoreCommand({ format: 'json' })

      expect(exitCode).toBe(0)
    })

    it('should execute updates with only format specified', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeUpdatesCommand } = await import('../commands/updates')
      const exitCode = await executeUpdatesCommand({ format: 'json' })

      expect(exitCode).toBe(0)
    })

    it('should execute vulnerabilities with only format specified', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeVulnerabilitiesCommand } = await import('../commands/vulnerabilities')
      const exitCode = await executeVulnerabilitiesCommand({ format: 'json' })

      expect([0, 1]).toContain(exitCode)
    })
  })

  // =========================================================================
  // Severity Filter and Fail-On Combinations
  // =========================================================================

  describe('Severity filter and fail-on combinations', () => {
    it('should handle scan with severity filter', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeScanCommand } = await import('../commands/scan')
      const exitCode = await executeScanCommand({
        format: 'json',
        color: false,
        quiet: true,
        severity: 'CRITICAL,HIGH',
      })

      expect([0, 1]).toContain(exitCode)
    })

    it('should handle scan with fail-on severity', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeScanCommand } = await import('../commands/scan')
      const exitCode = await executeScanCommand({
        format: 'json',
        color: false,
        quiet: true,
        failOn: 'critical',
      })

      expect([0, 1]).toContain(exitCode)
    })

    it('should handle vulnerabilities with severity filter', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeVulnerabilitiesCommand } = await import('../commands/vulnerabilities')
      const exitCode = await executeVulnerabilitiesCommand({
        format: 'json',
        color: false,
        quiet: true,
        severity: 'MEDIUM',
      })

      expect([0, 1]).toContain(exitCode)
    })
  })

  // =========================================================================
  // Color Mode Edge Cases
  // =========================================================================

  describe('Color mode edge cases', () => {
    it('should produce output without ANSI when --no-color', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      let captured = ''
      const origWrite = process.stdout.write
      process.stdout.write = vi.fn((chunk: string | Uint8Array) => {
        captured += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
        return true
      }) as any

      try {
        const { executeScoreCommand } = await import('../commands/score')
        await executeScoreCommand({ format: 'json', color: false, quiet: true })

        // JSON output should not contain ANSI codes
        expect(captured).not.toMatch(/\x1b\[[0-9;]*m/)
      } finally {
        process.stdout.write = origWrite
      }
    })

    it('should produce table output without ANSI when color is false', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      let captured = ''
      const origWrite = process.stdout.write
      process.stdout.write = vi.fn((chunk: string | Uint8Array) => {
        captured += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
        return true
      }) as any

      try {
        const { executeScoreCommand } = await import('../commands/score')
        await executeScoreCommand({ format: 'table', color: false, quiet: true })

        // Table output without color should not contain ANSI escape codes
        expect(captured).not.toMatch(/\x1b\[[0-9;]*m/)
      } finally {
        process.stdout.write = origWrite
      }
    })
  })
})
