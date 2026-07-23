/**
 * Manel CLI — Shared Flags
 *
 * Common CLI flags and options shared across all commands.
 * Provides standardization and validation for CLI options.
 *
 * @module cli/flags
 */

import type { OutputFormat, Severity } from '../shared/types'
import { isOutputFormat, isSeverity } from '../shared/types'

// ============================================================================
// 1. Flag Definitions
// ============================================================================

/** Standard output format flag. */
export const FORMAT_FLAG = {
  long: '--format',
  short: '-f',
  description: 'Output format',
  default: 'table',
  choices: ['json', 'sarif', 'table', 'ndjson'] as const,
} as const

/** Output file flag. */
export const OUTPUT_FLAG = {
  long: '--output',
  short: '-o',
  description: 'Write output to file instead of stdout',
} as const

/** Severity filter flag. */
export const SEVERITY_FLAG = {
  long: '--severity',
  short: '-s',
  description: 'Filter by severity levels (comma-separated)',
  choices: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const,
} as const

/** Fail-on severity flag. */
export const FAIL_ON_FLAG = {
  long: '--fail-on',
  description: 'Exit with code 1 if findings at or above this severity',
  choices: ['critical', 'high', 'medium', 'low'] as const,
} as const

/** Disable colors flag. */
export const NO_COLOR_FLAG = {
  long: '--no-color',
  description: 'Disable ANSI color output',
} as const

/** Quiet mode flag. */
export const QUIET_FLAG = {
  long: '--quiet',
  short: '-q',
  description: 'Suppress non-error output',
} as const

/** Verbose mode flag. */
export const VERBOSE_FLAG = {
  long: '--verbose',
  short: '-V',
  description: 'Enable verbose output',
} as const

// ============================================================================
// 2. Flag Option Types
// ============================================================================

/** Parsed CLI flags for all commands. */
export interface CommonFlags {
  /** Output format */
  format?: OutputFormat
  /** Output file path */
  output?: string
  /** Severity filter */
  severity?: string
  /** Fail-on threshold */
  failOn?: string
  /** Disable colors */
  color?: boolean
  /** Quiet mode */
  quiet?: boolean
  /** Verbose mode */
  verbose?: boolean
}

// ============================================================================
// 3. Flag Validation
// ============================================================================

/**
 * Validate that a string is a valid output format.
 *
 * @param format - Format string to validate
 * @returns True if valid, false otherwise
 */
export function isValidFormat(format: string): format is OutputFormat {
  return isOutputFormat(format)
}

/**
 * Validate that a string is a valid severity level.
 *
 * @param severity - Severity string to validate
 * @returns True if valid, false otherwise
 */
export function isValidSeverity(severity: string): severity is Severity {
  return isSeverity(severity)
}

/**
 * Parse comma-separated severity values.
 *
 * @param input - Comma-separated severity string
 * @returns Array of valid severity levels
 */
export function parseSeverityFilter(input: string): Severity[] {
  const parts = input.split(',').map(s => s.trim().toUpperCase())
  return parts.filter(isSeverity)
}

/**
 * Normalize fail-on severity to uppercase.
 *
 * @param severity - Severity string (case-insensitive)
 * @returns Uppercase severity string
 */
export function normalizeFailOn(severity: string): string {
  return severity.toUpperCase()
}
