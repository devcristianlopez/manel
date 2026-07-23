/**
 * Manel CLI — SARIF Formatter
 *
 * Generates SARIF 2.1.0 (Static Analysis Results Interchange Format) reports
 * from scan results. Maps vulnerabilities to SARIF results with rules,
 * severity levels, and fix suggestions.
 *
 * @see https://docs.oasis-open.org/sarif/sarif/v2.1.0/
 *
 * @module cli/output/sarif-formatter
 */

import type { FormatOptions } from './types'
import type {
  OutputScanResult,
  OutputVulnerability,
  OutputHardeningCheck,
} from './types'
import type {
  SarifReport,
  SarifRun,
  SarifRule,
  SarifResult,
  SarifLocation,
  SarifFix,
  SarifInvocation,
} from '@shared/types'

// ============================================================================
// 1. SARIF Constants
// ============================================================================

/** SARIF 2.1.0 JSON Schema URI. */
const SARIF_SCHEMA = 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json'

/** Manel tool name for SARIF reports. */
const TOOL_NAME = 'manel'

/** Severity to SARIF level mapping. */
const SEVERITY_TO_LEVEL: Record<string, string> = {
  CRITICAL: 'error',
  HIGH: 'error',
  MEDIUM: 'warning',
  LOW: 'note',
  UNKNOWN: 'note',
}

// ============================================================================
// 2. Rule Generation
// ============================================================================

/**
 * Generate SARIF rules from vulnerabilities.
 * Each unique vulnerability title becomes a rule.
 *
 * @param vulnerabilities - Array of vulnerabilities
 * @returns Array of SARIF rules
 */
function generateRules(vulnerabilities: OutputVulnerability[]): SarifRule[] {
  const ruleMap = new Map<string, SarifRule>()

  for (const vuln of vulnerabilities) {
    if (ruleMap.has(vuln.id)) continue

    const level = SEVERITY_TO_LEVEL[vuln.severity] ?? 'note'

    ruleMap.set(vuln.id, {
      id: vuln.id,
      name: vuln.title,
      shortDescription: { text: vuln.title },
      fullDescription: { text: vuln.description },
      defaultConfiguration: { level },
      helpUri: vuln.references[0] ?? `https://www.cvedetails.com/vulnerability/${vuln.id}`,
    })
  }

  return Array.from(ruleMap.values())
}

// ============================================================================
// 3. Result Generation
// ============================================================================

/**
 * Map a vulnerability to a SARIF result.
 *
 * @param vuln - Vulnerability to map
 * @returns SARIF result
 */
function vulnerabilityToSarifResult(vuln: OutputVulnerability): SarifResult {
  const level = SEVERITY_TO_LEVEL[vuln.severity] ?? 'note'

  const result: SarifResult = {
    ruleId: vuln.id,
    level,
    message: {
      text: `${vuln.title} — affects ${vuln.affectedPackage} (${vuln.affectedVersions})`,
    },
    locations: [
      {
        physicalLocation: {
          artifactLocation: {
            uri: `pkg:${vuln.affectedPackage}`,
          },
        },
      },
    ],
    fingerprints: {
      'manel/vulnerabilityId': vuln.id,
      'manel/source': vuln.source,
    },
  }

  // Add fix if available
  if (vuln.fixedVersion) {
    result.fixes = [
      {
        description: {
          text: `Update ${vuln.affectedPackage} to version ${vuln.fixedVersion} or later`,
        },
        artifactChanges: [
          {
            artifactLocation: { uri: `pkg:${vuln.affectedPackage}` },
            replacements: [
              {
                deletedRegion: { charOffset: 0, charLength: 0 },
                insertedContent: { text: vuln.fixedVersion },
              },
            ],
          },
        ],
      },
    ]
  }

  return result
}

/**
 * Map a failing hardening check to a SARIF result.
 *
 * @param check - Hardening check that failed
 * @returns SARIF result
 */
