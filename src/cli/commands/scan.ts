/**
 * Manel CLI — Scan Command
 *
 * Performs a complete security scan including:
 * - Technology detection
 * - Vulnerability analysis
 * - Hardening checks (Linux only)
 * - Security score calculation
 *
 * @module cli/commands/scan
 */

import { Command, Option } from 'commander'
import type { CoreTechnologyResult, CoreHardeningCheck } from '../../core/types'
import { detectAll, detectOS } from '../../core/scanner'
import { analyzeAllTechnologies, runHardeningChecks, calculateScoreBreakdown } from '../../core/security'
import { getLatestVersion } from '../../core/update-engine'
import { formatOutput } from '../output'
import type { OutputScanResult, OutputTechnology, OutputVulnerability, OutputHardeningResult, OutputSecurityScore, OutputScanSummary } from '../output/types'
import { detectTTY } from '../output'
import type { CommonFlags } from '../flags'
import { parseSeverityFilter } from '../flags'
import { Spinner, setActiveSpinner } from '../spinner'
import { getPackageVersion } from '../version'
import { getEcosystemName, shouldFailOnSeverity } from '../utils'
import { internalError, formatErrorForStderr } from '../errors'
import { createScan, updateScan, saveSoftware, saveVulnerabilities, saveHardeningResults } from '../../core/database'

// ============================================================================
// 1. Command Registration
// ============================================================================

/**
 * Register the scan command with Commander.js.
 *
 * @param program - Commander.js program instance
 */
export function registerScanCommand(program: Command): void {
  program
    .command('scan')
    .description('Perform a complete security scan of the system')
    .option('-f, --format <format>', 'Output format (table, json, sarif, ndjson)', 'table')
    .option('-o, --output <file>', 'Write output to file instead of stdout')
    .option('-s, --severity <levels>', 'Filter by severity levels (comma-separated)')
    .addOption(new Option('--fail-on <severity>', 'Exit with code 1 if findings at or above this severity').choices(['critical', 'high', 'medium', 'low']))
    .option('--no-color', 'Disable ANSI color output')
    .option('-q, --quiet', 'Suppress non-error output')
    .option('-V, --verbose', 'Enable verbose output')
    .addHelpText('after', `
Examples:
  $ manel scan
  $ manel scan --format json
  $ manel scan --format sarif --output scan.sarif
  $ manel scan --severity HIGH,CRITICAL
  $ manel scan --fail-on critical --no-color`)
    .action(async (options: CommonFlags) => {
      await executeScanCommand(options)
    })
}

// ============================================================================
// 2. Command Execution
// ============================================================================

/**
 * Execute the scan command.
 *
 * Runs all security checks and outputs results in the requested format.
 *
 * @param options - Parsed CLI options
 * @returns Exit code (0 = success, 1 = findings, 2 = error)
 */
