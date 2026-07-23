/**
 * Tests for Manel CLI Framework
 *
 * Tests the CLI entry point, command registration, and shared utilities.
 *
 * @module cli/__tests__/cli.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Command } from 'commander'

// Mock child_process for scanner
vi.mock('child_process', () => {
  const mockExecSync = vi.fn()
  return {
    default: { execSync: mockExecSync },
    execSync: mockExecSync,
  }
})

// Mock fs for output writing
vi.mock('fs/promises', () => ({
  default: {
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
  writeFile: vi.fn().mockResolvedValue(undefined),
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

const mockExecSync = execSync as ReturnType<typeof vi.fn>

describe('CLI Framework', () => {
  beforeEach(() => {
    mockExecSync.mockReset()
  })

  describe('Program Creation', () => {
    it('should create a program with correct name', () => {
      const program = createProgram()
      expect(program.name()).toBe('manel')
    })

    it('should have all required commands', () => {
      const program = createProgram()
      const commands = program.commands.map(c => c.name())
      
      expect(commands).toContain('status')
      expect(commands).toContain('scan')
      expect(commands).toContain('vulnerabilities')
      expect(commands).toContain('hardening')
      expect(commands).toContain('score')
      expect(commands).toContain('updates')
      expect(commands).toContain('schema')
    })

    it('should have version flag', () => {
      const program = createProgram()
      const options = program.options.map(o => o.long)
      
      expect(options).toContain('--version')
    })
  })

  describe('Flags Module', () => {
    describe('isValidFormat', () => {
      it('should accept valid formats', () => {
        expect(isValidFormat('table')).toBe(true)
        expect(isValidFormat('json')).toBe(true)
        expect(isValidFormat('sarif')).toBe(true)
        expect(isValidFormat('ndjson')).toBe(true)
      })

      it('should reject invalid formats', () => {
        expect(isValidFormat('xml')).toBe(false)
        expect(isValidFormat('csv')).toBe(false)
        expect(isValidFormat('')).toBe(false)
      })
    })

    describe('isValidSeverity', () => {
      it('should accept valid severities', () => {
        expect(isValidSeverity('CRITICAL')).toBe(true)
        expect(isValidSeverity('HIGH')).toBe(true)
        expect(isValidSeverity('MEDIUM')).toBe(true)
        expect(isValidSeverity('LOW')).toBe(true)
        expect(isValidSeverity('UNKNOWN')).toBe(true)
      })

      it('should reject invalid severities', () => {
        expect(isValidSeverity('critical')).toBe(false)
        expect(isValidSeverity('HIGH!')).toBe(false)
        expect(isValidSeverity('')).toBe(false)
      })
    })

    describe('parseSeverityFilter', () => {
      it('should parse comma-separated severities', () => {
        const result = parseSeverityFilter('CRITICAL,HIGH')
        expect(result).toEqual(['CRITICAL', 'HIGH'])
      })

      it('should handle spaces', () => {
        const result = parseSeverityFilter('CRITICAL, HIGH, MEDIUM')
        expect(result).toEqual(['CRITICAL', 'HIGH', 'MEDIUM'])
      })

      it('should filter invalid severities', () => {
        const result = parseSeverityFilter('CRITICAL,invalid,HIGH')
        expect(result).toEqual(['CRITICAL', 'HIGH'])
      })

      it('should handle single severity', () => {
        const result = parseSeverityFilter('CRITICAL')
        expect(result).toEqual(['CRITICAL'])
      })
    })

    describe('normalizeFailOn', () => {
      it('should convert to uppercase', () => {
        expect(normalizeFailOn('critical')).toBe('CRITICAL')
        expect(normalizeFailOn('high')).toBe('HIGH')
        expect(normalizeFailOn('CRITICAL')).toBe('CRITICAL')
      })
    })
  })

  describe('Errors Module', () => {
    describe('Error Factories', () => {
      it('should create CLI error', () => {
        const error = createCliError('TEST_CODE', 'internal', 'Test message', false, ['Suggestion 1'])
        
        expect(error.code).toBe('TEST_CODE')
        expect(error.type).toBe('internal')
        expect(error.message).toBe('Test message')
        expect(error.recoverable).toBe(false)
        expect(error.suggestions).toEqual(['Suggestion 1'])
      })

      it('should create validation error', () => {
        const error = validationError('Invalid input')
        
        expect(error.code).toBe('INVALID_INPUT')
        expect(error.type).toBe('validation')
        expect(error.message).toBe('Invalid input')
        expect(error.recoverable).toBe(false)
      })

      it('should create network error', () => {
        const error = networkError('Connection timeout')
        
        expect(error.code).toBe('NETWORK_TIMEOUT')
        expect(error.type).toBe('network')
        expect(error.message).toBe('Connection timeout')
        expect(error.recoverable).toBe(true)
      })

      it('should create internal error', () => {
        const error = internalError('Something went wrong')
        
        expect(error.code).toBe('INTERNAL_ERROR')
        expect(error.type).toBe('internal')
        expect(error.message).toBe('Something went wrong')
        expect(error.recoverable).toBe(false)
      })

      it('should create not-found error', () => {
        const error = notFoundError('File not found')
        
        expect(error.code).toBe('FILE_NOT_FOUND')
        expect(error.type).toBe('not-found')
        expect(error.message).toBe('File not found')
        expect(error.recoverable).toBe(false)
      })
    })

    describe('Exit Code Mapping', () => {
      it('should map validation errors to INVALID_INPUT', () => {
        const error = validationError('test')
        expect(errorToExitCode(error)).toBe(3)
      })

      it('should map network errors to ERROR', () => {
        const error = networkError('test')
        expect(errorToExitCode(error)).toBe(2)
      })

      it('should map internal errors to ERROR', () => {
        const error = internalError('test')
        expect(errorToExitCode(error)).toBe(2)
      })

      it('should map not-found errors to ERROR', () => {
        const error = notFoundError('test')
        expect(errorToExitCode(error)).toBe(2)
      })
    })

    describe('Error Formatting', () => {
      it('should format error for stderr', () => {
        const error = validationError('Invalid input', ['Try again'])
        const formatted = formatErrorForStderr(error, false)
        
        expect(formatted).toContain('Error: Invalid input')
        expect(formatted).toContain('Code: INVALID_INPUT')
        expect(formatted).toContain('Suggestions:')
        expect(formatted).toContain('Try again')
      })

      it('should format error for JSON', () => {
        const error = validationError('Invalid input')
        const formatted = formatErrorForJson(error)
        
        const parsed = JSON.parse(formatted)
        expect(parsed.error.code).toBe('INVALID_INPUT')
        expect(parsed.error.message).toBe('Invalid input')
      })

      it('should handle recoverable errors', () => {
        const error = networkError('Timeout')
        const formatted = formatErrorForStderr(error, false)
        
        expect(formatted).toContain('This error may be transient')
      })
    })
  })

  describe('Command Registration', () => {
    it('should register status command with correct options', () => {
      const program = createProgram()
      const statusCmd = program.commands.find(c => c.name() === 'status')
      
      expect(statusCmd).toBeDefined()
      expect(statusCmd!.description()).toContain('Detect all installed technologies')
      
      const options = statusCmd!.options.map(o => o.long)
      expect(options).toContain('--format')
      expect(options).toContain('--output')
      expect(options).toContain('--no-color')
      expect(options).toContain('--quiet')
      expect(options).toContain('--verbose')
      expect(options).toContain('--no-interactive')
    })

    it('should register scan command with severity options', () => {
      const program = createProgram()
      const scanCmd = program.commands.find(c => c.name() === 'scan')
      
      expect(scanCmd).toBeDefined()
      expect(scanCmd!.description()).toContain('complete security scan')
      
      const options = scanCmd!.options.map(o => o.long)
      expect(options).toContain('--severity')
      expect(options).toContain('--fail-on')
    })

    it('should register vulnerabilities command with alias', () => {
      const program = createProgram()
      const vulnsCmd = program.commands.find(c => c.name() === 'vulnerabilities')
      
      expect(vulnsCmd).toBeDefined()
      expect(vulnsCmd!.aliases()).toContain('vulns')
    })

    it('should register hardening command', () => {
      const program = createProgram()
      const hardeningCmd = program.commands.find(c => c.name() === 'hardening')
      
      expect(hardeningCmd).toBeDefined()
      expect(hardeningCmd!.description()).toContain('Linux only')
    })

    it('should register score command', () => {
      const program = createProgram()
      const scoreCmd = program.commands.find(c => c.name() === 'score')
      
      expect(scoreCmd).toBeDefined()
      expect(scoreCmd!.description()).toContain('security score')
    })

    it('should register updates command', () => {
      const program = createProgram()
      const updatesCmd = program.commands.find(c => c.name() === 'updates')
      
      expect(updatesCmd).toBeDefined()
      expect(updatesCmd!.description()).toContain('available updates')
    })

    it('should register schema command', () => {
      const program = createProgram()
      const schemaCmd = program.commands.find(c => c.name() === 'schema')
      
      expect(schemaCmd).toBeDefined()
      expect(schemaCmd!.description()).toContain('machine-readable')
    })
  })

  describe('Command Execution', () => {
    it('should execute status command', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')
      
      const { executeStatusCommand } = await import('../commands/status')
      const exitCode = await executeStatusCommand({ format: 'json' })
      
      expect(exitCode).toBe(0)
    })

    it('should execute scan command', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')
      
      const { executeScanCommand } = await import('../commands/scan')
      const exitCode = await executeScanCommand({ format: 'json', quiet: true })
      
      expect(exitCode).toBe(0)
    })

    it('should execute vulnerabilities command', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')
      
      const { executeVulnerabilitiesCommand } = await import('../commands/vulnerabilities')
      const exitCode = await executeVulnerabilitiesCommand({ format: 'json', quiet: true })
      
      expect(exitCode).toBe(0)
    })

    it('should execute hardening command on Linux', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' })
      
      const { executeHardeningCommand } = await import('../commands/hardening')
      const exitCode = await executeHardeningCommand({ format: 'json', quiet: true })
      
      // Exit code 0 (all pass) or 1 (some failures) are both valid
      expect([0, 1]).toContain(exitCode)
    })

    it('should execute hardening command on non-Linux', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' })
      
      const { executeHardeningCommand } = await import('../commands/hardening')
      const exitCode = await executeHardeningCommand({ format: 'json', quiet: true })
      
      expect(exitCode).toBe(3)
    })

    it('should execute score command', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')
      
      const { executeScoreCommand } = await import('../commands/score')
      const exitCode = await executeScoreCommand({ format: 'json', quiet: true })
      
      expect(exitCode).toBe(0)
    })

    it('should execute updates command', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')
      
      const { executeUpdatesCommand } = await import('../commands/updates')
      const exitCode = await executeUpdatesCommand({ format: 'json', quiet: true })
      
      expect(exitCode).toBe(0)
    })

    it('should execute schema command', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      const exitCode = await executeSchemaCommand({})
      
      expect(exitCode).toBe(0)
    })
  })
})
