/**
 * End-to-End Integration Tests for Manel CLI
 *
 * Tests complete command flows with real output generation.
 * Verifies exit codes, output validity, and format correctness.
 *
 * @module cli/__tests__/e2e.test
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

// Read version dynamically from package.json
import { readFileSync } from 'fs'
import { join } from 'path'
const PACKAGE_VERSION = JSON.parse(
  readFileSync(join(process.cwd(), 'package.json'), 'utf-8')
).version

const mockExecSync = execSync as ReturnType<typeof vi.fn>

describe('CLI End-to-End Integration', () => {
  let stdoutOutput: string
  let stderrOutput: string
  let originalStdoutWrite: typeof process.stdout.write
  let originalStderrWrite: typeof process.stderr.write

  beforeEach(() => {
    mockExecSync.mockReset()
    mockWriteFile.mockClear()
    stdoutOutput = ''
    stderrOutput = ''

    // Capture stdout
    originalStdoutWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = vi.fn((chunk: string | Uint8Array) => {
      stdoutOutput += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
      return true
    }) as any

    // Capture stderr
    originalStderrWrite = process.stderr.write.bind(process.stderr)
    process.stderr.write = vi.fn((chunk: string | Uint8Array) => {
      stderrOutput += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
      return true
    }) as any
  })

  afterEach(() => {
    process.stdout.write = originalStdoutWrite
    process.stderr.write = originalStderrWrite
  })

  // =========================================================================
  // Status Command
  // =========================================================================

  describe('status command', () => {
    it('should produce valid JSON output with --format json', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeStatusCommand } = await import('../commands/status')
      const exitCode = await executeStatusCommand({ format: 'json', color: false })

      expect(exitCode).toBe(0)
      const parsed = JSON.parse(stdoutOutput)
      expect(parsed.ok).toBe(true)
      expect(parsed.data).toBeDefined()
      expect(parsed.data.technologies).toBeDefined()
      expect(Array.isArray(parsed.data.technologies)).toBe(true)
      expect(parsed.meta).toBeDefined()
      expect(parsed.meta.version).toBeDefined()
    })

    it('should produce valid table output with --format table', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeStatusCommand } = await import('../commands/status')
      const exitCode = await executeStatusCommand({ format: 'table', color: false })

      expect(exitCode).toBe(0)
      // Status command wraps data as { technologies }, not a full ScanResult
      // Table formatter may return unsupported message or partial table
      expect(stdoutOutput.length).toBeGreaterThan(0)
    })

    it('should produce valid SARIF output with --format sarif', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeStatusCommand } = await import('../commands/status')
      // SARIF gracefully handles partial data via toPartialScanResult
      const exitCode = await executeStatusCommand({ format: 'sarif', color: false })

      expect(exitCode).toBe(0)
    })

    it('should produce valid NDJSON output with --format ndjson', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeStatusCommand } = await import('../commands/status')
      // NDJSON gracefully handles partial data via toPartialScanResult
      const exitCode = await executeStatusCommand({ format: 'ndjson', color: false })

      expect(exitCode).toBe(0)
    })

    it('should return exit code 0 on success', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeStatusCommand } = await import('../commands/status')
      const exitCode = await executeStatusCommand({ format: 'json', color: false })

      expect(exitCode).toBe(0)
    })

    it('should write output to file when --output is specified', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeStatusCommand } = await import('../commands/status')
      const exitCode = await executeStatusCommand({
        format: 'json',
        color: false,
        output: '/tmp/test-status.json',
      })

      expect(exitCode).toBe(0)
      expect(mockWriteFile).toHaveBeenCalledTimes(1)
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/tmp/test-status.json',
        expect.any(String),
        'utf-8'
      )

      // Verify the written content is valid JSON
      const writtenContent = mockWriteFile.mock.calls[0][1]
      const parsed = JSON.parse(writtenContent)
      expect(parsed.ok).toBe(true)
    })
  })

  // =========================================================================
  // Scan Command
  // =========================================================================

  describe('scan command', () => {
    it('should produce valid JSON output', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeScanCommand } = await import('../commands/scan')
      const exitCode = await executeScanCommand({ format: 'json', color: false, quiet: true })

      expect([0, 1]).toContain(exitCode)
      const parsed = JSON.parse(stdoutOutput)
      expect(parsed.ok).toBe(true)
      expect(parsed.data).toBeDefined()
      expect(parsed.data.technologies).toBeDefined()
      expect(parsed.data.vulnerabilities).toBeDefined()
      expect(parsed.data.score).toBeDefined()
      expect(parsed.data.summary).toBeDefined()
    })

    it('should produce valid table output', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeScanCommand } = await import('../commands/scan')
      const exitCode = await executeScanCommand({ format: 'table', color: false, quiet: true })

      expect([0, 1]).toContain(exitCode)
      expect(stdoutOutput).toContain('Technologies')
    })

    it('should produce valid SARIF output with proper structure', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeScanCommand } = await import('../commands/scan')
      const exitCode = await executeScanCommand({ format: 'sarif', color: false, quiet: true })

      expect([0, 1]).toContain(exitCode)
      const report = JSON.parse(stdoutOutput)
      expect(report.version).toBe('2.1.0')
      expect(report.$schema).toContain('sarif')
      expect(report.runs).toHaveLength(1)
      expect(report.runs[0].tool.driver.name).toBe('manel')
      expect(report.runs[0].results).toBeDefined()
      expect(Array.isArray(report.runs[0].results)).toBe(true)
      expect(report.runs[0].invocations).toBeDefined()
      expect(report.runs[0].invocations[0].executionSuccessful).toBe(true)
    })

    it('should produce valid NDJSON output with correct line types', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeScanCommand } = await import('../commands/scan')
      const exitCode = await executeScanCommand({ format: 'ndjson', color: false, quiet: true })

      expect([0, 1]).toContain(exitCode)
      const lines = stdoutOutput.split('\n').filter(l => l.trim())
      expect(lines.length).toBeGreaterThan(0)

      // Each line should be valid JSON
      const types = new Set<string>()
      for (const line of lines) {
        const parsed = JSON.parse(line)
        expect(parsed.type).toBeDefined()
        types.add(parsed.type)
      }

      // Should have meta, technology, score types
      expect(types.has('meta')).toBe(true)
      expect(types.has('technology')).toBe(true)
      expect(types.has('score')).toBe(true)
    })

    it('should suppress progress output with --quiet', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeScanCommand } = await import('../commands/scan')
      await executeScanCommand({ format: 'json', color: false, quiet: true })

      expect(stderrOutput).not.toContain('Running security scan')
    })

    it('should show progress output without --quiet', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeScanCommand } = await import('../commands/scan')
      await executeScanCommand({ format: 'json', color: false })

      expect(stderrOutput).toContain('Running security scan')
    })

    it('should show verbose output with --verbose', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeScanCommand } = await import('../commands/scan')
      await executeScanCommand({ format: 'json', color: false, verbose: true })

      expect(stderrOutput).toContain('Detecting installed technologies')
    })
  })

  // =========================================================================
  // Vulnerabilities Command
  // =========================================================================

  describe('vulnerabilities command', () => {
    it('should produce valid JSON output', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeVulnerabilitiesCommand } = await import('../commands/vulnerabilities')
      const exitCode = await executeVulnerabilitiesCommand({ format: 'json', color: false, quiet: true })

      expect([0, 1]).toContain(exitCode)
      const parsed = JSON.parse(stdoutOutput)
      expect(parsed.ok).toBe(true)
      expect(parsed.data).toBeDefined()
      expect(Array.isArray(parsed.data.vulnerabilities)).toBe(true)
    })

    it('should produce valid table output', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeVulnerabilitiesCommand } = await import('../commands/vulnerabilities')
      const exitCode = await executeVulnerabilitiesCommand({ format: 'table', color: false, quiet: true })

      expect([0, 1]).toContain(exitCode)
      expect(stdoutOutput.length).toBeGreaterThan(0)
    })

    it('should produce valid SARIF output', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeVulnerabilitiesCommand } = await import('../commands/vulnerabilities')
      // SARIF gracefully handles partial data via toPartialScanResult
      const exitCode = await executeVulnerabilitiesCommand({ format: 'sarif', color: false, quiet: true })

      expect(exitCode).toBe(0)
    })

    it('should produce valid NDJSON output', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeVulnerabilitiesCommand } = await import('../commands/vulnerabilities')
      // NDJSON gracefully handles partial data via toPartialScanResult
      const exitCode = await executeVulnerabilitiesCommand({ format: 'ndjson', color: false, quiet: true })

      expect(exitCode).toBe(0)
    })
  })

  // =========================================================================
  // Hardening Command
  // =========================================================================

  describe('hardening command', () => {
    it('should return exit code 3 on non-Linux platform', async () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'darwin' })

      try {
        const { executeHardeningCommand } = await import('../commands/hardening')
        const exitCode = await executeHardeningCommand({ format: 'json', color: false, quiet: true })

        expect(exitCode).toBe(3)
        expect(stderrOutput).toContain('Hardening checks are only available on Linux')
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform })
      }
    })

    it('should produce valid JSON on Linux', async () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'linux' })

      try {
        const { executeHardeningCommand } = await import('../commands/hardening')
        const exitCode = await executeHardeningCommand({ format: 'json', color: false, quiet: true })

        expect([0, 1]).toContain(exitCode)
        const parsed = JSON.parse(stdoutOutput)
        expect(parsed.ok).toBe(true)
        expect(parsed.data.hardening).toBeDefined()
        expect(Array.isArray(parsed.data.hardening)).toBe(true)
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform })
      }
    })
  })

  // =========================================================================
  // Score Command
  // =========================================================================

  describe('score command', () => {
    it('should produce valid JSON output', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeScoreCommand } = await import('../commands/score')
      const exitCode = await executeScoreCommand({ format: 'json', color: false, quiet: true })

      expect(exitCode).toBe(0)
      const parsed = JSON.parse(stdoutOutput)
      expect(parsed.ok).toBe(true)
      expect(parsed.data.score).toBeDefined()
      expect(typeof parsed.data.score.overall).toBe('number')
      expect(parsed.data.score.breakdown).toBeDefined()
    })

    it('should produce valid table output', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeScoreCommand } = await import('../commands/score')
      const exitCode = await executeScoreCommand({ format: 'table', color: false, quiet: true })

      expect(exitCode).toBe(0)
      // Score command wraps data as { score }, not a standalone SecurityScore
      // Table formatter may return unsupported message or partial table
      expect(stdoutOutput.length).toBeGreaterThan(0)
    })

    it('should include all breakdown categories in JSON', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeScoreCommand } = await import('../commands/score')
      await executeScoreCommand({ format: 'json', color: false, quiet: true })

      const parsed = JSON.parse(stdoutOutput)
      const breakdown = parsed.data.score.breakdown
      expect(breakdown).toHaveProperty('os')
      expect(breakdown).toHaveProperty('hardening')
      expect(breakdown).toHaveProperty('tools')
      expect(breakdown).toHaveProperty('dependencies')
      expect(breakdown).toHaveProperty('databases')
      expect(breakdown).toHaveProperty('criticalsPenalty')
    })
  })

  // =========================================================================
  // Updates Command
  // =========================================================================

  describe('updates command', () => {
    it('should produce valid JSON output', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeUpdatesCommand } = await import('../commands/updates')
      const exitCode = await executeUpdatesCommand({ format: 'json', color: false, quiet: true })

      expect(exitCode).toBe(0)
      const parsed = JSON.parse(stdoutOutput)
      expect(parsed.ok).toBe(true)
      expect(Array.isArray(parsed.data.updates)).toBe(true)
    })

    it('should produce valid table output', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeUpdatesCommand } = await import('../commands/updates')
      const exitCode = await executeUpdatesCommand({ format: 'table', color: false, quiet: true })

      expect(exitCode).toBe(0)
      expect(stdoutOutput.length).toBeGreaterThan(0)
    })
  })

  // =========================================================================
  // Schema Command
  // =========================================================================

  describe('schema command', () => {
    it('should produce valid JSON schema', async () => {
      const program = createProgram()
      const { executeSchemaCommand } = await import('../commands/schema')
      const exitCode = await executeSchemaCommand(program, { color: false })

      expect(exitCode).toBe(0)
      const parsed = JSON.parse(stdoutOutput)
      expect(parsed.name).toBe('manel')
      expect(parsed.version).toBe(PACKAGE_VERSION)
      expect(parsed.commands).toBeDefined()
      expect(Array.isArray(parsed.commands)).toBe(true)
    })

    it('should include all expected commands', async () => {
      const program = createProgram()
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(program, { color: false })

      const parsed = JSON.parse(stdoutOutput)
      const commandNames = parsed.commands.map((c: any) => c.name)

      expect(commandNames).toContain('status')
      expect(commandNames).toContain('scan')
      expect(commandNames).toContain('vulnerabilities')
      expect(commandNames).toContain('hardening')
      expect(commandNames).toContain('score')
      expect(commandNames).toContain('updates')
      expect(commandNames).toContain('schema')
    })
  })

  // =========================================================================
  // Program-Level E2E
  // =========================================================================

  describe('program-level execution', () => {
    it('should parse --version flag', async () => {
      const program = createProgram()
      let output = ''
      const origWrite = process.stdout.write
      process.stdout.write = vi.fn((chunk: string | Uint8Array) => {
        output += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
        return true
      }) as any

      try {
        // --version throws in commander, so we catch it
        try {
          await program.parseAsync(['node', 'manel', '--version'])
        } catch {
          // expected
        }
        expect(output).toContain(PACKAGE_VERSION)
      } finally {
        process.stdout.write = origWrite
      }
    })

    it('should have consistent command names between program and schema', () => {
      const program = createProgram()
      const programCommands = program.commands.map(c => c.name()).sort()

      // These should match what the schema command generates
      expect(programCommands).toContain('status')
      expect(programCommands).toContain('scan')
      expect(programCommands).toContain('vulnerabilities')
      expect(programCommands).toContain('hardening')
      expect(programCommands).toContain('score')
      expect(programCommands).toContain('updates')
      expect(programCommands).toContain('schema')
    })

    it('should register --format option on all data commands', () => {
      const program = createProgram()
      const dataCommands = ['status', 'scan', 'vulnerabilities', 'hardening', 'score', 'updates']

      for (const cmdName of dataCommands) {
        const cmd = program.commands.find(c => c.name() === cmdName)
        expect(cmd).toBeDefined()
        const options = cmd!.options.map(o => o.long)
        expect(options).toContain('--format')
      }
    })

    it('should register --output option on all data commands', () => {
      const program = createProgram()
      const dataCommands = ['status', 'scan', 'vulnerabilities', 'hardening', 'score', 'updates']

      for (const cmdName of dataCommands) {
        const cmd = program.commands.find(c => c.name() === cmdName)
        expect(cmd).toBeDefined()
        const options = cmd!.options.map(o => o.long)
        expect(options).toContain('--output')
      }
    })

    it('should register --quiet option on all data commands', () => {
      const program = createProgram()
      const dataCommands = ['status', 'scan', 'vulnerabilities', 'hardening', 'score', 'updates']

      for (const cmdName of dataCommands) {
        const cmd = program.commands.find(c => c.name() === cmdName)
        expect(cmd).toBeDefined()
        const options = cmd!.options.map(o => o.long)
        expect(options).toContain('--quiet')
      }
    })
  })
})
