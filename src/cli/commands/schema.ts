/**
 * Manel CLI — Schema Command
 *
 * Provides machine-readable introspection of CLI capabilities.
 * Outputs JSON schema describing commands, flags, exit codes, etc.
 * Auto-generates schema from the Commander.js program structure.
 *
 * @module cli/commands/schema
 */

import type { Command } from 'commander'
import type { ToolSchema, CommandSchema, FlagSchema } from '../../shared/types'
import { detectTTY } from '../output'
import type { CommonFlags } from '../flags'
import { getPackageVersion } from '../version'
import { internalError, formatErrorForStderr } from '../errors'

// ============================================================================
// 1. Command Examples (stored for schema generation)
// ============================================================================

/** Pre-defined examples per command. Used by schema generation. */
const COMMAND_EXAMPLES: Record<string, string[]> = {
  status: [
    'manel status',
    'manel status --format json',
    'manel status --format sarif --output status.sarif',
  ],
  scan: [
    'manel scan',
    'manel scan --format json',
    'manel scan --format sarif --output scan.sarif',
    'manel scan --severity HIGH,CRITICAL',
    'manel scan --fail-on critical --no-color',
  ],
  vulnerabilities: [
    'manel vulnerabilities',
    'manel vulns --format json',
    'manel vulns --severity CRITICAL',
    'manel vulns --fail-on high --output vulns.json',
  ],
  hardening: [
    'manel hardening',
    'manel hardening --format json',
    'manel hardening --format sarif --output hardening.sarif',
  ],
  score: [
    'manel score',
    'manel score --format json',
    'manel score --format sarif --output score.sarif',
  ],
  updates: [
    'manel updates',
    'manel updates --format json',
    'manel updates --format table --output updates.txt',
  ],
  sync: [
    'manel sync',
    'manel sync --ecosystem npm,PyPI',
    'manel sync --force --format json',
  ],
  history: [
    'manel history',
    'manel history --last 20',
    'manel history --format json',
  ],
  schema: [
    'manel schema',
    'manel schema --output schema.json',
  ],
}

// ============================================================================
// 2. Command Registration
// ============================================================================

/**
 * Register the schema command with Commander.js.
 *
 * @param program - Commander.js program instance
 */
export function registerSchemaCommand(program: Command): void {
  program
    .command('schema')
    .description('Output machine-readable CLI schema (JSON)')
    .option('--no-color', 'Disable ANSI color output')
    .option('-o, --output <file>', 'Write output to file instead of stdout')
    .addHelpText('after', `
Examples:
  $ manel schema
  $ manel schema --output schema.json`)
    .action(async (options: CommonFlags) => {
      await executeSchemaCommand(program, options)
    })
}

// ============================================================================
// 3. Command Execution
// ============================================================================

/**
 * Execute the schema command.
 *
 * Generates and outputs the CLI schema as JSON by introspecting the program.
 *
 * @param rootProgram - The root Commander.js program (for introspection)
 * @param options - Parsed CLI options
 * @returns Exit code (0 = success, 2 = error)
 */
export async function executeSchemaCommand(
  rootProgram: Command,
  options: CommonFlags
): Promise<number> {
  const startTime = Date.now()
  const ttyInfo = detectTTY()
  const useColor = options.color ?? ttyInfo.useColor

  try {
    // Generate schema from program introspection
    const schema = generateCliSchemaFromProgram(rootProgram)

    // Format as JSON
    const formattedOutput = JSON.stringify(schema, null, 2)

    // Write output
    if (options.output) {
      const fs = await import('fs/promises')
      await fs.writeFile(options.output, formattedOutput, 'utf-8')
    } else {
      process.stdout.write(formattedOutput)
      process.stdout.write('\n')
    }

    return 0
  } catch (err) {
    const duration = Date.now() - startTime
    const error = internalError(
      err instanceof Error ? err.message : 'Unknown error during schema command'
    )

    process.stderr.write(formatErrorForStderr(error, useColor))
    return 2
  }
}

// ============================================================================
// 4. Schema Generation (Auto-generated from Commander program)
// ============================================================================

/**
 * Generate the complete CLI schema by introspecting the Commander.js program.
 *
 * @param program - The root Commander.js program
 * @returns Tool schema describing CLI capabilities
 */
function generateCliSchemaFromProgram(program: Command): ToolSchema {
  return {
    name: program.name(),
    version: getPackageVersion(),
    description: program.description(),
    commands: program.commands.map(cmd => ({
      name: cmd.name(),
      description: cmd.description(),
      flags: cmd.options.map(opt => {
        const flag: FlagSchema = {
          name: opt.long || (opt.short || ''),
          short: opt.short || undefined,
          description: opt.description,
          type: opt.negate ? 'boolean' : (opt.argChoices ? 'enum' : 'string'),
          required: false,
        }
        if (opt.defaultValue !== undefined && opt.defaultValue !== null) {
          flag.default = String(opt.defaultValue)
        }
        if (opt.argChoices) {
          flag.enum = opt.argChoices as string[]
        }
        return flag
      }),
      examples: COMMAND_EXAMPLES[cmd.name()] ?? [],
    })),
    globalFlags: [
      { name: '--format', short: '-f', description: 'Output format', type: 'enum', required: false, default: 'table', enum: ['json', 'sarif', 'table', 'ndjson'] },
      { name: '--output', short: '-o', description: 'Write output to file', type: 'string', required: false },
      { name: '--no-color', description: 'Disable ANSI color output', type: 'boolean', required: false },
      { name: '--quiet', short: '-q', description: 'Suppress non-error output', type: 'boolean', required: false },
      { name: '--verbose', short: '-V', description: 'Enable verbose output', type: 'boolean', required: false },
    ],
  }
}
