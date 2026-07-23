/**
 * Manel CLI — JSON Formatter
 *
 * Wraps data in a ResponseEnvelope<T> with metadata and outputs
 * as JSON (pretty-printed or compact).
 *
 * @module cli/output/json-formatter
 */

import type { FormatOptions } from './types'

// ============================================================================
// 1. JSON Formatter
// ============================================================================

/**
 * Options specific to the JSON formatter.
 */
export interface JsonFormatOptions extends FormatOptions {
  /** Whether to pretty-print the JSON (default: true) */
  pretty?: boolean
  /** Indentation spaces (default: 2, only when pretty is true) */
  indent?: number
}

/**
 * Format data as JSON wrapped in a ResponseEnvelope.
 *
 * Produces a JSON string conforming to the `ResponseEnvelope<T>` shape:
 * ```json
 * {
 *   "ok": true,
 *   "data": { ... },
 *   "error": null,
 *   "warnings": [],
 *   "meta": { "timestamp": "...", "duration": 0, "version": "..." }
 * }
 * ```
 *
 * @param data - Data to wrap and serialize
 * @param options - JSON format options
 * @returns JSON string
 *
 * @example
 * ```ts
 * const output = formatJson(scanResult, { pretty: true, version: '0.1.0' })
 * console.log(output)
 * ```
 */
export function formatJson<T>(data: T, options: JsonFormatOptions = {}): string {
  const pretty = options.pretty ?? true
  const indent = pretty ? (options.indent ?? 2) : 0

  const envelope = buildEnvelope(data, options)
  return JSON.stringify(envelope, null, indent)
}

/**
 * Build a ResponseEnvelope from data and options.
 *
 * @param data - Data to wrap
 * @param options - Format options with metadata
 * @returns ResponseEnvelope object
 */
function buildEnvelope<T>(data: T, options: FormatOptions): {
  ok: boolean
  data: T
  error: null
  warnings: string[]
  meta: {
    timestamp: string
    duration: number
    version: string
  }
} {
  return {
    ok: true,
    data,
    error: null,
    warnings: [],
    meta: {
      timestamp: new Date().toISOString(),
      duration: options.duration ?? 0,
      version: options.version ?? '0.0.0',
    },
  }
}

/**
 * Format an error as a JSON ResponseEnvelope.
 *
 * @param errorCode - Machine-readable error code
 * @param errorMessage - Human-readable error message
 * @param errorType - Error category
 * @param options - Format options with metadata
 * @returns JSON string with error envelope
 *
 * @example
 * ```ts
 * const output = formatJsonError('SCAN_FAILED', 'Could not detect technologies', 'internal')
 * console.log(output)
 * ```
 */
export function formatJsonError(
  errorCode: string,
  errorMessage: string,
  errorType: 'validation' | 'network' | 'internal' | 'not-found',
  options: FormatOptions = {}
): string {
  const pretty = options.pretty ?? true
  const indent = pretty ? (options.indent ?? 2) : 0

  const envelope = {
    ok: false,
    data: null,
    error: {
      code: errorCode,
      type: errorType,
      message: errorMessage,
      recoverable: false,
    },
    warnings: [],
    meta: {
      timestamp: new Date().toISOString(),
      duration: options.duration ?? 0,
      version: options.version ?? '0.0.0',
    },
  }

  return JSON.stringify(envelope, null, indent)
}
