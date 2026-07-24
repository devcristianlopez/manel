/**
 * Schema Command Tests for Manel CLI
 *
 * Verifies that `manel schema` produces a valid, complete, and useful
 * JSON schema describing the CLI's capabilities.
 *
 * @module cli/__tests__/schema.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock fs/promises for output writing
vi.mock('fs/promises', () => ({
  default: {
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
  writeFile: vi.fn().mockResolvedValue(undefined),
}))

import { createProgram } from '../index'
import type { ToolSchema, CommandSchema, FlagSchema } from '../../shared/types'

// Read version dynamically from package.json
import { readFileSync } from 'fs'
import { join } from 'path'
const PACKAGE_VERSION = JSON.parse(
  readFileSync(join(process.cwd(), 'package.json'), 'utf-8')
).version

describe('Schema Command', () => {
  let stdoutOutput: string
  let originalStdoutWrite: typeof process.stdout.write

  beforeEach(() => {
    stdoutOutput = ''
    originalStdoutWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = vi.fn((chunk: string | Uint8Array) => {
      stdoutOutput += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
      return true
    }) as any
  })

  afterEach(() => {
    process.stdout.write = originalStdoutWrite
  })

  // =========================================================================
  // Basic Schema Output
  // =========================================================================

  describe('Basic schema output', () => {
    it('should produce valid JSON', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      const exitCode = await executeSchemaCommand(createProgram(), { color: false })

      expect(exitCode).toBe(0)
      expect(() => JSON.parse(stdoutOutput)).not.toThrow()
    })

    it('should return exit code 0 on success', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      const exitCode = await executeSchemaCommand(createProgram(), { color: false })

      expect(exitCode).toBe(0)
    })

    it('should include tool name "manel"', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      expect(schema.name).toBe('manel')
    })

    it('should include version string', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      expect(typeof schema.version).toBe('string')
      expect(schema.version.length).toBeGreaterThan(0)
    })

    it('should include description string', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      expect(typeof schema.description).toBe('string')
      expect(schema.description.length).toBeGreaterThan(0)
    })
  })

  // =========================================================================
  // Command Completeness
  // =========================================================================

  describe('Command completeness', () => {
    it('should include all 9 commands', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      expect(schema.commands).toHaveLength(9)
    })

    it('should include status command', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      const statusCmd = schema.commands.find(c => c.name === 'status')
      expect(statusCmd).toBeDefined()
      expect(typeof statusCmd!.description).toBe('string')
      expect(statusCmd!.description.length).toBeGreaterThan(0)
    })

    it('should include scan command', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      const scanCmd = schema.commands.find(c => c.name === 'scan')
      expect(scanCmd).toBeDefined()
    })

    it('should include vulnerabilities command', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      const vulnsCmd = schema.commands.find(c => c.name === 'vulnerabilities')
      expect(vulnsCmd).toBeDefined()
    })

    it('should include hardening command', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      const hardeningCmd = schema.commands.find(c => c.name === 'hardening')
      expect(hardeningCmd).toBeDefined()
    })

    it('should include score command', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      const scoreCmd = schema.commands.find(c => c.name === 'score')
      expect(scoreCmd).toBeDefined()
    })

    it('should include updates command', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      const updatesCmd = schema.commands.find(c => c.name === 'updates')
      expect(updatesCmd).toBeDefined()
    })

    it('should include schema command', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      const schemaCmd = schema.commands.find(c => c.name === 'schema')
      expect(schemaCmd).toBeDefined()
    })

    it('should have all commands with name, description, flags, and examples', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      for (const cmd of schema.commands) {
        expect(typeof cmd.name).toBe('string')
        expect(typeof cmd.description).toBe('string')
        expect(Array.isArray(cmd.flags)).toBe(true)
        expect(Array.isArray(cmd.examples)).toBe(true)
      }
    })
  })

  // =========================================================================
  // Flag Completeness
  // =========================================================================

  describe('Flag completeness', () => {
    it('should include global flags', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      expect(schema.globalFlags).toBeDefined()
      expect(Array.isArray(schema.globalFlags)).toBe(true)
      expect(schema.globalFlags.length).toBeGreaterThan(0)
    })

    it('should include --format flag in global flags', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      const formatFlag = schema.globalFlags.find(f => f.name === '--format')
      expect(formatFlag).toBeDefined()
      expect(formatFlag!.type).toBe('enum')
      expect(formatFlag!.enum).toContain('json')
      expect(formatFlag!.enum).toContain('table')
      expect(formatFlag!.enum).toContain('sarif')
      expect(formatFlag!.enum).toContain('ndjson')
    })

    it('should include --output flag in global flags', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      const outputFlag = schema.globalFlags.find(f => f.name === '--output')
      expect(outputFlag).toBeDefined()
      expect(outputFlag!.type).toBe('string')
    })

    it('should include --no-color flag in global flags', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      const noColorFlag = schema.globalFlags.find(f => f.name === '--no-color')
      expect(noColorFlag).toBeDefined()
      expect(noColorFlag!.type).toBe('boolean')
    })

    it('should include --quiet flag in global flags', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      const quietFlag = schema.globalFlags.find(f => f.name === '--quiet')
      expect(quietFlag).toBeDefined()
      expect(quietFlag!.type).toBe('boolean')
    })

    it('should include --verbose flag in global flags', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      const verboseFlag = schema.globalFlags.find(f => f.name === '--verbose')
      expect(verboseFlag).toBeDefined()
      expect(verboseFlag!.type).toBe('boolean')
    })

    it('should have scan command with --severity flag', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      const scanCmd = schema.commands.find(c => c.name === 'scan')
      const severityFlag = scanCmd!.flags.find(f => f.name === '--severity')
      expect(severityFlag).toBeDefined()
      expect(severityFlag!.type).toBe('string')
    })

    it('should have scan command with --fail-on flag', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      const scanCmd = schema.commands.find(c => c.name === 'scan')
      const failOnFlag = scanCmd!.flags.find(f => f.name === '--fail-on')
      expect(failOnFlag).toBeDefined()
      expect(failOnFlag!.type).toBe('enum')
      expect(failOnFlag!.enum).toContain('critical')
      expect(failOnFlag!.enum).toContain('high')
      expect(failOnFlag!.enum).toContain('medium')
      expect(failOnFlag!.enum).toContain('low')
    })

    it('should have all flags with required properties', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      const allFlags = [
        ...schema.globalFlags,
        ...schema.commands.flatMap(c => c.flags),
      ]

      for (const flag of allFlags) {
        expect(typeof flag.name).toBe('string')
        expect(flag.name.startsWith('--')).toBe(true)
        expect(typeof flag.description).toBe('string')
        expect(flag.description.length).toBeGreaterThan(0)
        expect(['string', 'boolean', 'enum']).toContain(flag.type)
        expect(typeof flag.required).toBe('boolean')
      }
    })
  })

  // =========================================================================
  // Flag Short Aliases
  // =========================================================================

  describe('Flag short aliases', () => {
    it('should include short alias for --format (-f)', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      const formatFlag = schema.globalFlags.find(f => f.name === '--format')
      expect(formatFlag!.short).toBe('-f')
    })

    it('should include short alias for --output (-o)', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      const outputFlag = schema.globalFlags.find(f => f.name === '--output')
      expect(outputFlag!.short).toBe('-o')
    })

    it('should include short alias for --quiet (-q)', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      const quietFlag = schema.globalFlags.find(f => f.name === '--quiet')
      expect(quietFlag!.short).toBe('-q')
    })

    it('should include short alias for --verbose (-V)', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      const verboseFlag = schema.globalFlags.find(f => f.name === '--verbose')
      expect(verboseFlag!.short).toBe('-V')
    })

    it('should include short alias for --severity (-s) in scan command', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      const scanCmd = schema.commands.find(c => c.name === 'scan')
      const severityFlag = scanCmd!.flags.find(f => f.name === '--severity')
      expect(severityFlag!.short).toBe('-s')
    })
  })

  // =========================================================================
  // Examples
  // =========================================================================

  describe('Command examples', () => {
    it('should have at least one example per command', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      for (const cmd of schema.commands) {
        expect(cmd.examples.length).toBeGreaterThanOrEqual(1)
      }
    })

    it('should have examples that reference the correct command or its alias', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      // The vulnerabilities command uses alias "vulns" in examples
      const aliases: Record<string, string[]> = {
        vulnerabilities: ['vulnerabilities', 'vulns'],
      }

      for (const cmd of schema.commands) {
        const validNames = aliases[cmd.name] ?? [cmd.name]
        for (const example of cmd.examples) {
          expect(example).toContain('manel')
          const matchesName = validNames.some(name => example.includes(name))
          expect(matchesName).toBe(true)
        }
      }
    })

    it('should have status command examples including format flag', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      const statusCmd = schema.commands.find(c => c.name === 'status')
      const hasFormatExample = statusCmd!.examples.some(e => e.includes('--format'))
      expect(hasFormatExample).toBe(true)
    })

    it('should have scan command examples including severity flag', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      const scanCmd = schema.commands.find(c => c.name === 'scan')
      const hasSeverityExample = scanCmd!.examples.some(e => e.includes('--severity') || e.includes('--fail-on'))
      expect(hasSeverityExample).toBe(true)
    })
  })

  // =========================================================================
  // Schema Consistency with Program
  // =========================================================================

  describe('Schema consistency with program', () => {
    it('should have same command count as program', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      const program = createProgram()
      const programCommandCount = program.commands.length

      expect(schema.commands.length).toBe(programCommandCount)
    })

    it('should have same command names as program', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput) as ToolSchema
      const program = createProgram()
      const programCommandNames = program.commands.map(c => c.name()).sort()
      const schemaCommandNames = schema.commands.map(c => c.name).sort()

      expect(schemaCommandNames).toEqual(programCommandNames)
    })
  })

  // =========================================================================
  // Output to File
  // =========================================================================

  describe('Schema output to file', () => {
    it('should write schema to file when --output is specified', async () => {
      const mockWriteFile = vi.fn().mockResolvedValue(undefined)
      vi.doMock('fs/promises', () => ({
        default: { writeFile: mockWriteFile },
        writeFile: mockWriteFile,
      }))

      const { executeSchemaCommand } = await import('../commands/schema')
      const exitCode = await executeSchemaCommand(createProgram(), {
        color: false,
        output: '/tmp/manel-schema.json',
      })

      expect(exitCode).toBe(0)
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/tmp/manel-schema.json',
        expect.any(String),
        'utf-8'
      )

      // Verify the written content is valid JSON
      const writtenContent = mockWriteFile.mock.calls[0][1]
      const parsed = JSON.parse(writtenContent)
      expect(parsed.name).toBe('manel')
    })
  })

  // =========================================================================
  // Machine Readability
  // =========================================================================

  describe('Machine readability', () => {
    it('should be parseable as ToolSchema type', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')
      await executeSchemaCommand(createProgram(), { color: false })

      const schema = JSON.parse(stdoutOutput)

      // Validate it matches ToolSchema interface
      expect(typeof schema.name).toBe('string')
      expect(typeof schema.version).toBe('string')
      expect(typeof schema.description).toBe('string')
      expect(Array.isArray(schema.commands)).toBe(true)
      expect(Array.isArray(schema.globalFlags)).toBe(true)

      // Validate CommandSchema shape
      for (const cmd of schema.commands) {
        expect(typeof cmd.name).toBe('string')
        expect(typeof cmd.description).toBe('string')
        expect(Array.isArray(cmd.flags)).toBe(true)
        expect(Array.isArray(cmd.examples)).toBe(true)

        // Validate FlagSchema shape
        for (const flag of cmd.flags) {
          expect(typeof flag.name).toBe('string')
          expect(typeof flag.description).toBe('string')
          expect(typeof flag.type).toBe('string')
          expect(typeof flag.required).toBe('boolean')
        }
      }

      // Validate global FlagSchema shape
      for (const flag of schema.globalFlags) {
        expect(typeof flag.name).toBe('string')
        expect(typeof flag.description).toBe('string')
        expect(typeof flag.type).toBe('string')
        expect(typeof flag.required).toBe('boolean')
      }
    })

    it('should be stable across multiple invocations', async () => {
      const { executeSchemaCommand } = await import('../commands/schema')

      await executeSchemaCommand(createProgram(), { color: false })
      const firstOutput = stdoutOutput

      stdoutOutput = ''
      await executeSchemaCommand(createProgram(), { color: false })
      const secondOutput = stdoutOutput

      // The schema should be deterministic
      const firstSchema = JSON.parse(firstOutput)
      const secondSchema = JSON.parse(secondOutput)

      expect(firstSchema).toEqual(secondSchema)
    })
  })
})
