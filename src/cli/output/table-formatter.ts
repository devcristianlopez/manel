/**
 * Manel CLI — Table Formatter
 *
 * Renders data as ASCII/Unicode tables for terminal display.
 * Auto-detects TTY to choose between Unicode box-drawing and ASCII borders.
 * Supports ANSI colors for severity, status, and score indicators.
 *
 * @module cli/output/table-formatter
 */

import { green, red, yellow, bold, dim, severityColor, statusColor, scoreColor } from './colors'
import type { ColorOptions } from './colors'
import { shouldUseColor } from './tty'
import type { FormatOptions, TableData, TableColumn } from './types'
import type {
  OutputScanResult,
  OutputTechnology,
  OutputVulnerability,
  OutputHardeningResult,
  OutputSecurityScore,
  OutputScanSummary,
} from './types'
import type { UpdateInfo } from '@shared/types'

// ============================================================================
// 1. Border Characters
// ============================================================================

/** Unicode box-drawing characters for TTY output. */
const UNICODE_BORDERS = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  teeDown: '┬',
  teeUp: '┴',
  teeRight: '├',
  teeLeft: '┤',
  cross: '┼',
} as const

/** ASCII fallback characters for non-TTY output. */
const ASCII_BORDERS = {
  topLeft: '+',
  topRight: '+',
  bottomLeft: '+',
  bottomRight: '+',
  horizontal: '-',
  vertical: '|',
  teeDown: '+',
  teeUp: '+',
  teeRight: '+',
  teeLeft: '+',
  cross: '+',
} as const

type Borders = typeof UNICODE_BORDERS | typeof ASCII_BORDERS

// ============================================================================
// 2. Color Options Builder
// ============================================================================

/**
 * Build ColorOptions from FormatOptions.
 *
 * @param options - Format options
 * @returns Color options for color utility functions
 */
function toColorOpts(options: FormatOptions): ColorOptions {
  return { forceColor: options.color }
}

// ============================================================================
// 3. Table Rendering
// ============================================================================

/**
 * Calculate the display width of a string, stripping ANSI escape codes.
 *
 * @param text - Text potentially containing ANSI codes
 * @returns Visible character count
 */
