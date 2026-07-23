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
import { Spinner, setActiveSpinner } from '../spinner'
import { getPackageVersion } from '../version'
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
    .addHelpText('after', `
Examples:
  $ manel hardening
  $ manel hardening --format json
  $ manel hardening --format sarif --output hardening.sarif`)
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
  const version = getPackageVersion()

  // Check platform
  if (process.platform !== 'linux') {
    const error = validationError(
      'Hardening checks are only available on Linux systems',
      ['Run this command on a Linux system', 'Use "manel status" for cross-platform checks']
    )
    process.stderr.write(formatErrorForStderr(error, useColor))
    return 3
  }

  const spinner = new Spinner('🔒 Running hardening checks...', { enabled: !options.quiet })
  setActiveSpinner(spinner)

  try {
    // Run hardening checks
    spinner.step('  Checking firewall configuration...')
    const hardeningChecks = await runHardeningChecks()

    // Map to output format
    const hardeningResult = mapHardeningResult(hardeningChecks)

    // Format output
    const formattedOutput = formatOutput(
      { hardening: [hardeningResult] },
      format,
      { color: useColor, isTTY: ttyInfo.isTTY, duration: Date.now() - startTime, version }
    )

    // Write output
    if (options.output) {
      const fs = await import('fs/promises')
      await fs.writeFile(options.output, formattedOutput, 'utf-8')
    } else {
      process.stdout.write(formattedOutput)
    }

    spinner.stop('✅ Hardening checks complete')

    // Determine exit code based on failures
    const hasFailures = hardeningResult.summary.fail > 0
    return hasFailures ? 1 : 0
  } catch (err) {
    spinner.stop()
    const duration = Date.now() - startTime
    const error = internalError(
      err instanceof Error ? err.message : 'Unknown error during hardening command'
    )

    process.stderr.write(formatErrorForStderr(error, useColor))
    return 2
  }
}

// ============================================================================
// 3. Helper Functions
// ============================================================================

/**
 * Map hardening checks to output format.
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
