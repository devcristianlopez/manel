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
import { successEnvelope, errorEnvelope } from '../errors'
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
    .option('--no-interactive', 'Disable interactive prompts (for CI/CD)')
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

  try {
    if (!options.quiet) {
      process.stderr.write('📊 Calculating security score...\n')
    }

    // Detect technologies
    if (options.verbose) {
      process.stderr.write('  Detecting installed technologies...\n')
    }
    const softwareList = detectAll()

    // Analyze technologies
    if (options.verbose) {
      process.stderr.write('  Analyzing vulnerabilities...\n')
    }
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
      if (options.verbose) {
        process.stderr.write('  Running hardening checks...\n')
      }
      hardeningChecks = await runHardeningChecks()
    }

    // Calculate score breakdown
    if (options.verbose) {
      process.stderr.write('  Calculating score breakdown...\n')
    }
    const scoreBreakdown = calculateScoreBreakdown(technologyResults, hardeningChecks)

    // Map to output format
    const score: OutputSecurityScore = {
      overall: scoreBreakdown.overall,
      breakdown: scoreBreakdown.breakdown as any,
    }

    // Create response envelope
    const duration = Date.now() - startTime
    const envelope = successEnvelope({ score }, duration)

    // Format output
    const formattedOutput = formatOutput(
      { score } as any,
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

    return 0
  } catch (err) {
    const duration = Date.now() - startTime
    const error = internalError(
      err instanceof Error ? err.message : 'Unknown error during score command'
    )
    const envelope = errorEnvelope(error, duration)

    process.stderr.write(formatErrorForStderr(error, useColor))
    return 2
  }
}