export async function executeScanCommand(options: CommonFlags): Promise<number> {
  const startTime = Date.now()
  const ttyInfo = detectTTY()
  const useColor = options.color ?? ttyInfo.useColor
  const format = options.format ?? 'table'
  const severityFilter = options.severity ? parseSeverityFilter(options.severity) : undefined
  const failOnSeverity = options.failOn ? options.failOn.toUpperCase() : undefined
  const version = getPackageVersion()

  const spinner = new Spinner('🔍 Running security scan...', { enabled: !options.quiet })
  setActiveSpinner(spinner)

  try {
    // Step 1: Detect technologies
    spinner.step('  Detecting installed technologies...')
    const softwareList = detectAll()
    const osInfo = detectOS()

    // Step 2: Analyze vulnerabilities
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

    // Step 3: Run hardening checks
    let hardeningChecks: CoreHardeningCheck[] = []
    if (process.platform === 'linux') {
      spinner.step('  Running hardening checks...')
      hardeningChecks = await runHardeningChecks()
    }

    // Step 4: Calculate score
    spinner.step('  Calculating security score...')
    const scoreBreakdown = calculateScoreBreakdown(technologyResults, hardeningChecks)

    // Step 4b: Persist results to database
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

      // Save hardening results
      if (hardeningChecks.length > 0) {
        saveHardeningResults(
          hardeningChecks.map(hc => ({
            scanId: scan.id,
            checkId: hc.checkId,
            category: hc.category,
            title: hc.title,
            status: hc.status,
            severity: hc.severity,
            details: hc.details,
          }))
        )
      }

      // Update scan with final counts
      updateScan(scan.id, {
        score: scoreBreakdown.overall,
        status: 'completed',
        criticalCount: technologyResults.reduce(
          (sum, tr) => sum + tr.vulnerabilities.filter(v => v.severity === 'CRITICAL').length, 0
        ),
        highCount: technologyResults.reduce(
          (sum, tr) => sum + tr.vulnerabilities.filter(v => v.severity === 'HIGH').length, 0
        ),
        mediumCount: technologyResults.reduce(
          (sum, tr) => sum + tr.vulnerabilities.filter(v => v.severity === 'MEDIUM').length, 0
        ),
        lowCount: technologyResults.reduce(
          (sum, tr) => sum + tr.vulnerabilities.filter(v => v.severity === 'LOW').length, 0
        ),
      })
    } catch (dbErr) {
      // Database persistence is best-effort; don't fail the command
      console.error('[scan] Failed to persist results:', dbErr)
    }

    // Step 5: Build output data
    const outputData = buildScanOutputData(
      technologyResults,
      hardeningChecks,
      scoreBreakdown,
      softwareList.length,
      osInfo
    )

    // Apply severity filter if specified
    let filteredData = outputData
    if (severityFilter && severityFilter.length > 0) {
      filteredData = filterBySeverity(outputData, severityFilter)
    }

    // Format output
    const formattedOutput = formatOutput(
      filteredData,
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

    spinner.stop('✅ Scan complete')

    // Determine exit code based on findings
    const hasCriticalFindings = outputData.vulnerabilities.some(
      v => v.severity === 'CRITICAL' || v.severity === 'HIGH'
    )

    if (failOnSeverity) {
      if (shouldFailOnSeverity(outputData, failOnSeverity)) {
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
      err instanceof Error ? err.message : 'Unknown error during scan command'
    )

    process.stderr.write(formatErrorForStderr(error, useColor))
    return 2
  }
}

// ============================================================================
// 3. Data Building Functions
// ============================================================================

/**
 * Build the complete scan output data.
 */
function buildScanOutputData(
  technologyResults: CoreTechnologyResult[],
  hardeningChecks: CoreHardeningCheck[],
  scoreBreakdown: { overall: number; breakdown: Record<string, number> },
  totalSoftware: number,
  osInfo: { platform: string; distro?: string; version?: string }
): OutputScanResult {
  const technologies: OutputTechnology[] = technologyResults.map(tr => ({
    name: tr.name,
    version: tr.installedVersion,
    detected: true,
    ecosystem: getEcosystemName(tr.name),
    latestVersion: tr.latestVersion,
    updateAvailable: tr.installedVersion !== tr.latestVersion,
  }))

  technologies.unshift({
    name: osInfo.distro ?? osInfo.platform,
    version: osInfo.version ?? null,
    detected: true,
    ecosystem: 'os',
  })

  const vulnerabilities: OutputVulnerability[] = technologyResults.flatMap(tr =>
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

  const hardening: OutputHardeningResult[] = [
    {
      checks: hardeningChecks.map(hc => ({
        id: hc.checkId,
        title: hc.title,
        status: hc.status,
        severity: hc.severity,
        description: hc.details,
      })),
      summary: {
        pass: hardeningChecks.filter(hc => hc.status === 'pass').length,
        fail: hardeningChecks.filter(hc => hc.status === 'fail').length,
        warning: hardeningChecks.filter(hc => hc.status === 'warning').length,
      },
    },
  ]

  const score: OutputSecurityScore = {
    overall: scoreBreakdown.overall,
    breakdown: scoreBreakdown.breakdown as any,
  }

  const summary: OutputScanSummary = {
    totalTechnologies: totalSoftware,
    detectedTechnologies: technologyResults.length,
    totalVulnerabilities: vulnerabilities.length,
    criticalVulnerabilities: vulnerabilities.filter(v => v.severity === 'CRITICAL').length,
    highVulnerabilities: vulnerabilities.filter(v => v.severity === 'HIGH').length,
    hardeningPassRate: hardeningChecks.length > 0
      ? Math.round((hardeningChecks.filter(hc => hc.status === 'pass').length / hardeningChecks.length) * 100)
      : 100,
  }

  return {
    technologies,
    vulnerabilities,
    hardening,
    score,
    summary,
  }
}

/**
 * Filter scan results by severity.
 */
function filterBySeverity(
  data: OutputScanResult,
  severities: string[]
): OutputScanResult {
  return {
    ...data,
    vulnerabilities: data.vulnerabilities.filter(v =>
      severities.includes(v.severity.toUpperCase())
    ),
    summary: {
      ...data.summary,
      totalVulnerabilities: data.vulnerabilities.filter(v =>
        severities.includes(v.severity.toUpperCase())
      ).length,
      criticalVulnerabilities: data.vulnerabilities.filter(v =>
        v.severity === 'CRITICAL' && severities.includes('CRITICAL')
      ).length,
      highVulnerabilities: data.vulnerabilities.filter(v =>
        v.severity === 'HIGH' && severities.includes('HIGH')
      ).length,
    },
  }
}
