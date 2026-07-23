/**
 * Manel CLI — NDJSON Formatter
 *
 * Outputs data as newline-delimited JSON (NDJSON).
 * Each line is a complete, self-contained JSON object.
 * Ideal for streaming, piping to `head`, `jq`, and log aggregation.
 *
 * @see https://github.com/ndjson/ndjson-spec
 *
 * @module cli/output/ndjson-formatter
 */

import type { FormatOptions } from './types'
import type {
  OutputScanResult,
  OutputTechnology,
  OutputVulnerability,
  OutputHardeningCheck,
  OutputSecurityScore,
  NdjsonLine,
} from './types'

// ============================================================================
// 1. Line Serialization
// ============================================================================

/**
 * Serialize a single NDJSON line object to a JSON string terminated by a newline.
 *
 * @param line - NDJSON line object
 * @returns Serialized JSON line with trailing newline
 */
function serializeLine(line: NdjsonLine): string {
  return JSON.stringify(line)
}

// ============================================================================
// 2. Technology Lines
// ============================================================================

/**
 * Convert a technology to an NDJSON line.
 *
 * @param tech - Technology data
 * @returns NDJSON line object
 */
function technologyToLine(tech: OutputTechnology): NdjsonLine {
  const line: NdjsonLine = {
    type: 'technology',
    name: tech.name,
    version: tech.version,
    detected: tech.detected,
    ecosystem: tech.ecosystem,
  }

  if (tech.latestVersion !== undefined) {
    line.latestVersion = tech.latestVersion
  }
  if (tech.updateAvailable !== undefined) {
    line.updateAvailable = tech.updateAvailable
  }

  return line
}

// ============================================================================
// 3. Vulnerability Lines
// ============================================================================

/**
 * Convert a vulnerability to an NDJSON line.
 *
 * @param vuln - Vulnerability data
 * @returns NDJSON line object
 */
function vulnerabilityToLine(vuln: OutputVulnerability): NdjsonLine {
  const line: NdjsonLine = {
    type: 'vulnerability',
    id: vuln.id,
    source: vuln.source,
    severity: vuln.severity,
    title: vuln.title,
    affectedPackage: vuln.affectedPackage,
    affectedVersions: vuln.affectedVersions,
  }

  if (vuln.fixedVersion !== undefined) {
    line.fixedVersion = vuln.fixedVersion
  }
  if (vuln.cvssScore !== undefined) {
    line.cvssScore = vuln.cvssScore
  }
  if (vuln.cveId !== undefined) {
    line.cveId = vuln.cveId
  }

  return line
}

// ============================================================================
// 4. Hardening Lines
// ============================================================================

/**
 * Convert a hardening check to an NDJSON line.
 *
 * @param check - Hardening check data
 * @returns NDJSON line object
 */
function hardeningCheckToLine(check: OutputHardeningCheck): NdjsonLine {
  return {
    type: 'hardening',
    id: check.id,
    title: check.title,
    status: check.status,
    severity: check.severity,
  }
}

// ============================================================================
// 5. Score Lines
// ============================================================================

/**
 * Convert a security score to an NDJSON line.
 *
 * @param score - Security score data
 * @returns NDJSON line object
 */
function scoreToLine(score: OutputSecurityScore): NdjsonLine {
  return {
    type: 'score',
    overall: score.overall,
    breakdown: score.breakdown,
  }
}

// ============================================================================
// 6. Meta Line
// ============================================================================

/**
 * Create a meta NDJSON line with scan summary.
 *
 * @param data - Scan result
 * @returns NDJSON line object
 */
function createMetaLine(data: OutputScanResult): NdjsonLine {
  return {
    type: 'meta',
    timestamp: new Date().toISOString(),
    totalTechnologies: data.technologies.length,
    totalVulnerabilities: data.vulnerabilities.length,
    hardeningPassRate: data.summary.hardeningPassRate,
  }
}

// ============================================================================
// 7. Public API
// ============================================================================

/**
 * Format a scan result as NDJSON (newline-delimited JSON).
 *
 * Each line is a complete JSON object with a `type` field indicating
 * the data kind: `technology`, `vulnerability`, `hardening`, `score`, or `meta`.
 *
 * Output is ideal for:
 * - Streaming to processes via pipes
 * - Parsing with `head -n 10 | jq .`
 * - Log aggregation systems
 * - Incremental processing
 *
 * @param data - Scan result to format
 * @param options - Format options (currently unused, reserved for future)
 * @returns NDJSON string (multiple lines)
 *
 * @example
 * ```bash
 * # Pipe to jq to filter vulnerabilities
 * manel scan --format ndjson | jq 'select(.type == "vulnerability")'
 *
 * # Get first 5 lines
 * manel scan --format ndjson | head -n 5
 * ```
 */
export function formatNdjson(data: OutputScanResult, options: FormatOptions = {}): string {
  const lines: string[] = []

  // Meta line first
  lines.push(serializeLine(createMetaLine(data)))

  // Technologies
  for (const tech of data.technologies) {
    lines.push(serializeLine(technologyToLine(tech)))
  }

  // Vulnerabilities
  for (const vuln of data.vulnerabilities) {
    lines.push(serializeLine(vulnerabilityToLine(vuln)))
  }

  // Hardening checks
  for (const hr of data.hardening) {
    for (const check of hr.checks) {
      lines.push(serializeLine(hardeningCheckToLine(check)))
    }
  }

  // Score
  lines.push(serializeLine(scoreToLine(data.score)))

  return lines.join('\n')
}

/**
 * Format a vulnerability array as NDJSON.
 *
 * @param vulnerabilities - Array of vulnerabilities
 * @param options - Format options
 * @returns NDJSON string
 */
export function formatVulnerabilitiesNdjson(
  vulnerabilities: OutputVulnerability[],
  options: FormatOptions = {}
): string {
  return vulnerabilities
    .map(v => serializeLine(vulnerabilityToLine(v)))
    .join('\n')
}