function displayWidth(text: string): number {
  // eslint-disable-next-line no-control-regex
  const stripped = text.replace(/\x1b\[[0-9;]*m/g, '')
  return stripped.length
}

/**
 * Pad a string to a given display width, respecting ANSI codes.
 *
 * @param text - Text to pad
 * @param width - Target display width
 * @param align - Alignment ('left' | 'center' | 'right')
 * @returns Padded string
 */
function padCell(text: string, width: number, align: 'left' | 'center' | 'right' = 'left'): string {
  const visible = displayWidth(text)
  const padding = Math.max(0, width - visible)

  switch (align) {
    case 'right':
      return ' '.repeat(padding) + text
    case 'center': {
      const left = Math.floor(padding / 2)
      const right = padding - left
      return ' '.repeat(left) + text + ' '.repeat(right)
    }
    default:
      return text + ' '.repeat(padding)
  }
}

/**
 * Build a horizontal border line.
 *
 * @param colWidths - Array of column widths
 * @param left - Left border character
 * @param right - Right border character
 * @param joint - Joint character between columns
 * @param h - Horizontal line character
 * @returns Border line string
 */
function buildHorizontalLine(colWidths: number[], left: string, right: string, joint: string, h: string): string {
  const segments = colWidths.map(w => h.repeat(w + 2))
  return left + segments.join(joint) + right
}

/**
 * Render a table from TableData.
 *
 * @param data - Table data with columns and rows
 * @param useUnicode - Whether to use Unicode box-drawing characters
 * @param options - Format options (for color control)
 * @returns Rendered table string
 */
function renderTable(data: TableData, useUnicode: boolean, options: FormatOptions): string {
  const borders: Borders = useUnicode ? UNICODE_BORDERS : ASCII_BORDERS
  const cOpts = toColorOpts(options)

  // Calculate column widths
  const colWidths: number[] = data.columns.map((col, idx) => {
    let width = displayWidth(col.header)
    for (const row of data.rows) {
      const rawValue = row[col.key]
      const formatted = col.format ? col.format(rawValue, row) : String(rawValue ?? '')
      width = Math.max(width, displayWidth(formatted))
    }
    return width
  })

  const lines: string[] = []

  // Title
  if (data.title) {
    const totalWidth = colWidths.reduce((sum, w) => sum + w + 3, -1)
    const titleText = bold(data.title, cOpts)
    const centered = padCell(titleText, totalWidth, 'center')
    lines.push(centered)
    lines.push('')
  }

  // Top border
  lines.push(buildHorizontalLine(colWidths, borders.topLeft, borders.topRight, borders.teeDown, borders.horizontal))

  // Header row
  const headerCells = data.columns.map((col, idx) => {
    const headerText = bold(col.header, cOpts)
    return ' ' + padCell(headerText, colWidths[idx], col.align) + ' '
  })
  lines.push(borders.vertical + headerCells.join(borders.vertical) + borders.vertical)

  // Header separator
  lines.push(buildHorizontalLine(colWidths, borders.teeRight, borders.teeLeft, borders.cross, borders.horizontal))

  // Data rows
  for (const row of data.rows) {
    const cells = data.columns.map((col, idx) => {
      const rawValue = row[col.key]
      const formatted = col.format ? col.format(rawValue, row) : String(rawValue ?? '')
      return ' ' + padCell(formatted, colWidths[idx], col.align) + ' '
    })
    lines.push(borders.vertical + cells.join(borders.vertical) + borders.vertical)
  }

  // Bottom border
  lines.push(buildHorizontalLine(colWidths, borders.bottomLeft, borders.bottomRight, borders.teeUp, borders.horizontal))

  // Footer
  if (data.footer) {
    lines.push('')
    lines.push(dim(data.footer, cOpts))
  }

  return lines.join('\n')
}

// ============================================================================
// 4. Specialized Formatters
// ============================================================================

/**
 * Format a ScanResult as a technology table with summary.
 *
 * @param data - Scan result
 * @param options - Format options
 * @returns Rendered table string
 */
function formatScanResult(data: OutputScanResult, options: FormatOptions): string {
  const useTTY = options.isTTY ?? process.stdout.isTTY
  const cOpts = toColorOpts(options)

  const techTable: TableData = {
    title: 'Technologies',
    columns: [
      {
        header: 'Name',
        key: 'name',
        format: (v) => bold(String(v), cOpts),
      },
      {
        header: 'Version',
        key: 'version',
        format: (v) => v === null ? dim('unknown', cOpts) : String(v),
      },
      {
        header: 'Ecosystem',
        key: 'ecosystem',
      },
      {
        header: 'Status',
        key: 'updateAvailable',
        format: (v, row) => {
          const detected = (row as Record<string, unknown>).detected
          if (!detected) return dim('not detected', cOpts)
          if (v === true) return yellow('update available', cOpts)
          return green('up to date', cOpts)
        },
      },
    ],
    rows: data.technologies.map(tech => ({
      name: tech.name,
      version: tech.version,
      ecosystem: tech.ecosystem,
      detected: tech.detected,
      updateAvailable: tech.updateAvailable ?? false,
    })),
  }

  const parts: string[] = [renderTable(techTable, Boolean(useTTY), options)]

  // Summary section
  parts.push(formatSummary(data.summary, data.score, options))

  // Vulnerabilities section
  if (data.vulnerabilities.length > 0) {
    parts.push('')
    parts.push(formatVulnerabilityTable(data.vulnerabilities, options))
  }

  // Hardening section
  if (data.hardening.length > 0) {
    parts.push('')
    parts.push(formatHardeningTable(data.hardening, options))
  }

  return parts.join('\n')
}

/**
 * Format a summary section with scan statistics.
 *
 * @param summary - Scan summary data
 * @param score - Security score
 * @param options - Format options
 * @returns Formatted summary string
 */
function formatSummary(
  summary: OutputScanSummary,
  score: OutputSecurityScore,
  options: FormatOptions
): string {
  const cOpts = toColorOpts(options)

  const lines: string[] = ['', 'Summary']

  const scoreText = `${score.overall}/100`
  const colorizedScore = scoreColor(scoreText, score.overall, cOpts)
  lines.push(`  Score: ${colorizedScore}`)
  lines.push(`  Technologies: ${summary.detectedTechnologies}/${summary.totalTechnologies} detected`)
  lines.push(`  Vulnerabilities: ${summary.totalVulnerabilities} (${summary.criticalVulnerabilities} critical, ${summary.highVulnerabilities} high)`)
  lines.push(`  Hardening: ${summary.hardeningPassRate}% pass rate`)

  return lines.join('\n')
}

/**
 * Format vulnerabilities as a table sorted by severity.
 *
 * @param vulnerabilities - Array of vulnerabilities
 * @param options - Format options
 * @returns Rendered table string
 */
function formatVulnerabilityTable(
  vulnerabilities: OutputVulnerability[],
  options: FormatOptions
): string {
  const useTTY = options.isTTY ?? process.stdout.isTTY
  const cOpts = toColorOpts(options)

  // Sort by severity (critical first)
  const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4 }
  const sorted = [...vulnerabilities].sort(
    (a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5)
  )

  const table: TableData = {
    title: 'Vulnerabilities',
    columns: [
      {
        header: 'Severity',
        key: 'severity',
        width: 10,
        format: (v) => severityColor(String(v), String(v), cOpts),
      },
      {
        header: 'Package',
        key: 'affectedPackage',
        format: (v) => bold(String(v), cOpts),
      },
      {
        header: 'ID',
        key: 'cveId',
        format: (v) => v ? String(v) : '-',
      },
      {
        header: 'Fixed In',
        key: 'fixedVersion',
        format: (v) => v ? String(v) : dim('n/a', cOpts),
      },
      {
        header: 'CVSS',
        key: 'cvssScore',
        format: (v) => v != null ? String(v) : '-',
      },
    ],
    rows: sorted.map(vuln => ({
      severity: vuln.severity,
      affectedPackage: vuln.affectedPackage,
      cveId: vuln.cveId ?? null,
      fixedVersion: vuln.fixedVersion ?? null,
      cvssScore: vuln.cvssScore ?? null,
    })),
  }

  return renderTable(table, Boolean(useTTY), options)
}

