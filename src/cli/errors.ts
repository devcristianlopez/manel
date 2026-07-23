/**
 * Manel CLI — Error Handling
 *
 * Structured error management with semantic exit codes,
 * machine-readable error codes, and consistent formatting.
 *
 * @module cli/errors
 */

import { type CliError, type ResponseEnvelope, ExitCode, okResponse, errorResponse } from '../shared/types'

// ============================================================================
// 1. Error Codes
// ============================================================================

/** Machine-readable error codes for CLI operations. */
export const ErrorCodes = {
  SCAN_FAILED: 'SCAN_FAILED',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  INVALID_INPUT: 'INVALID_INPUT',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  UNSUPPORTED_PLATFORM: 'UNSUPPORTED_PLATFORM',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

/** Type for error code strings. */
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

// ============================================================================
// 2. Error Factory Functions
// ============================================================================

/**
 * Create a structured CLI error.
 *
 * @param code - Machine-readable error code
 * @param type - Error category
 * @param message - Human-readable message
 * @param recoverable - Whether the error can be retried
 * @param suggestions - Optional recovery suggestions
 * @returns Structured CLI error object
 */
export function createCliError(
  code: string,
  type: CliError['type'],
  message: string,
  recoverable: boolean = false,
  suggestions?: string[]
): CliError {
  return { code, type, message, recoverable, suggestions }
}

/**
 * Create a validation error (invalid input from user).
 *
 * @param message - Error message
 * @param suggestions - Recovery suggestions
 * @returns Structured CLI error
 */
export function validationError(message: string, suggestions?: string[]): CliError {
  return createCliError(ErrorCodes.INVALID_INPUT, 'validation', message, false, suggestions)
}

/**
 * Create a network error (timeout, connection failure).
 *
 * @param message - Error message
 * @param suggestions - Recovery suggestions
 * @returns Structured CLI error
 */
export function networkError(message: string, suggestions?: string[]): CliError {
  return createCliError(ErrorCodes.NETWORK_TIMEOUT, 'network', message, true, suggestions)
}

/**
 * Create an internal error (unexpected failure).
 *
 * @param message - Error message
 * @returns Structured CLI error
 */
export function internalError(message: string): CliError {
  return createCliError(ErrorCodes.INTERNAL_ERROR, 'internal', message, false)
}

/**
 * Create a not-found error (missing file, resource).
 *
 * @param message - Error message
 * @returns Structured CLI error
 */
export function notFoundError(message: string): CliError {
  return createCliError(ErrorCodes.FILE_NOT_FOUND, 'not-found', message, false)
}

// ============================================================================
// 3. Response Envelope Helpers
// ============================================================================

/**
 * Create a success response envelope.
 *
 * @param data - Response data
 * @param duration - Execution duration in ms
 * @returns Success response envelope
 */
export function successEnvelope<T>(data: T, duration: number): ResponseEnvelope<T> {
  return okResponse(data, duration, '0.1.0')
}

/**
 * Create an error response envelope.
 *
 * @param error - CLI error
 * @param duration - Execution duration in ms
 * @param warnings - Optional warnings
 * @returns Error response envelope
 */
export function errorEnvelope(
  error: CliError,
  duration: number,
  warnings: string[] = []
): ResponseEnvelope<null> {
  return errorResponse(error, duration, '0.1.0', warnings)
}

// ============================================================================
// 4. Exit Code Mapping
// ============================================================================

/**
 * Map error type to exit code.
 *
 * @param error - CLI error
 * @returns Exit code
 */
export function errorToExitCode(error: CliError): ExitCode {
  switch (error.type) {
    case 'validation':
      return ExitCode.INVALID_INPUT
    case 'network':
      return ExitCode.ERROR
    case 'internal':
      return ExitCode.ERROR
    case 'not-found':
      return ExitCode.ERROR
    default:
      return ExitCode.ERROR
  }
}

/**
 * Determine exit code based on findings (vulnerabilities, hardening failures).
 *
 * @param hasFindings - Whether critical/high findings exist
 * @param severity - Severity threshold for --fail-on flag
 * @returns Exit code
 */
export function findingsExitCode(hasFindings: boolean, severity?: string): number {
  if (!hasFindings) return ExitCode.OK
  if (severity === 'MEDIUM' || severity === 'LOW') return ExitCode.FINDINGS
  return ExitCode.FINDINGS
}

// ============================================================================
// 5. Error Formatting
// ============================================================================

/**
 * Format error for stderr output (human-readable).
 *
 * @param error - CLI error
 * @param useColor - Whether to use ANSI colors
 * @returns Formatted error string
 */
export function formatErrorForStderr(error: CliError, useColor: boolean = true): string {
  const reset = useColor ? '\x1b[0m' : ''
  const red = useColor ? '\x1b[31m' : ''
  const yellow = useColor ? '\x1b[33m' : ''
  const dim = useColor ? '\x1b[2m' : ''

  let output = `${red}Error: ${error.message}${reset}\n`
  output += `${dim}Code: ${error.code}${reset}\n`

  if (error.suggestions && error.suggestions.length > 0) {
    output += `${yellow}Suggestions:${reset}\n`
    for (const suggestion of error.suggestions) {
      output += `${dim}  - ${suggestion}${reset}\n`
    }
  }

  if (error.recoverable) {
    output += `${yellow}This error may be transient. Try again.${reset}\n`
  }

  return output
}

/**
 * Format error for JSON output (machine-readable).
 *
 * @param error - CLI error
 * @returns JSON string of error
 */
export function formatErrorForJson(error: CliError): string {
  return JSON.stringify({ error }, null, 2)
}
