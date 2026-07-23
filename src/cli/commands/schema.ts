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
// 1. Command Registration
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
// 2. Command Execution
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
// 3. Schema Generation (Auto-generated from Commander program)
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
      examples: extractExamples(cmd),
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

/**
 * Extract example commands from a command's help text.
 * Parses the .addHelpText('after', ...) content for lines starting with '$'.
 *
 * @param cmd - Commander.js command
 * @returns Array of example strings
 */
function extractExamples(cmd: Command): string[] {
  const examples: string[] = []

  // Commander v15 uses events for addHelpText content.
  // Capture the afterHelp event output to get appended help text.
  let helpText = ''
  const listeners = cmd.rawListeners('afterHelp')
  for (const listener of listeners) {
    let captured = ''
    const context = {
      error: false,
      command: cmd,
      write: (text: string) => { captured += text },
    }
    try {
      listener(context)
    } catch {
      // Ignore errors from help text rendering
    }
    helpText += captured
  }

  // Look for lines starting with "$ "
  const lines = helpText.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('$ ')) {
      examples.push(trimmed.substring(2))
    }
  }

  return examples
}
