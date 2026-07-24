/**
 * Manel CLI — History Command
 *
 * Shows the history of recorded scans from the local SQLite database.
 * Supports table output for humans and JSON for machine consumption.
 *
 * @module cli/commands/history
 */

import type { Command } from 'commander'
import { getDatabase } from '../../core/database'
import type { CoreScan } from '../../core/types'
import type { CliError } from '../../shared/types'
import { detectTTY, formatJsonError } from '../output'
import { bold, dim, red, green, yellow, severityColor, scoreColor } from '../output/colors'
import type { ColorOptions } from '../output/colors'
import type { CommonFlags } from '../flags'
import { getPackageVersion } from '../version'
import { notFoundError, validationError, formatErrorForStderr, successEnvelope } from '../errors'

// ============================================================================
// 1. Types & Constants
// ============================================================================

/** History-specific CLI flags. */
export interface HistoryFlags extends CommonFlags {
  /** Maximum number of scans to show (default: 10) */
  last?: string
}

/** Default number of scans shown when --last is omitted. */
const DEFAULT_LIMIT = 10

/** Raw row shape of the scans table (snake_case columns). */
interface ScanRow {
  id: string
  date: number
  score: number | null
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  status: string
}

// ============================================================================
// 2. Command Registration
// ============================================================================

/**
 * Register the history command with Commander.js.
 *
 * @param program - Commander.js program instance
 */
export function registerHistoryCommand(program: Command): void {
  program
    .command('history')
    .description('Show the history of recorded scans')
    .option('-l, --last <N>', 'Number of recent scans to show', String(DEFAULT_LIMIT))
    .option('-f, --format <format>', 'Output format (table, json)', 'table')
    .option('--no-color', 'Disable ANSI color output')
    .option('-q, --quiet', 'Suppress non-error output')
    .option('-V, --verbose', 'Enable verbose output')
    .addHelpText('after', `
Examples:
  $ manel history
  $ manel history --last 20
  $ manel history --format json`)
    .action(async (options: HistoryFlags) => {
      process.exitCode = await executeHistoryCommand(options)
    })
}

// ============================================================================
// 3. Command Execution
// ============================================================================

/**
 * Execute the history command.
 *
 * Queries the most recent scans from the database and renders them
 * as a colorized table or a JSON response envelope.
 *
 * @param options - Parsed CLI options
 * @returns Exit code (0 = success, 2 = error)
 */
export async function executeHistoryCommand(options: HistoryFlags): Promise<number> {
  const startTime = Date.now()
  const ttyInfo = detectTTY()
  const useColor = options.color ?? ttyInfo.useColor
  const format = options.format === 'json' ? 'json' : 'table'
  const version = getPackageVersion()
  const colorOpts: ColorOptions = { forceColor: useColor }

  // Validate --last
  const limit = parseLimit(options.last)
  if (limit === null) {
    const error = validationError(
      `Invalid --last value '${options.last}'. Expected a positive integer.`,
      ['Example: manel history --last 20']
    )
    emitError(error, format, useColor, Date.now() - startTime, version)
    return 2
  }

  // Query scans — getDatabase() throws when persistence is unavailable
  let scans: CoreScan[]
  try {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM scans ORDER BY date DESC LIMIT ?').all(limit) as ScanRow[]
    scans = rows.map(mapScanRow)
  } catch {
    const error = notFoundError(
      'Scan history is unavailable: the local database is not initialized. Run a command like `manel scan` to create it first.'
    )
    emitError(error, format, useColor, Date.now() - startTime, version)
    return 2
  }

  const duration = Date.now() - startTime

  // Empty history is not an error
  if (scans.length === 0) {
    if (format === 'json') {
      process.stdout.write(JSON.stringify(successEnvelope({ scans: [] }, duration, version), null, 2) + '\n')
    } else if (!options.quiet) {
      process.stdout.write("No scans recorded yet. Run 'manel scan' first.\n")
    }
    return 0
  }

  if (format === 'json') {
    process.stdout.write(JSON.stringify(successEnvelope({ scans }, duration, version), null, 2) + '\n')
  } else if (!options.quiet) {
    process.stdout.write(formatHistoryTable(scans, colorOpts) + '\n')
  }

  return 0
}

// ============================================================================
// 4. Helpers
// ============================================================================

/**
 * Parse the --last flag into a positive integer limit.
 *
 * @param input - Raw flag value (undefined when flag omitted)
 * @returns The limit, or null when the input is invalid
 */
function parseLimit(input: string | undefined): number | null {
  if (input === undefined) return DEFAULT_LIMIT
  const parsed = Number.parseInt(input, 10)
  if (Number.isNaN(parsed) || parsed <= 0) return null
  return parsed
}

