/**
 * Manel CLI — Output Engine Types
 *
 * Type definitions for the output formatting system.
 * These types describe the formatter interface, options, and
 * the data shapes each formatter accepts.
 *
 * @module cli/output/types
 */

import type { OutputFormat, UpdateInfo } from '@shared/types'

// ============================================================================
// 1. Formatter Options
// ============================================================================

/**
 * Common options accepted by all formatters.
 */
export interface FormatOptions {
  /** Whether to use ANSI colors (auto-detected from TTY if omitted) */
  color?: boolean
  /** Whether to pretty-print JSON output (default: true for json/sarif, false for ndjson) */
  pretty?: boolean
  /** Number of spaces for JSON indentation (default: 2) */
  indent?: number
  /** CLI version string for metadata in output */
  version?: string
  /** Execution duration in milliseconds for metadata */
  duration?: number
  /** Whether stdout is a TTY (used by table formatter for border style) */
  isTTY?: boolean
}

// ============================================================================
// 2. Formatter Function Signature
// ============================================================================

/**
 * A formatter function that converts data into a string representation.
 *
 * @param data - The data to format
 * @param options - Formatting options
 * @returns Formatted string output
 */
export type FormatterFn<T = unknown> = (data: T, options?: FormatOptions) => string

// ============================================================================
// 3. Table Column Definition
// ============================================================================

/**
 * Definition of a single column in a table.
 */
export interface TableColumn {
  /** Header text */
  header: string
  /** Key to extract from each row object */
  key: string
  /** Column width (auto-calculated if omitted) */
  width?: number
  /** Optional alignment: 'left' | 'center' | 'right' (default: 'left') */
  align?: 'left' | 'center' | 'right'
  /** Optional cell formatter function */
  format?: (value: unknown, row: Record<string, unknown>) => string
}

/**
 * A table to be rendered.
 */
export interface TableData {
  /** Column definitions */
  columns: TableColumn[]
  /** Row data (array of objects) */
  rows: Array<Record<string, unknown>>
  /** Optional table title */
  title?: string
  /** Optional footer text */
  footer?: string
}

// ============================================================================
// 4. Data Shape Detection
// ============================================================================

/**
 * Shape of a Vulnerability as used by the new CLI output engine.
 * Matches the interface defined in shared/types.ts (ScanResult.vulnerabilities).
 */
export interface OutputVulnerability {
  id: string
  source: string
  severity: string
  title: string
  description: string
  affectedPackage: string
  affectedVersions: string
  fixedVersion?: string
  cvssScore?: number
  cveId?: string
  references: string[]
}

/**
 * Shape of a HardeningCheck as used by the new CLI output engine.
 * Matches the interface defined in shared/types.ts (HardeningResult.checks).
 */
export interface OutputHardeningCheck {
  id: string
  title: string
  status: 'pass' | 'fail' | 'warning' | 'error'
  severity: string
  description?: string
  recommendation?: string
}

/**
 * Shape of a HardeningResult as used by the new CLI output engine.
 */
export interface OutputHardeningResult {
  checks: OutputHardeningCheck[]
  summary: {
    pass: number
    fail: number
    warning: number
  }
}

/**
 * Shape of a Technology as used by the new CLI output engine.
 */
export interface OutputTechnology {
  name: string
  version: string | null
  detected: boolean
  ecosystem: string
  latestVersion?: string
  updateAvailable?: boolean
}

/**
 * Shape of SecurityScore as used by the new CLI output engine.
 */
export interface OutputSecurityScore {
  overall: number
  breakdown: {
    os: number
    hardening: number
    tools: number
    dependencies: number
    databases: number
    criticalsPenalty: number
  }
}

/**
 * Shape of ScanSummary as used by the new CLI output engine.
 */
export interface OutputScanSummary {
  totalTechnologies: number
  detectedTechnologies: number
  totalVulnerabilities: number
  criticalVulnerabilities: number
  highVulnerabilities: number
  hardeningPassRate: number
}

/**
 * Complete ScanResult shape for the output engine.
 */
export interface OutputScanResult {
  technologies: OutputTechnology[]
  vulnerabilities: OutputVulnerability[]
  hardening: OutputHardeningResult[]
  score: OutputSecurityScore
  summary: OutputScanSummary
}

// ============================================================================
// 5. NDJSON Line Types
// ============================================================================

/**
 * A single NDJSON line representing a technology.
 */
export interface NdjsonTechnologyLine {
  type: 'technology'
  name: string
  version: string | null
  detected: boolean
  ecosystem: string
  latestVersion?: string
  updateAvailable?: boolean
}

/**
 * A single NDJSON line representing a vulnerability.
 */
export interface NdjsonVulnerabilityLine {
  type: 'vulnerability'
  id: string
  source: string
  severity: string
  title: string
  affectedPackage: string
  affectedVersions: string
  fixedVersion?: string
  cvssScore?: number
  cveId?: string
}

/**
 * A single NDJSON line representing a hardening check result.
 */
export interface NdjsonHardeningLine {
  type: 'hardening'
  id: string
  title: string
  status: string
  severity: string
}

/**
 * A single NDJSON line representing a score summary.
 */
export interface NdjsonScoreLine {
  type: 'score'
  overall: number
  breakdown: OutputSecurityScore['breakdown']
}

/**
 * A single NDJSON line representing scan metadata.
 */
export interface NdjsonMetaLine {
  type: 'meta'
  timestamp: string
  totalTechnologies: number
  totalVulnerabilities: number
  hardeningPassRate: number
}

/**
 * Union of all possible NDJSON line types.
 */
export type NdjsonLine =
  | NdjsonTechnologyLine
  | NdjsonVulnerabilityLine
  | NdjsonHardeningLine
  | NdjsonScoreLine
  | NdjsonMetaLine

// Re-export UpdateInfo for convenience
export type { UpdateInfo }
