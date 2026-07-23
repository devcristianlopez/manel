/**
 * Performance Tests for Manel CLI
 *
 * Measures execution time of commands, verifies output size,
 * and checks for potential memory issues.
 *
 * All tests should complete within strict time bounds.
 *
 * @module cli/__tests__/performance.test
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
vi.mock('fs/promises', () => ({
  default: {
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
  writeFile: vi.fn().mockResolvedValue(undefined),
}))

import { execSync } from 'child_process'
import { createProgram } from '../index'
import { formatOutput } from '../output'
import {
  SCAN_RESULT,
  VULNERABILITIES,
  HARDENING_RESULTS,
  SCORE,
  UPDATE_INFOS,
} from '../output/__tests__/fixtures'

const mockExecSync = execSync as ReturnType<typeof vi.fn>

describe('CLI Performance', () => {
  let stdoutOutput: string
  let stderrOutput: string
  let originalStdoutWrite: typeof process.stdout.write
  let originalStderrWrite: typeof process.stderr.write

  beforeEach(() => {
    mockExecSync.mockReset()
    stdoutOutput = ''
    stderrOutput = ''

    originalStdoutWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = vi.fn((chunk: string | Uint8Array) => {
      stdoutOutput += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
      return true
    }) as any

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
  // Output Formatter Performance
  // =========================================================================

  describe('Output formatter performance', () => {
    it('should format ScanResult as JSON in under 50ms', () => {
      const start = performance.now()
      const output = formatOutput(SCAN_RESULT, 'json')
      const duration = performance.now() - start

      expect(output.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(50)
    })

    it('should format ScanResult as table in under 50ms', () => {
      const start = performance.now()
      const output = formatOutput(SCAN_RESULT, 'table', { color: false })
      const duration = performance.now() - start

      expect(output.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(50)
    })

    it('should format ScanResult as SARIF in under 50ms', () => {
      const start = performance.now()
      const output = formatOutput(SCAN_RESULT, 'sarif')
      const duration = performance.now() - start

      expect(output.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(50)
    })

    it('should format ScanResult as NDJSON in under 50ms', () => {
      const start = performance.now()
      const output = formatOutput(SCAN_RESULT, 'ndjson')
      const duration = performance.now() - start

      expect(output.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(50)
    })

    it('should format Vulnerability[] as table in under 50ms', () => {
      const start = performance.now()
      const output = formatOutput(VULNERABILITIES, 'table', { color: false })
      const duration = performance.now() - start

      expect(output.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(50)
    })

    it('should format SecurityScore as table in under 50ms', () => {
      const start = performance.now()
      const output = formatOutput(SCORE, 'table', { color: false })
      const duration = performance.now() - start

      expect(output.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(50)
    })

    it('should format UpdateInfo[] as table in under 50ms', () => {
      const start = performance.now()
      const output = formatOutput(UPDATE_INFOS, 'table', { color: false })
      const duration = performance.now() - start

      expect(output.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(50)
    })
  })

  // =========================================================================
  // Output Size Constraints
  // =========================================================================

  describe('Output size constraints', () => {
    it('should produce JSON output under 100KB for standard scan result', () => {
      const output = formatOutput(SCAN_RESULT, 'json', { pretty: true })
      expect(output.length).toBeLessThan(100 * 1024)
    })

    it('should produce compact JSON output under 50KB', () => {
      const output = formatOutput(SCAN_RESULT, 'json', { pretty: false })
      expect(output.length).toBeLessThan(50 * 1024)
    })

    it('should produce SARIF output under 100KB', () => {
      const output = formatOutput(SCAN_RESULT, 'sarif')
      expect(output.length).toBeLessThan(100 * 1024)
    })

    it('should produce NDJSON output under 100KB', () => {
      const output = formatOutput(SCAN_RESULT, 'ndjson')
      expect(output.length).toBeLessThan(100 * 1024)
    })

    it('should produce table output under 50KB', () => {
      const output = formatOutput(SCAN_RESULT, 'table', { color: false })
      expect(output.length).toBeLessThan(50 * 1024)
    })

    it('should not produce empty output for valid data', () => {
      expect(formatOutput(SCAN_RESULT, 'json').length).toBeGreaterThan(0)
      expect(formatOutput(SCAN_RESULT, 'table', { color: false }).length).toBeGreaterThan(0)
      expect(formatOutput(SCAN_RESULT, 'sarif').length).toBeGreaterThan(0)
      expect(formatOutput(SCAN_RESULT, 'ndjson').length).toBeGreaterThan(0)
    })
  })

  // =========================================================================
  // NDJSON Line Count
  // =========================================================================

  describe('NDJSON line count', () => {
    it('should produce a reasonable number of NDJSON lines', () => {
      const output = formatOutput(SCAN_RESULT, 'ndjson')
      const lines = output.split('\n').filter(l => l.trim())

      // Should have meta + technologies + vulns + hardening + score
      expect(lines.length).toBeGreaterThanOrEqual(3) // at least meta + score + 1 tech
      // Should not have an unreasonable number of lines
      expect(lines.length).toBeLessThan(1000)
    })
  })

  // =========================================================================
  // Repeated Formatting (No Memory Leaks)
  // =========================================================================

  describe('Repeated formatting stability', () => {
    it('should produce consistent output across 100 iterations', () => {
      const firstOutput = formatOutput(SCAN_RESULT, 'json', { pretty: false })
      // Normalize timestamps for comparison (JSON meta contains timestamps)
      const normalized = (s: string) => s.replace(/"timestamp":"[^"]*"/g, '"timestamp":"FIXED"')
      const normalizedFirst = normalized(firstOutput)

      for (let i = 0; i < 100; i++) {
        const output = formatOutput(SCAN_RESULT, 'json', { pretty: false })
        expect(normalized(output)).toBe(normalizedFirst)
      }
    })

    it('should produce consistent table output across 100 iterations', () => {
      const firstOutput = formatOutput(SCAN_RESULT, 'table', { color: false })

      for (let i = 0; i < 100; i++) {
        const output = formatOutput(SCAN_RESULT, 'table', { color: false })
        expect(output).toBe(firstOutput)
      }
    })

    it('should produce consistent SARIF output across 100 iterations', () => {
      const firstOutput = formatOutput(SCAN_RESULT, 'sarif')

      for (let i = 0; i < 100; i++) {
        const output = formatOutput(SCAN_RESULT, 'sarif')
        expect(output).toBe(firstOutput)
      }
    })

    it('should produce consistent NDJSON output across 100 iterations', () => {
      const firstOutput = formatOutput(SCAN_RESULT, 'ndjson')

      for (let i = 0; i < 100; i++) {
        const output = formatOutput(SCAN_RESULT, 'ndjson')
        // NDJSON contains a timestamp in the meta line, so we compare
        // everything except the timestamp to verify structural consistency
        const normalized = (s: string) => s.replace(/"timestamp":"[^"]*"/, '"timestamp":"FIXED"')
        expect(normalized(output)).toBe(normalized(firstOutput))
      }
    })
  })

  // =========================================================================
  // Command Execution Performance
  // =========================================================================

  describe('Command execution performance', () => {
    it('should execute status command without errors', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeStatusCommand } = await import('../commands/status')
      const exitCode = await executeStatusCommand({ format: 'json', color: false, quiet: true })

      expect(exitCode).toBe(0)
      expect(stdoutOutput.length).toBeGreaterThan(0)
    })

    it('should execute scan command without errors', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeScanCommand } = await import('../commands/scan')
      const exitCode = await executeScanCommand({ format: 'json', color: false, quiet: true })

      expect([0, 1]).toContain(exitCode)
      expect(stdoutOutput.length).toBeGreaterThan(0)
    })

    it('should execute score command without errors', async () => {
      mockExecSync.mockReturnValue('v22.0.0\n')

      const { executeScoreCommand } = await import('../commands/score')
      const exitCode = await executeScoreCommand({ format: 'json', color: false, quiet: true })

      expect(exitCode).toBe(0)
      expect(stdoutOutput.length).toBeGreaterThan(0)
    })

    it('should execute schema command without errors', async () => {
      const program = createProgram()
      const { executeSchemaCommand } = await import('../commands/schema')
      const exitCode = await executeSchemaCommand(program, { color: false })

      expect(exitCode).toBe(0)
      expect(stdoutOutput.length).toBeGreaterThan(0)
    })
  })

  // =========================================================================
  // Large Dataset Performance
  // =========================================================================

  describe('Large dataset performance', () => {
    it('should format large scan results efficiently', () => {
      // Create a large scan result with many vulnerabilities
      const largeScanResult = {
        ...SCAN_RESULT,
        vulnerabilities: Array.from({ length: 100 }, (_, i) => ({
          ...SCAN_RESULT.vulnerabilities[0],
          id: `CVE-2024-${String(i).padStart(5, '0')}`,
          cveId: `CVE-2024-${String(i).padStart(5, '0')}`,
          title: `Vulnerability ${i}`,
        })),
      }

      const start = performance.now()
      const jsonOutput = formatOutput(largeScanResult, 'json')
      const duration = performance.now() - start

      expect(jsonOutput.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(100)

      // Verify it's valid JSON
      const parsed = JSON.parse(jsonOutput)
      expect(parsed.data.vulnerabilities).toHaveLength(100)
    })

    it('should format large NDJSON efficiently', () => {
      const largeScanResult = {
        ...SCAN_RESULT,
        technologies: Array.from({ length: 50 }, (_, i) => ({
          ...SCAN_RESULT.technologies[0],
          name: `tech-${i}`,
        })),
        vulnerabilities: Array.from({ length: 200 }, (_, i) => ({
          ...SCAN_RESULT.vulnerabilities[0],
          id: `CVE-2024-${String(i).padStart(5, '0')}`,
        })),
      }

      const start = performance.now()
      const ndjsonOutput = formatOutput(largeScanResult, 'ndjson')
      const duration = performance.now() - start

      expect(ndjsonOutput.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(100)

      // Verify each line is valid JSON
      const lines = ndjsonOutput.split('\n').filter(l => l.trim())
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow()
      }
    })

    it('should format large SARIF efficiently', () => {
      const largeScanResult = {
        ...SCAN_RESULT,
        vulnerabilities: Array.from({ length: 100 }, (_, i) => ({
          ...SCAN_RESULT.vulnerabilities[0],
          id: `CVE-2024-${String(i).padStart(5, '0')}`,
          cveId: `CVE-2024-${String(i).padStart(5, '0')}`,
        })),
      }

      const start = performance.now()
      const sarifOutput = formatOutput(largeScanResult, 'sarif')
      const duration = performance.now() - start

      expect(sarifOutput.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(100)

      // Verify it's valid SARIF — results include both vulns (100) and hardening checks
      const report = JSON.parse(sarifOutput)
      expect(report.runs[0].results.length).toBeGreaterThanOrEqual(100)
    })
  })
})