/**
 * Map a raw scans table row (snake_case) to a CoreScan (camelCase).
 *
 * @param row - Raw database row
 * @returns CamelCase scan record
 */
function mapScanRow(row: ScanRow): CoreScan {
  return {
    id: row.id,
    date: row.date,
    score: row.score,
    criticalCount: row.critical_count,
    highCount: row.high_count,
    mediumCount: row.medium_count,
    lowCount: row.low_count,
    status: row.status as CoreScan['status'],
  }
}

/**
 * Format a scan timestamp (Unix epoch seconds) as a short ISO-like string,
 * e.g., '2026-07-23 14:30'.
 *
 * @param epochSeconds - Scan timestamp in Unix epoch seconds
 * @returns Formatted local date-time string
 */
function formatScanDate(epochSeconds: number): string {
  const date = new Date(epochSeconds * 1000)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Colorize a severity count: dimmed when zero, severity-colored otherwise.
 *
 * @param count - Finding count
 * @param severity - Severity level used for coloring
 * @param colorOpts - Color options
 * @returns Colorized count string
 */
function colorCount(count: number, severity: string, colorOpts: ColorOptions): string {
  const text = String(count)
  if (count <= 0) return dim(text, colorOpts)
  return severityColor(text, severity, colorOpts)
}

/**
 * Colorize a scan status.
 *
 * @param status - Scan status string
 * @param colorOpts - Color options
 * @returns Colorized status string
 */
function colorScanStatus(status: string, colorOpts: ColorOptions): string {
  switch (status) {
    case 'completed': return green(status, colorOpts)
    case 'failed': return red(status, colorOpts)
    case 'scanning': return yellow(status, colorOpts)
    default: return dim(status, colorOpts)
  }
}

/** Visible width of a string, ignoring ANSI escape sequences. */
function visibleWidth(text: string): number {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '').length
}

/** Pad a string on the right to a given visible width (ANSI-aware). */
function padRight(text: string, width: number): string {
  return text + ' '.repeat(Math.max(0, width - visibleWidth(text)))
}

/** Pad a string on the left to a given visible width (ANSI-aware). */
function padLeft(text: string, width: number): string {
  return ' '.repeat(Math.max(0, width - visibleWidth(text))) + text
}

/**
 * Render the scan history as a simple padded column layout.
 * Columns: Date, Score, CRIT, HIGH, MED, LOW, Status.
 *
 * Note: the reusable table renderer in output/table-formatter.ts is not
 * exported, so this command renders its own lightweight layout.
 *
 * @param scans - Scan records (most recent first)
 * @param colorOpts - Color options
 * @returns Multi-line table string
 */
function formatHistoryTable(scans: CoreScan[], colorOpts: ColorOptions): string {
  const headers = ['Date', 'Score', 'CRIT', 'HIGH', 'MED', 'LOW', 'Status']
  // Numeric columns are right-aligned; all others left-aligned
  const rightAligned = new Set([1, 2, 3, 4, 5])

  const rows = scans.map(scan => [
    formatScanDate(scan.date),
    scan.score === null ? dim('-', colorOpts) : scoreColor(String(scan.score), scan.score, colorOpts),
    colorCount(scan.criticalCount, 'CRITICAL', colorOpts),
    colorCount(scan.highCount, 'HIGH', colorOpts),
    colorCount(scan.mediumCount, 'MEDIUM', colorOpts),
    colorCount(scan.lowCount, 'LOW', colorOpts),
    colorScanStatus(scan.status, colorOpts),
  ])

  const widths = headers.map((header, column) => {
    let width = visibleWidth(header)
    for (const row of rows) {
      width = Math.max(width, visibleWidth(row[column]))
    }
    return width
  })

  const renderRow = (cells: string[]): string =>
    cells
      .map((cell, column) =>
        rightAligned.has(column) ? padLeft(cell, widths[column]) : padRight(cell, widths[column])
      )
      .join('  ')

  const lines = [renderRow(headers.map(header => bold(header, colorOpts)))]
  for (const row of rows) {
    lines.push(renderRow(row))
  }

  return lines.join('\n')
}

/**
 * Emit a structured error. JSON format writes a machine-readable envelope
 * to stdout; other formats write a human-readable message to stderr.
 *
 * @param error - CLI error to emit
 * @param format - Resolved output format
 * @param useColor - Whether to use ANSI colors
 * @param duration - Execution duration in ms
 * @param version - CLI version string
 */
function emitError(
  error: CliError,
  format: string,
  useColor: boolean,
  duration: number,
  version: string
): void {
  if (format === 'json') {
    process.stdout.write(formatJsonError(error.code, error.message, error.type, { duration, version }) + '\n')
  } else {
    process.stderr.write(formatErrorForStderr(error, useColor))
  }
}
