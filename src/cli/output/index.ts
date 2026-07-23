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

/**
 * Format data in the specified output format.
 *
 * This is the main entry point for the output engine. It dispatches
 * to the appropriate formatter based on the format parameter and
 * auto-detects the data type for table formatting.
 *
 * @param data - Data to format
 * @param format - Output format ('table' | 'json' | 'sarif' | 'ndjson')
 * @param options - Formatting options
 * @returns Formatted string output
 * @throws Error if the format is not supported
 *
 * @example
 * ```ts
 * // Table for human consumption
 * const tableOutput = formatOutput(scanResult, 'table', { color: true })
 *
 * // JSON for machine consumption
 * const jsonOutput = formatOutput(scanResult, 'json', { pretty: true })
 *
 * // SARIF for CI/CD
 * const sarifOutput = formatOutput(scanResult, 'sarif', { version: '0.1.0' })
 *
 * // NDJSON for streaming
 * const ndjsonOutput = formatOutput(scanResult, 'ndjson')
 * ```
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

    case 'sarif':
      // SARIF only supports full scan results
      if (!isScanResult(data)) {
        throw new Error('SARIF format requires a complete ScanResult. Partial data is not supported.')
      }
      return formatSarif(data, options)

    case 'ndjson':
      // NDJSON only supports full scan results
      if (!isScanResult(data)) {
        throw new Error('NDJSON format requires a complete ScanResult. Partial data is not supported.')
      }
      return formatNdjson(data, options)

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
