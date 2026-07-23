/**
 * Manel CLI — Schema Command
 *
 * Provides machine-readable introspection of CLI capabilities.
 * Outputs JSON schema describing commands, flags, exit codes, etc.
 *
 * @module cli/commands/schema
 */

import type { Command } from 'commander'
import type { ToolSchema, CommandSchema, FlagSchema } from '../../shared/types'
import { detectTTY } from '../output'
import type { CommonFlags } from '../flags'
import { successEnvelope, errorEnvelope } from '../errors'
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
    .action(async (options: CommonFlags) => {
      await executeSchemaCommand(options)
    })
}

// ============================================================================
// 2. Command Execution
// ============================================================================

/**
 * Execute the schema command.
 *
 * Generates and outputs the CLI schema as JSON.
 *
 * @param options - Parsed CLI options
 * @returns Exit code (0 = success, 2 = error)
 */
export async function executeSchemaCommand(options: CommonFlags): Promise<number> {
  const startTime = Date.now()
  const ttyInfo = detectTTY()
  const useColor = options.color ?? ttyInfo.useColor

  try {
    // Generate schema
    const schema = generateCliSchema()

    // Create response envelope
    const duration = Date.now() - startTime
    const envelope = successEnvelope(schema, duration)

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
    const envelope = errorEnvelope(error, duration)

    process.stderr.write(formatErrorForStderr(error, useColor))
    return 2
  }
}

// ============================================================================
// 3. Schema Generation
// ============================================================================

/**
 * Generate the complete CLI schema.
 *
 * @returns Tool schema describing CLI capabilities
 */
