/**
 * Manel CLI — Vulnerabilities Command
 *
 * Analyzes installed technologies for known vulnerabilities.
 * Queries multiple vulnerability databases (OSV, NVD, GHSA).
 *
 * @module cli/commands/vulnerabilities
 */

import type { Command } from 'commander'
import type { CoreTechnologyResult } from '../../core/types'
import { detectAll } from '../../core/scanner'
import { analyzeAllTechnologies } from '../../core/security'
import { getLatestVersion } from '../../core/update-engine'
import { formatOutput } from '../output'
import type { OutputVulnerability } from '../output/types'
import { detectTTY } from '../output'
import type { CommonFlags } from '../flags'
import { parseSeverityFilter, normalizeFailOn } from '../flags'
import { successEnvelope, errorEnvelope } from '../errors'
import { internalError, formatErrorForStderr } from '../errors'

// ============================================================================
// 1. Command Registration
// ============================================================================

/**
 * Register the vulnerabilities command with Commander.js.
 *
 * @param program - Commander.js program instance
 */
export function registerVulnerabilitiesCommand(program: Command): void {
  program
    .command('vulnerabilities')
    .alias('vulns')
    .description('Analyze installed technologies for known vulnerabilities')
    .option('-f, --format <format>', 'Output format (table, json, sarif, ndjson)', 'table')
    .option('-o, --output <file>', 'Write output to file instead of stdout')
    .option('-s, --severity <levels>', 'Filter by severity levels (comma-separated)')
    .option('--fail-on <severity>', 'Exit with code 1 if findings at or above this severity')
    .option('--no-color', 'Disable ANSI color output')
    .option('-q, --quiet', 'Suppress non-error output')
    .option('-V, --verbose', 'Enable verbose output')
    .option('--no-interactive', 'Disable interactive prompts (for CI/CD)')
    .action(async (options: CommonFlags) => {
      await executeVulnerabilitiesCommand(options)
    })
}

// ============================================================================
// 2. Command Execution
// ============================================================================

/**
 * Execute the vulnerabilities command.
 *
 * Analyzes all technologies for vulnerabilities and outputs results.
 *
 * @param options - Parsed CLI options
 * @returns Exit code (0 = success, 1 = findings, 2 = error)
 */
export async function executeVulnerabilitiesCommand(options: CommonFlags): Promise<number> {
  const startTime = Date.now()
  const ttyInfo = detectTTY()
  const useColor = options.color ?? ttyInfo.useColor
  const format = options.format ?? 'table'
  const severityFilter = options.severity ? parseSeverityFilter(options.severity) : undefined
  const failOnSeverity = options.failOn ? normalizeFailOn(options.failOn) : undefined

  try {
    if (!options.quiet) {
      process.stderr.write('🔍 Analyzing vulnerabilities...\n')
    }

    // Detect technologies
    if (options.verbose) {
      process.stderr.write('  Detecting installed technologies...\n')
    }
    const softwareList = detectAll()

    // Analyze for vulnerabilities
    if (options.verbose) {
      process.stderr.write('  Querying vulnerability databases...\n')
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

    // Map to output format
    let vulnerabilities = mapVulnerabilities(technologyResults)

    // Apply severity filter if specified
    if (severityFilter && severityFilter.length > 0) {
      vulnerabilities = vulnerabilities.filter(v =>
        severityFilter.includes(v.severity as any)
      )
    }

    // Create response envelope
    const duration = Date.now() - startTime
    const envelope = successEnvelope({ vulnerabilities }, duration)

    // Format output
    const formattedOutput = formatOutput(
      { vulnerabilities } as any,
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

    // Determine exit code
    const hasCriticalFindings = vulnerabilities.some(
      v => v.severity === 'CRITICAL' || v.severity === 'HIGH'
    )

    if (failOnSeverity) {
      if (shouldFailOnSeverity(vulnerabilities, failOnSeverity)) {
        return 1
      }
    } else if (hasCriticalFindings) {
      return 1
    }

    return 0
  } catch (err) {
    const duration = Date.now() - startTime
    const error = internalError(
      err instanceof Error ? err.message : 'Unknown error during vulnerabilities command'
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
 * Map technology results to vulnerability output format.
 *
 * @param technologyResults - Analyzed technology results
 * @returns Array of vulnerabilities
 */
function mapVulnerabilities(technologyResults: CoreTechnologyResult[]): OutputVulnerability[] {
  return technologyResults.flatMap(tr =>
    tr.vulnerabilities.map(v => ({
      id: v.cve,
      source: v.source,
      severity: v.severity,
      title: v.description,
      description: v.description,
      affectedPackage: tr.name,
      affectedVersions: tr.installedVersion,
      fixedVersion: v.fixedVersion,
      cvssScore: undefined,
      cveId: v.cve,
      references: [],
    }))
  )
}

/**
 * Check if vulnerabilities should trigger failure based on severity threshold.
 *
 * @param vulnerabilities - List of vulnerabilities
 * @param failOnSeverity - Severity threshold
 * @returns True if should fail
 */
function shouldFailOnSeverity(vulnerabilities: OutputVulnerability[], failOnSeverity: string): boolean {
  const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
  const thresholdIndex = severityOrder.indexOf(failOnSeverity.toUpperCase())

  if (thresholdIndex === -1) return false

  return vulnerabilities.some(v => {
    const vulnIndex = severityOrder.indexOf(v.severity)
    return vulnIndex <= thresholdIndex
  })
}
