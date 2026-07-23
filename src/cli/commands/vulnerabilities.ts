/**
 * Manel CLI — Vulnerabilities Command
 *
 * Analyzes installed technologies for known vulnerabilities.
 * Queries multiple vulnerability databases (OSV, NVD, GHSA).
 *
 * @module cli/commands/vulnerabilities
 */

import { Command, Option } from 'commander'
import type { CoreTechnologyResult } from '../../core/types'
import { detectAll } from '../../core/scanner'
import { analyzeAllTechnologies } from '../../core/security'
import { getLatestVersion } from '../../core/update-engine'
import { formatOutput } from '../output'
import type { OutputVulnerability } from '../output/types'
import { detectTTY } from '../output'
import type { CommonFlags } from '../flags'
import { parseSeverityFilter } from '../flags'
import { Spinner, setActiveSpinner } from '../spinner'
import { getPackageVersion } from '../version'
import { shouldFailOnSeverityVulns } from '../utils'
import { internalError, formatErrorForStderr } from '../errors'
import { createScan, updateScan, saveSoftware, saveVulnerabilities } from '../../core/database'

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
    .addOption(new Option('--fail-on <severity>', 'Exit with code 1 if findings at or above this severity').choices(['critical', 'high', 'medium', 'low']))
    .option('--no-color', 'Disable ANSI color output')
    .option('-q, --quiet', 'Suppress non-error output')
    .option('-V, --verbose', 'Enable verbose output')
    .addHelpText('after', `
Examples:
  $ manel vulnerabilities
  $ manel vulns --format json
  $ manel vulns --severity CRITICAL
  $ manel vulns --fail-on high --output vulns.json`)
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
  const failOnSeverity = options.failOn ? options.failOn.toUpperCase() : undefined
  const version = getPackageVersion()

  const spinner = new Spinner('🔍 Analyzing vulnerabilities...', { enabled: !options.quiet })
  setActiveSpinner(spinner)

  try {
    // Detect technologies
    spinner.step('  Detecting installed technologies...')
    const softwareList = detectAll()

    // Analyze for vulnerabilities
    spinner.step('  Querying vulnerability databases...')
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

    // Persist results to database
    try {
      const scan = createScan()

      // Save software entries
      const softwareRecords = saveSoftware(
        softwareList.map(sw => ({
          name: sw.name,
          version: sw.version,
          path: sw.path,
          detectedAt: Math.floor(Date.now() / 1000),
          scanId: scan.id,
        }))
      )

      // Save vulnerabilities
      for (const techResult of technologyResults) {
        const softwareRecord = softwareRecords.find(r => r.name === techResult.name)
        if (softwareRecord && techResult.vulnerabilities.length > 0) {
          saveVulnerabilities(
            techResult.vulnerabilities.map(v => ({
              cve: v.cve,
              severity: v.severity,
              description: v.description,
              softwareId: softwareRecord.id,
              fixedVersion: v.fixedVersion,
              source: v.source,
            }))
          )
        }
      }

      // Update scan with final counts
      const allVulns = technologyResults.flatMap(tr => tr.vulnerabilities)
      updateScan(scan.id, {
        score: null,
        status: 'completed',
        criticalCount: allVulns.filter(v => v.severity === 'CRITICAL').length,
        highCount: allVulns.filter(v => v.severity === 'HIGH').length,
        mediumCount: allVulns.filter(v => v.severity === 'MEDIUM').length,
        lowCount: allVulns.filter(v => v.severity === 'LOW').length,
      })
    } catch (dbErr) {
      // Database persistence is best-effort; don't fail the command
      console.error('[vulnerabilities] Failed to persist results:', dbErr)
    }

    // Map to output format
    let vulnerabilities = mapVulnerabilities(technologyResults)

    // Apply severity filter if specified
    if (severityFilter && severityFilter.length > 0) {
      vulnerabilities = vulnerabilities.filter(v =>
        severityFilter.includes(v.severity as any)
      )
    }

    // Format output
    const formattedOutput = formatOutput(
      { vulnerabilities } as any,
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

    spinner.stop('✅ Vulnerability analysis complete')

    // Determine exit code
    const hasCriticalFindings = vulnerabilities.some(
      v => v.severity === 'CRITICAL' || v.severity === 'HIGH'
    )

    if (failOnSeverity) {
      if (shouldFailOnSeverityVulns(vulnerabilities, failOnSeverity)) {
        return 1
      }
    } else if (hasCriticalFindings) {
      return 1
    }

    return 0
  } catch (err) {
    spinner.stop()
    const duration = Date.now() - startTime
    const error = internalError(
      err instanceof Error ? err.message : 'Unknown error during vulnerabilities command'
    )

    process.stderr.write(formatErrorForStderr(error, useColor))
    return 2
  }
}

// ============================================================================
// 3. Helper Functions
// ============================================================================

/**
 * Map technology results to vulnerability output format.
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