/**
 * Format hardening results as a table.
 *
 * @param hardeningResults - Array of hardening results
 * @param options - Format options
 * @returns Rendered table string
 */
function formatHardeningTable(
  hardeningResults: OutputHardeningResult[],
  options: FormatOptions
): string {
  const useTTY = options.isTTY ?? process.stdout.isTTY
  const cOpts = toColorOpts(options)

  // Flatten all checks
  const allChecks = hardeningResults.flatMap(hr => hr.checks)

  // Sort: fail first, then warning, then error, then pass
  const statusOrder: Record<string, number> = { fail: 0, warning: 1, error: 2, pass: 3 }
  const sorted = [...allChecks].sort(
    (a, b) => (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4)
  )

  const table: TableData = {
    title: 'Hardening Checks',
    columns: [
      {
        header: 'Status',
        key: 'status',
        width: 8,
        format: (v) => {
          const s = String(v)
          const icon = s === 'pass' ? '✓' : s === 'fail' ? '✗' : s === 'warning' ? '⚠' : '!'
          return statusColor(`${icon} ${s}`, s, cOpts)
        },
      },
      {
        header: 'Check',
        key: 'title',
      },
      {
        header: 'Severity',
        key: 'severity',
        format: (v) => severityColor(String(v), String(v), cOpts),
      },
      {
        header: 'Detail',
        key: 'description',
        format: (v) => v ? String(v) : '-',
      },
    ],
    rows: sorted.map(check => ({
      status: check.status,
      title: check.title,
      severity: check.severity,
      description: check.description ?? null,
    })),
    footer: formatHardeningSummary(hardeningResults, cOpts),
  }

  return renderTable(table, Boolean(useTTY), options)
}

/**
 * Format hardening summary footer.
 *
 * @param results - Hardening results
 * @param cOpts - Color options
 * @returns Summary footer string
 */
function formatHardeningSummary(results: OutputHardeningResult[], cOpts: ColorOptions): string {
  const totals = results.reduce(
    (acc, r) => ({
      pass: acc.pass + r.summary.pass,
      fail: acc.fail + r.summary.fail,
      warning: acc.warning + r.summary.warning,
    }),
    { pass: 0, fail: 0, warning: 0 }
  )

  const parts: string[] = []
  if (totals.pass > 0) parts.push(green(`${totals.pass} passed`, cOpts))
  if (totals.fail > 0) parts.push(red(`${totals.fail} failed`, cOpts))
  if (totals.warning > 0) parts.push(yellow(`${totals.warning} warnings`, cOpts))

  return parts.join(' · ')
}

/**
 * Format a SecurityScore as a visual score with bars.
 *
 * @param score - Security score data
 * @param options - Format options
 * @returns Formatted score string with progress bars
 */
function formatSecurityScore(score: OutputSecurityScore, options: FormatOptions): string {
  const cOpts = toColorOpts(options)
  const barWidth = 20

  function makeBar(value: number): string {
    const filled = Math.round((value / 100) * barWidth)
    const empty = barWidth - filled
    const bar = '█'.repeat(filled) + '░'.repeat(empty)
    return scoreColor(bar, value, cOpts)
  }

  function formatLine(label: string, value: number): string {
    const valueStr = String(value).padStart(3)
    return `  ${label.padEnd(14)} ${makeBar(value)} ${valueStr}%`
  }

  const lines: string[] = ['Security Score']

  const overallStr = String(score.overall)
  lines.push(`  ${scoreColor(overallStr, score.overall, cOpts)}/100`)
  lines.push('')

  lines.push(formatLine('OS', score.breakdown.os))
  lines.push(formatLine('Hardening', score.breakdown.hardening))
  lines.push(formatLine('Tools', score.breakdown.tools))
  lines.push(formatLine('Dependencies', score.breakdown.dependencies))
  lines.push(formatLine('Databases', score.breakdown.databases))
  lines.push(formatLine('Criticals', score.breakdown.criticalsPenalty))

  return lines.join('\n')
}

