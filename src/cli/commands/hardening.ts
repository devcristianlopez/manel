/**
 * Manel CLI — Hardening Command
 *
 * Runs system hardening checks on Linux systems.
 * Verifies firewall, SELinux/AppArmor, SSH configuration, etc.
 *
 * @module cli/commands/hardening
 */

import type { Command } from 'commander'
import type { CoreHardeningCheck } from '../../core/types'
import { runHardeningChecks } from '../../core/security'
import { formatOutput } from '../output'
import type { OutputHardeningResult } from '../output/types'
import { detectTTY } from '../output'
import type { CommonFlags } from '../flags'
import { successEnvelope, errorEnvelope } from '../errors'
import { internalError, formatErrorForStderr, validationError } from '../errors'

// ============================================================================
// 1. Command Registration
// ============================================================================

/**
 * Register the hardening command with Commander.js.
 *
 * @param program - Commander.js program instance
 */
export function registerHardeningCommand(program: Command): void {
  program
    .command('hardening')
    .description('Run system hardening checks (Linux only)')
    .option('-f, --format <format>', 'Output format (table, json, sarif, ndjson)', 'table')
    .option('-o, --output <file>', 'Write output to file instead of stdout')
    .option('--no-color', 'Disable ANSI color output')
    .option('-q, --quiet', 'Suppress non-error output')
    .option('-V, --verbose', 'Enable verbose output')
    .option('--no-interactive', 'Disable interactive prompts (for CI/CD)')
    .action(async (options: CommonFlags) => {
      await executeHardeningCommand(options)
    })
}

// ============================================================================
// 2. Command Execution
// ============================================================================

/**
 * Execute the hardening command.
 *
 * Runs all hardening checks and outputs results.
 *
 * @param options - Parsed CLI options
 * @returns Exit code (0 = success, 1 = failures, 2 = error, 3 = invalid platform)
 */
export async function executeHardeningCommand(options: CommonFlags): Promise<number> {
  const startTime = Date.now()
  const ttyInfo = detectTTY()
  const useColor = options.color ?? ttyInfo.useColor
  const format = options.format ?? 'table'

  // Check platform
  if (process.platform !== 'linux') {
    const error = validationError(
      'Hardening checks are only available on Linux systems',
      ['Run this command on a Linux system', 'Use "manel status" for cross-platform checks']
    )
    process.stderr.write(formatErrorForStderr(error, useColor))
    return 3
  }

  try {
    if (!options.quiet) {
      process.stderr.write('🔒 Running hardening checks...\n')
    }

    // Run hardening checks
    if (options.verbose) {
      process.stderr.write('  Checking firewall configuration...\n')
      process.stderr.write('  Checking SELinux/AppArmor...\n')
      process.stderr.write('  Checking SSH configuration...\n')
      process.stderr.write('  Checking open ports...\n')
      process.stderr.write('  Checking security updates...\n')
      process.stderr.write('  Checking core dumps...\n')
    }
    const hardeningChecks = await runHardeningChecks()

    // Map to output format
    const hardeningResult = mapHardeningResult(hardeningChecks)

    // Create response envelope
    const duration = Date.now() - startTime
    const envelope = successEnvelope({ hardening: [hardeningResult] }, duration)

    // Format output
    const formattedOutput = formatOutput(
      { hardening: [hardeningResult] } as any,
      format,
      { color: useColor, isTTY: ttyInfo.isTTY, duration, version: '0.1.0' }
    )

    // Write output
    if (options.output) {
      const fs = await import('fs/promises')
      await fs.writeFile(options.output, formattedOutput, 'utf-8')
    } else {
      process.stdout.write(formattedOutput)
    }

    // Determine exit code based on failures
    const hasFailures = hardeningResult.summary.fail > 0
    return hasFailures ? 1 : 0
  } catch (err) {
    const duration = Date.now() - startTime
    const error = internalError(
      err instanceof Error ? err.message : 'Unknown error during hardening command'
    )
    const envelope = errorEnvelope(error, duration)

    process.stderr.write(formatErrorForStderr(error, useColor))
    return 2
  }
}

// ============================================================================
// 3. Helper Functions
// ============================================================================

/**
 * Map hardening checks to output format.
 *
 * @param checks - Hardening check results
 * @returns Hardening result for output
 */
function mapHardeningResult(checks: CoreHardeningCheck[]): OutputHardeningResult {
  return {
    checks: checks.map(check => ({
      id: check.checkId,
      title: check.title,
      status: check.status,
      severity: check.severity,
      description: check.details,
    })),
    summary: {
      pass: checks.filter(c => c.status === 'pass').length,
      fail: checks.filter(c => c.status === 'fail').length,
      warning: checks.filter(c => c.status === 'warning').length,
    },
  }
}