function generateCliSchema(): ToolSchema {
  return {
    name: 'manel',
    version: '0.1.0',
    description: 'Security Health Monitor for development environments',
    commands: [
      {
        name: 'status',
        description: 'Detect all installed technologies and show their status',
        flags: [
          { name: '--format', short: '-f', description: 'Output format', type: 'enum', required: false, default: 'table', enum: ['json', 'sarif', 'table', 'ndjson'] },
          { name: '--output', short: '-o', description: 'Write output to file', type: 'string', required: false },
          { name: '--no-color', description: 'Disable ANSI color output', type: 'boolean', required: false },
          { name: '--quiet', short: '-q', description: 'Suppress non-error output', type: 'boolean', required: false },
          { name: '--verbose', short: '-V', description: 'Enable verbose output', type: 'boolean', required: false },
          { name: '--no-interactive', description: 'Disable interactive prompts', type: 'boolean', required: false },
        ],
        examples: [
          'manel status',
          'manel status --format json',
          'manel status --format sarif --output status.sarif',
        ],
      },
      {
        name: 'scan',
        description: 'Perform a complete security scan of the system',
        flags: [
          { name: '--format', short: '-f', description: 'Output format', type: 'enum', required: false, default: 'table', enum: ['json', 'sarif', 'table', 'ndjson'] },
          { name: '--output', short: '-o', description: 'Write output to file', type: 'string', required: false },
          { name: '--severity', short: '-s', description: 'Filter by severity levels', type: 'string', required: false },
          { name: '--fail-on', description: 'Exit with code 1 if findings at or above severity', type: 'enum', required: false, enum: ['critical', 'high', 'medium', 'low'] },
          { name: '--no-color', description: 'Disable ANSI color output', type: 'boolean', required: false },
          { name: '--quiet', short: '-q', description: 'Suppress non-error output', type: 'boolean', required: false },
          { name: '--verbose', short: '-V', description: 'Enable verbose output', type: 'boolean', required: false },
          { name: '--no-interactive', description: 'Disable interactive prompts', type: 'boolean', required: false },
        ],
        examples: [
          'manel scan',
          'manel scan --format json --severity HIGH,CRITICAL',
          'manel scan --fail-on critical --no-color',
        ],
      },
      {
        name: 'vulnerabilities',
        description: 'Analyze installed technologies for known vulnerabilities',
        flags: [
          { name: '--format', short: '-f', description: 'Output format', type: 'enum', required: false, default: 'table', enum: ['json', 'sarif', 'table', 'ndjson'] },
          { name: '--output', short: '-o', description: 'Write output to file', type: 'string', required: false },
          { name: '--severity', short: '-s', description: 'Filter by severity levels', type: 'string', required: false },
          { name: '--fail-on', description: 'Exit with code 1 if findings at or above severity', type: 'enum', required: false, enum: ['critical', 'high', 'medium', 'low'] },
          { name: '--no-color', description: 'Disable ANSI color output', type: 'boolean', required: false },
          { name: '--quiet', short: '-q', description: 'Suppress non-error output', type: 'boolean', required: false },
          { name: '--verbose', short: '-V', description: 'Enable verbose output', type: 'boolean', required: false },
          { name: '--no-interactive', description: 'Disable interactive prompts', type: 'boolean', required: false },
        ],
        examples: [
          'manel vulnerabilities',
          'manel vulnerabilities --format json',
          'manel vulns --severity CRITICAL',
        ],
      },
      {
        name: 'hardening',
        description: 'Run system hardening checks (Linux only)',
        flags: [
          { name: '--format', short: '-f', description: 'Output format', type: 'enum', required: false, default: 'table', enum: ['json', 'sarif', 'table', 'ndjson'] },
          { name: '--output', short: '-o', description: 'Write output to file', type: 'string', required: false },
          { name: '--no-color', description: 'Disable ANSI color output', type: 'boolean', required: false },
          { name: '--quiet', short: '-q', description: 'Suppress non-error output', type: 'boolean', required: false },
          { name: '--verbose', short: '-V', description: 'Enable verbose output', type: 'boolean', required: false },
          { name: '--no-interactive', description: 'Disable interactive prompts', type: 'boolean', required: false },
        ],
        examples: [
          'manel hardening',
          'manel hardening --format json',
        ],
      },
      {
        name: 'score',
        description: 'Calculate and display the security score with breakdown',
        flags: [
          { name: '--format', short: '-f', description: 'Output format', type: 'enum', required: false, default: 'table', enum: ['json', 'sarif', 'table', 'ndjson'] },
          { name: '--output', short: '-o', description: 'Write output to file', type: 'string', required: false },
          { name: '--no-color', description: 'Disable ANSI color output', type: 'boolean', required: false },
          { name: '--quiet', short: '-q', description: 'Suppress non-error output', type: 'boolean', required: false },
          { name: '--verbose', short: '-V', description: 'Enable verbose output', type: 'boolean', required: false },
          { name: '--no-interactive', description: 'Disable interactive prompts', type: 'boolean', required: false },
        ],
        examples: [
          'manel score',
          'manel score --format json',
        ],
      },
      {
        name: 'updates',
        description: 'Check for available updates for installed technologies',
        flags: [
          { name: '--format', short: '-f', description: 'Output format', type: 'enum', required: false, default: 'table', enum: ['json', 'sarif', 'table', 'ndjson'] },
          { name: '--output', short: '-o', description: 'Write output to file', type: 'string', required: false },
          { name: '--no-color', description: 'Disable ANSI color output', type: 'boolean', required: false },
          { name: '--quiet', short: '-q', description: 'Suppress non-error output', type: 'boolean', required: false },
          { name: '--verbose', short: '-V', description: 'Enable verbose output', type: 'boolean', required: false },
          { name: '--no-interactive', description: 'Disable interactive prompts', type: 'boolean', required: false },
        ],
        examples: [
          'manel updates',
          'manel updates --format table',
        ],
      },
      {
        name: 'schema',
        description: 'Output machine-readable CLI schema (JSON)',
        flags: [
          { name: '--no-color', description: 'Disable ANSI color output', type: 'boolean', required: false },
          { name: '--output', short: '-o', description: 'Write output to file', type: 'string', required: false },
        ],
        examples: [
          'manel schema',
          'manel schema --output schema.json',
        ],
      },
    ],
    globalFlags: [
      { name: '--format', short: '-f', description: 'Output format', type: 'enum', required: false, default: 'table', enum: ['json', 'sarif', 'table', 'ndjson'] },
      { name: '--output', short: '-o', description: 'Write output to file', type: 'string', required: false },
      { name: '--no-color', description: 'Disable ANSI color output', type: 'boolean', required: false },
      { name: '--quiet', short: '-q', description: 'Suppress non-error output', type: 'boolean', required: false },
      { name: '--verbose', short: '-V', description: 'Enable verbose output', type: 'boolean', required: false },
      { name: '--no-interactive', description: 'Disable interactive prompts', type: 'boolean', required: false },
    ],
  }
}
