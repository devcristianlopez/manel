/**
 * Manel CLI — ANSI Color Utilities
 *
 * Provides wrapper functions for ANSI escape sequences that automatically
 * respect the NO_COLOR / FORCE_COLOR environment variables and TTY detection.
 *
 * All functions return the original string when colors are disabled.
 * Pass `forceColor: true` to override auto-detection.
 *
 * @module cli/output/colors
 */

import { shouldUseColor } from './tty'

// ============================================================================
// 1. ANSI Escape Codes
// ============================================================================

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
} as const

// ============================================================================
// 2. Color Options
// ============================================================================

/**
 * Options for color functions.
 */
export interface ColorOptions {
  /** Force colors on, regardless of TTY detection */
  forceColor?: boolean
  /** Output stream for TTY detection (when forceColor is not set) */
  stdout?: NodeJS.WriteStream
}

// ============================================================================
// 3. Core Wrap Function
// ============================================================================

/**
 * Wrap text with ANSI escape codes if colors are enabled.
 *
 * @param text - Text to wrap
 * @param openCode - Opening ANSI escape code
 * @param options - Color options
 * @returns Wrapped text, or original text if colors disabled
 */
function wrap(text: string, openCode: string, options?: ColorOptions): string {
  const useColor = options?.forceColor ?? shouldUseColor(options?.stdout)
  if (!useColor) return text
  return `${openCode}${text}${ANSI.reset}`
}

// ============================================================================
// 4. Color Functions
// ============================================================================

/**
 * Wrap text in red.
 *
 * @param text - Text to colorize
 * @param options - Color options
 * @returns Red-colored text (or plain text if colors disabled)
 */
export function red(text: string, options?: ColorOptions): string {
  return wrap(text, ANSI.red, options)
}

/**
 * Wrap text in green.
 *
 * @param text - Text to colorize
 * @param options - Color options
 * @returns Green-colored text (or plain text if colors disabled)
 */
export function green(text: string, options?: ColorOptions): string {
  return wrap(text, ANSI.green, options)
}

/**
 * Wrap text in yellow.
 *
 * @param text - Text to colorize
 * @param options - Color options
 * @returns Yellow-colored text (or plain text if colors disabled)
 */
export function yellow(text: string, options?: ColorOptions): string {
  return wrap(text, ANSI.yellow, options)
}

/**
 * Wrap text in blue.
 *
 * @param text - Text to colorize
 * @param options - Color options
 * @returns Blue-colored text (or plain text if colors disabled)
 */
export function blue(text: string, options?: ColorOptions): string {
  return wrap(text, ANSI.blue, options)
}

/**
 * Wrap text in cyan.
 *
 * @param text - Text to colorize
 * @param options - Color options
 * @returns Cyan-colored text (or plain text if colors disabled)
 */
export function cyan(text: string, options?: ColorOptions): string {
  return wrap(text, ANSI.cyan, options)
}

/**
 * Wrap text in magenta.
 *
 * @param text - Text to colorize
 * @param options - Color options
 * @returns Magenta-colored text (or plain text if colors disabled)
 */
export function magenta(text: string, options?: ColorOptions): string {
  return wrap(text, ANSI.magenta, options)
}

/**
 * Wrap text in bold.
 *
 * @param text - Text to bold
 * @param options - Color options
 * @returns Bold text (or plain text if colors disabled)
 */
export function bold(text: string, options?: ColorOptions): string {
  return wrap(text, ANSI.bold, options)
}

/**
 * Wrap text in dim/faint.
 *
 * @param text - Text to dim
 * @param options - Color options
 * @returns Dimmed text (or plain text if colors disabled)
 */
export function dim(text: string, options?: ColorOptions): string {
  return wrap(text, ANSI.dim, options)
}

/**
 * Return the ANSI reset code (or empty string if colors disabled).
 *
 * @param options - Color options
 * @returns Reset sequence
 */
export function reset(options?: ColorOptions): string {
  const useColor = options?.forceColor ?? shouldUseColor(options?.stdout)
  if (!useColor) return ''
  return ANSI.reset
}

// ============================================================================
// 5. Severity Color Helper
// ============================================================================

/** Color mapping for severity levels. */
const SEVERITY_COLORS: Record<string, (text: string, options?: ColorOptions) => string> = {
  CRITICAL: red,
  HIGH: red,
  MEDIUM: yellow,
  LOW: cyan,
  UNKNOWN: dim,
  NONE: dim,
}

/**
 * Colorize text based on a severity level.
 *
 * @param text - Text to colorize
 * @param severity - Severity level string
 * @param options - Color options
 * @returns Colorized text
 */
export function severityColor(text: string, severity: string, options?: ColorOptions): string {
  const colorFn = SEVERITY_COLORS[severity] ?? dim
  return colorFn(text, options)
}

/**
 * Colorize text based on a check status.
 *
 * @param text - Text to colorize
 * @param status - Check status string
 * @param options - Color options
 * @returns Colorized text
 */
export function statusColor(text: string, status: string, options?: ColorOptions): string {
  switch (status) {
    case 'pass': return green(text, options)
    case 'fail': return red(text, options)
    case 'warning': return yellow(text, options)
    case 'error': return red(text, options)
    default: return dim(text, options)
  }
}

/**
 * Colorize a score value based on its magnitude.
 *
 * @param text - Text representation of the score
 * @param score - Numeric score (0-100)
 * @param options - Color options
 * @returns Colorized text
 */
export function scoreColor(text: string, score: number, options?: ColorOptions): string {
  if (score >= 80) return green(text, options)
  if (score >= 60) return yellow(text, options)
  if (score >= 40) return red(text, options)
  return red(bold(text, options), options)
}
