/**
 * Manel CLI — Output Engine
 *
 * Main entry point for formatting CLI output in multiple formats:
 * table, JSON, SARIF, and NDJSON.
 *
 * All formatters are stateless pure functions that accept data and options,
 * returning a string representation in the requested format.
 *
 * @example
 * ```ts
 * import { formatOutput } from './cli/output'
 *
 * // Table format for terminal
 * console.log(formatOutput(scanResult, 'table'))
 *
 * // JSON format for machine consumption
 * console.log(formatOutput(scanResult, 'json', { pretty: true }))
 *
 * // SARIF format for CI/CD integration
 * console.log(formatOutput(scanResult, 'sarif'))
 *
 * // NDJSON for streaming
 * console.log(formatOutput(scanResult, 'ndjson'))
 * ```
 *
 * @module cli/output
 */

import type { OutputFormat } from '@shared/types'
import type { FormatOptions, OutputScanResult, OutputVulnerability, OutputHardeningResult, OutputSecurityScore } from './types'
import type { UpdateInfo } from '@shared/types'
import { formatTable } from './table-formatter'
import { formatJson } from './json-formatter'
import { formatSarif } from './sarif-formatter'
import { formatNdjson } from './ndjson-formatter'

// ============================================================================
// 1. Re-exports
// ============================================================================

// TTY utilities
export { detectTTY, shouldUseColor } from './tty'
export type { TtyInfo } from './tty'

// Color utilities
export {
  red, green, yellow, blue, cyan, magenta,
  bold, dim, reset,
  severityColor, statusColor, scoreColor,
} from './colors'

// Formatter functions
export { formatTable } from './table-formatter'
export { formatJson, formatJsonError } from './json-formatter'
export { formatSarif, formatSarifObject } from './sarif-formatter'
export { formatNdjson, formatVulnerabilitiesNdjson } from './ndjson-formatter'

// Types
export type { FormatOptions, TableData, TableColumn } from './types'
export type {
  OutputScanResult,
  OutputTechnology,
  OutputVulnerability,
  OutputHardeningCheck,
  OutputHardeningResult,
  OutputSecurityScore,
  OutputScanSummary,
  NdjsonLine,
} from './types'
export type { JsonFormatOptions } from './json-formatter'

// ============================================================================
// 2. Main Format Output Function
// ============================================================================

/**
 * Data types accepted by the output engine.
 * The function infers the data type and selects the appropriate formatter.
 */
export type FormatterData =
  | OutputScanResult
  | OutputVulnerability[]
  | OutputHardeningResult[]
  | OutputSecurityScore
  | UpdateInfo[]
  | Record<string, unknown>

/**
 * Format data in the specified output format.
 *
 * This is the main entry point for the output engine. It dispatches
 * to the appropriate formatter based on the format parameter and
 * auto-detects the data type for table formatting.
 *
 * For SARIF and NDJSON formats, partial data is gracefully handled by
 * constructing a complete ScanResult with empty arrays for missing fields.
 *
 * @param data - Data to format
 * @param format - Output format ('table' | 'json' | 'sarif' | 'ndjson')
 * @param options - Formatting options
 * @returns Formatted string output
 * @throws Error if the format is not supported
 */
export function formatOutput(
  data: FormatterData,
  format: OutputFormat,
  options: FormatOptions = {}
): string {
  switch (format) {
    case 'table':
      return formatTable(data, options)

    case 'json':
      return formatJson(data, options)

    case 'sarif': {
      // SARIF works best with full scan results, but gracefully handle partial data
      const scanResult = toPartialScanResult(data)
      return formatSarif(scanResult, options)
    }

    case 'ndjson': {
      // NDJSON works best with full scan results, but gracefully handle partial data
      const scanResult = toPartialScanResult(data)
      return formatNdjson(scanResult, options)
    }

    default: {
      const _exhaustive: never = format
      throw new Error(`Unsupported output format: ${_exhaustive}`)
    }
  }
}

// ============================================================================
// 3. Internal Helpers
// ============================================================================

/**
 * Type guard: check if data is a complete scan result.
 *
 * @param data - Data to check
 * @returns Whether data is an OutputScanResult
 */
function isScanResult(data: FormatterData): data is OutputScanResult {
  return (
    typeof data === 'object' &&
    data !== null &&
    'technologies' in data &&
    'vulnerabilities' in data &&
    'score' in data &&
    Array.isArray((data as OutputScanResult).technologies)
  )
}

/**
 * Convert any data shape to a partial ScanResult for SARIF/NDJSON.
 * If data is already a full ScanResult, return it as-is.
 * Otherwise, wrap partial data in a ScanResult with empty arrays.
 *
 * @param data - Input data of any supported shape
 * @returns A complete (possibly partial) ScanResult
 */
function toPartialScanResult(data: FormatterData): OutputScanResult {
  if (isScanResult(data)) {
    return data
  }

  // Build a partial ScanResult from whatever data we have
  const result: OutputScanResult = {
    technologies: [],
    vulnerabilities: [],
    hardening: [],
    score: { overall: 0, breakdown: { os: 0, hardening: 0, tools: 0, dependencies: 0, databases: 0, criticalsPenalty: 0 } },
    summary: {
      totalTechnologies: 0,
      detectedTechnologies: 0,
      totalVulnerabilities: 0,
      criticalVulnerabilities: 0,
      highVulnerabilities: 0,
      hardeningPassRate: 0,
    },
  }

  // Populate fields that are present in the data
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>

    if ('technologies' in obj && Array.isArray(obj.technologies)) {
      result.technologies = obj.technologies as OutputScanResult['technologies']
    }
    if ('vulnerabilities' in obj && Array.isArray(obj.vulnerabilities)) {
      result.vulnerabilities = obj.vulnerabilities as OutputScanResult['vulnerabilities']
    }
    if ('hardening' in obj && Array.isArray(obj.hardening)) {
      result.hardening = obj.hardening as OutputScanResult['hardening']
    }
    if ('score' in obj && typeof obj.score === 'object' && obj.score !== null) {
      result.score = obj.score as OutputSecurityScore
    }
    if ('updates' in obj && Array.isArray(obj.updates)) {
      // For updates data, populate technologies from update info
      const updates = obj.updates as UpdateInfo[]
      result.technologies = updates.map(u => ({
        name: u.technology,
        version: u.currentVersion,
        detected: true,
        ecosystem: 'unknown',
        latestVersion: u.latestVersion,
        updateAvailable: u.updateAvailable,
      }))
    }
    if ('summary' in obj && typeof obj.summary === 'object' && obj.summary !== null) {
      result.summary = obj.summary as OutputScanResult['summary']
    }
  }

  return result
}