function hardeningCheckToSarifResult(check: OutputHardeningCheck): SarifResult {
  const level = SEVERITY_TO_LEVEL[check.severity] ?? 'warning'

  return {
    ruleId: `HARDENING-${check.id}`,
    level,
    message: {
      text: `Hardening check failed: ${check.title}${check.description ? ` — ${check.description}` : ''}`,
    },
    locations: [
      {
        physicalLocation: {
          artifactLocation: {
            uri: `hardening:${check.id}`,
          },
        },
      },
    ],
    fingerprints: {
      'manel/hardeningCheckId': check.id,
    },
  }
}

// ============================================================================
// 4. Invocation
// ============================================================================

/**
 * Create a SARIF invocation record.
 *
 * @param duration - Execution duration in milliseconds
 * @returns SARIF invocation
 */
function createInvocation(duration?: number): SarifInvocation {
  return {
    executionSuccessful: true,
    exitCode: 0,
    exitCodeDescription: 'Success',
  }
}

// ============================================================================
// 5. Main SARIF Report Builder
// ============================================================================

/**
 * Build a complete SARIF 2.1.0 report from scan results.
 *
 * @param data - Scan result data
 * @param options - Format options
 * @returns Complete SARIF report object
 */
function buildSarifReport(data: OutputScanResult, options: FormatOptions): SarifReport {
  const version = options.version ?? '0.0.0'

  // Generate rules from vulnerabilities
  const vulnRules = generateRules(data.vulnerabilities)

  // Add hardening rules
  const hardeningRules: SarifRule[] = []
  for (const hr of data.hardening) {
    for (const check of hr.checks) {
      if (check.status !== 'pass') {
        hardeningRules.push({
          id: `HARDENING-${check.id}`,
          name: check.title,
          shortDescription: { text: check.title },
          fullDescription: { text: check.description ?? check.title },
          defaultConfiguration: { level: SEVERITY_TO_LEVEL[check.severity] ?? 'warning' },
          helpUri: `https://manel.dev/hardening/${check.id}`,
        })
      }
    }
  }

  const allRules = [...vulnRules, ...hardeningRules]

  // Map vulnerabilities to results
  const vulnResults = data.vulnerabilities.map(vulnerabilityToSarifResult)

  // Map failing hardening checks to results
  const hardeningResults: SarifResult[] = []
  for (const hr of data.hardening) {
    for (const check of hr.checks) {
      if (check.status !== 'pass') {
        hardeningResults.push(hardeningCheckToSarifResult(check))
      }
    }
  }

  const allResults = [...vulnResults, ...hardeningResults]

  const run: SarifRun = {
    tool: {
      driver: {
        name: TOOL_NAME,
        version,
        semanticVersion: version,
        rules: allRules,
      },
    },
    results: allResults,
    invocations: [createInvocation(options.duration)],
  }

  return {
    version: '2.1.0',
    $schema: SARIF_SCHEMA,
    runs: [run],
  }
}

// ============================================================================
// 6. Public API
// ============================================================================

/**
 * Format scan results as a SARIF 2.1.0 report.
 *
 * Generates a valid SARIF report with:
 * - Tool metadata (name, version)
 * - Rules derived from vulnerabilities and hardening checks
 * - Results mapped from vulnerabilities (with severity levels)
 * - Results mapped from failing hardening checks
 * - Fix suggestions for vulnerabilities with known fixed versions
 * - Invocation record
 *
 * @param data - Scan result data
 * @param options - Format options
 * @returns JSON string of the SARIF report
 *
 * @example
 * ```ts
 * const sarifOutput = formatSarif(scanResult, { version: '0.1.0' })
 * // Pipe to sarif-formatter or upload to GitHub
 * ```
 */
export function formatSarif(data: OutputScanResult, options: FormatOptions = {}): string {
  const report = buildSarifReport(data, options)
  return JSON.stringify(report, null, 2)
}

/**
 * Format scan results as a SARIF report object (not serialized).
 * Useful for programmatic consumption or further transformation.
 *
 * @param data - Scan result data
 * @param options - Format options
 * @returns SARIF report object
 */
export function formatSarifObject(data: OutputScanResult, options: FormatOptions = {}): SarifReport {
  return buildSarifReport(data, options)
}
