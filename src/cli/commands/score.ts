/**
 * Manel CLI — Score Command
 *
 * Calculates and displays the detailed security score.
 * Shows breakdown by category (OS, hardening, tools, etc.).
 *
 * @module cli/commands/score
 */

import type { Command } from 'commander'
import type { CoreTechnologyResult, CoreHardeningCheck } from '../../core/types'
import { detectAll } from '../../core/scanner'
import { analyzeAllTechnologies, runHardeningChecks, calculateScoreBreakdown } from '../../core/security'
import { getLatestVersion } from '../../core/update-engine'
import { formatOutput } from '../output'
import type { OutputSecurityScore } from '../output/types'
import { detectTTY } from '../output'
import type { CommonFlags } from '../flags'
import { Spinner, setActiveSpinner } from '../spinner'
import { getPackageVersion } from '../version'
import { internalError, formatErrorForStderr } from '../errors'

// ============================================================================
// 1. Command Registration
// ============================================================================

/**
 * Register the score command with Commander.js.
 *
 * @param program - Commander.js program instance
 */
export function registerScoreCommand(program: Command): void {
  program
    .command('score')
    .description('Calculate and display the security score with breakdown')
    .option('-f, --format <format>', 'Output format (table, json, sarif, ndjson)', 'table')
    .option('-o, --output <file>', 'Write output to file instead of stdout')
    .option('--no-color', 'Disable ANSI color output')
    .option('-q, --quiet', 'Suppress non-error output')
    .option('-V, --verbose', 'Enable verbose output')
    .addHelpText('after', `
Examples:
  $ manel score
  $ manel score --format json
  $ manel score --format sarif --output score.sarif`)
    .action(async (options: CommonFlags) => {
      await executeScoreCommand(options)
    })
}

// ============================================================================
// 2. Command Execution
// ============================================================================

/**
 * Execute the score command.
 *
 * Calculates the security score and outputs the breakdown.
 *
 * @param options - Parsed CLI options
 * @returns Exit code (0 = success, 2 = error)
 */
export async function executeScoreCommand(options: CommonFlags): Promise<number> {
  const startTime = Date.now()
  const ttyInfo = detectTTY()
  const useColor = options.color ?? ttyInfo.useColor
  const format = options.format ?? 'table'
  const version = getPackageVersion()

  const spinner = new Spinner('📊 Calculating security score...', { enabled: !options.quiet })
  setActiveSpinner(spinner)

  try {
    // Detect technologies
    spinner.step('  Detecting installed technologies...')
    const softwareList = detectAll()

    // Analyze technologies
    spinner.step('  Analyzing vulnerabilities...')
    const technologyResults = await analyzeAllTechnologies(
      softwareList.map(sw => ({
        name: sw.name,
        version: sw.version,
        id: sw.id,
      })),
      {
        getLatestVersion: async (name: string) => {
          try {
            return await getLatestVersion(name)
          } catch {
            return null
          }
        },
      }
    )

    // Run hardening checks
    let hardeningChecks: CoreHardeningCheck[] = []
    if (process.platform === 'linux') {
      spinner.step('  Running hardening checks...')
      hardeningChecks = await runHardeningChecks()
    }

    // Calculate score breakdown
    spinner.step('  Calculating score breakdown...')
    const scoreBreakdown = calculateScoreBreakdown(technologyResults, hardeningChecks)

    // Map to output format
    const score: OutputSecurityScore = {
      overall: scoreBreakdown.overall,
      breakdown: scoreBreakdown.breakdown as any,
    }

    // Format output
    const formattedOutput = formatOutput(
      { score },
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

    spinner.stop('✅ Score calculated')
    return 0
  } catch (err) {
    spinner.stop()
    const duration = Date.now() - startTime
    const error = internalError(
      err instanceof Error ? err.message : 'Unknown error during score command'
    )

    process.stderr.write(formatErrorForStderr(error, useColor))
    return 2
  }
}
