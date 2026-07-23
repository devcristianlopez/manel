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

import type { Command } from 'commander'
import type { CoreTechnologyResult, CoreHardeningCheck } from '../../core/types'
import { detectAll, detectOS } from '../../core/scanner'
import { analyzeAllTechnologies, runHardeningChecks, calculateScoreBreakdown } from '../../core/security'
import { getLatestVersion } from '../../core/update-engine'
import { formatOutput } from '../output'
import type { OutputScanResult, OutputTechnology, OutputVulnerability, OutputHardeningResult, OutputSecurityScore, OutputScanSummary } from '../output/types'
import { detectTTY } from '../output'
import type { CommonFlags } from '../flags'
import { parseSeverityFilter, normalizeFailOn } from '../flags'
import { successEnvelope, errorEnvelope } from '../errors'
import { internalError, formatErrorForStderr } from '../errors'

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
    .option('--fail-on <severity>', 'Exit with code 1 if findings at or above this severity')
    .option('--no-color', 'Disable ANSI color output')
    .option('-q, --quiet', 'Suppress non-error output')
    .option('-V, --verbose', 'Enable verbose output')
    .option('--no-interactive', 'Disable interactive prompts (for CI/CD)')
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
  const failOnSeverity = options.failOn ? normalizeFailOn(options.failOn) : undefined

  try {
    if (!options.quiet) {
      process.stderr.write('🔍 Running security scan...\n')
    }

    // Step 1: Detect technologies
    if (options.verbose) {
      process.stderr.write('  Detecting installed technologies...\n')
    }
    const softwareList = detectAll()
    const osInfo = detectOS()

    // Step 2: Analyze vulnerabilities
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

    // Step 3: Run hardening checks
    let hardeningChecks: CoreHardeningCheck[] = []
    if (process.platform === 'linux') {
      if (options.verbose) {
        process.stderr.write('  Running hardening checks...\n')
      }
      hardeningChecks = await runHardeningChecks()
    }

    // Step 4: Calculate score
    if (options.verbose) {
      process.stderr.write('  Calculating security score...\n')
    }
    const scoreBreakdown = calculateScoreBreakdown(technologyResults, hardeningChecks)

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

    // Create response envelope
    const duration = Date.now() - startTime
    const envelope = successEnvelope(filteredData, duration)

    // Format output
    const formattedOutput = formatOutput(
      filteredData as any,
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
    const duration = Date.now() - startTime
    const error = internalError(
      err instanceof Error ? err.message : 'Unknown error during scan command'
    )
    const envelope = errorEnvelope(error, duration)

    process.stderr.write(formatErrorForStderr(error, useColor))
    return 2
  }
}

// ============================================================================
// 3. Data Building Functions
// ============================================================================

/**
 * Build the complete scan output data.
 *
 * @param technologyResults - Analyzed technology results
 * @param hardeningChecks - Hardening check results
 * @param scoreBreakdown - Security score breakdown
 * @param totalSoftware - Total software count
 * @param osInfo - OS information
 * @returns Complete scan output data
 */
function buildScanOutputData(
  technologyResults: CoreTechnologyResult[],
  hardeningChecks: CoreHardeningCheck[],
  scoreBreakdown: { overall: number; breakdown: Record<string, number> },
  totalSoftware: number,
  osInfo: { platform: string; distro?: string; version?: string }
): OutputScanResult {
  // Map technology results to output format
  const technologies: OutputTechnology[] = technologyResults.map(tr => ({
    name: tr.name,
    version: tr.installedVersion,
    detected: true,
    ecosystem: getEcosystemName(tr.name),
    latestVersion: tr.latestVersion,
    updateAvailable: tr.installedVersion !== tr.latestVersion,
  }))

  // Add OS as first technology
  technologies.unshift({
    name: osInfo.distro ?? osInfo.platform,
    version: osInfo.version ?? null,
    detected: true,
    ecosystem: 'os',
  })

  // Map vulnerabilities to output format
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

  // Map hardening checks to output format
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

  // Score
  const score: OutputSecurityScore = {
    overall: scoreBreakdown.overall,
    breakdown: scoreBreakdown.breakdown as any,
  }

  // Summary
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
 *
 * @param data - Scan result data
 * @param severities - Severity levels to include
 * @returns Filtered scan result data
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

/**
 * Check if the scan should fail based on severity threshold.
 *
 * @param data - Scan result data
 * @param failOnSeverity - Severity threshold
 * @returns True if scan should fail
 */
function shouldFailOnSeverity(data: OutputScanResult, failOnSeverity: string): boolean {
  const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
  const thresholdIndex = severityOrder.indexOf(failOnSeverity.toUpperCase())

  if (thresholdIndex === -1) return false

  return data.vulnerabilities.some(v => {
    const vulnIndex = severityOrder.indexOf(v.severity)
    return vulnIndex <= thresholdIndex
  }) || data.hardening.some(h =>
    h.checks.some(c => {
      if (c.status === 'pass') return false
      const checkIndex = severityOrder.indexOf(c.severity)
      return checkIndex <= thresholdIndex
    })
  )
}

/**
 * Get ecosystem name for a technology.
 *
 * @param name - Technology name
 * @returns Ecosystem identifier
 */
function getEcosystemName(name: string): string {
  const ecosystemMap: Record<string, string> = {
    node: 'npm',
    npm: 'npm',
    yarn: 'npm',
    pnpm: 'npm',
    git: 'git',
    docker: 'docker',
    'docker-compose': 'docker',
    python: 'PyPI',
    python3: 'PyPI',
    pip: 'PyPI',
    java: 'Maven',
    maven: 'Maven',
    gradle: 'Maven',
    code: 'VSCode',
    postgresql: 'PostgreSQL',
    mysql: 'MySQL',
    mariadb: 'MySQL',
    mongodb: 'MongoDB',
    redis: 'Redis',
    sqlite3: 'SQLite',
    pgadmin4: 'PostgreSQL',
  }

  return ecosystemMap[name] ?? 'unknown'
}