/**
 * Format an UpdateInfo array as a table.
 *
 * @param updates - Array of update information
 * @param options - Format options
 * @returns Rendered table string
 */
function formatUpdateTable(updates: UpdateInfo[], options: FormatOptions): string {
  const useTTY = options.isTTY ?? process.stdout.isTTY
  const cOpts = toColorOpts(options)

  const available = updates.filter(u => u.updateAvailable)
  const upToDate = updates.filter(u => !u.updateAvailable)

  const parts: string[] = []

  if (available.length > 0) {
    const table: TableData = {
      title: 'Available Updates',
      columns: [
        {
          header: 'Technology',
          key: 'technology',
          format: (v) => bold(String(v), cOpts),
        },
        {
          header: 'Current',
          key: 'currentVersion',
        },
        {
          header: 'Latest',
          key: 'latestVersion',
          format: (v) => green(String(v), cOpts),
        },
        {
          header: 'Source',
          key: 'source',
          format: (v) => dim(String(v), cOpts),
        },
      ],
      rows: available.map(u => ({
        technology: u.technology,
        currentVersion: u.currentVersion,
        latestVersion: u.latestVersion,
        source: u.source,
      })),
    }
    parts.push(renderTable(table, Boolean(useTTY), options))
  }

  if (upToDate.length > 0) {
    parts.push('')
    const names = upToDate.map(u => u.technology).join(', ')
    parts.push(dim(`Up to date: ${names}`, cOpts))
  }

  return parts.join('\n')
}

// ============================================================================
// 5. Public API
// ============================================================================

/**
 * Format data as a table for terminal display.
 *
 * Supports the following data types:
 * - `OutputScanResult` — technology table + summary + vulns + hardening
 * - `OutputVulnerability[]` — vulnerability table sorted by severity
 * - `OutputHardeningResult[]` — hardening check table
 * - `OutputSecurityScore` — visual score with progress bars
 * - `UpdateInfo[]` — available updates table
 *
 * @param data - Data to format
 * @param options - Format options (color, pretty, isTTY)
 * @returns Rendered table string
 *
 * @example
 * ```ts
 * const output = formatTable(scanResult, { color: true })
 * console.log(output)
 * ```
 */
export function formatTable(
  data: OutputScanResult | OutputVulnerability[] | OutputHardeningResult[] | OutputSecurityScore | UpdateInfo[],
  options: FormatOptions = {}
): string {
  // Detect data type and dispatch to the appropriate formatter
  if (isScanResult(data)) {
    return formatScanResult(data, options)
  }
  if (isSecurityScore(data)) {
    return formatSecurityScore(data, options)
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return ''
    if (isUpdateInfoArray(data)) {
      return formatUpdateTable(data, options)
    }
    if (isVulnerabilityArray(data)) {
      return formatVulnerabilityTable(data, options)
    }
    if (isHardeningResultArray(data)) {
      return formatHardeningTable(data, options)
    }
  }

  return '[Unsupported data type for table formatting]'
}

// ============================================================================
// 6. Type Guards
// ============================================================================

function isScanResult(data: unknown): data is OutputScanResult {
  return (
    typeof data === 'object' &&
    data !== null &&
    'technologies' in data &&
    'vulnerabilities' in data &&
    'score' in data &&
    Array.isArray((data as OutputScanResult).technologies)
  )
}

function isSecurityScore(data: unknown): data is OutputSecurityScore {
  return (
    typeof data === 'object' &&
    data !== null &&
    'overall' in data &&
    'breakdown' in data &&
    typeof (data as OutputSecurityScore).overall === 'number'
  )
}

function isVulnerabilityArray(data: unknown[]): data is OutputVulnerability[] {
  return data.length > 0 && typeof data[0] === 'object' && data[0] !== null && 'severity' in data[0] && 'affectedPackage' in data[0]
}

function isHardeningResultArray(data: unknown[]): data is OutputHardeningResult[] {
  return data.length > 0 && typeof data[0] === 'object' && data[0] !== null && 'checks' in data[0] && 'summary' in data[0]
}

function isUpdateInfoArray(data: unknown[]): data is UpdateInfo[] {
  return data.length > 0 && typeof data[0] === 'object' && data[0] !== null && 'technology' in data[0] && 'currentVersion' in data[0]
}
