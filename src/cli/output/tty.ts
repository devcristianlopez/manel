/**
 * Manel CLI — TTY Detection Utility
 *
 * Detects whether stdout is a TTY (interactive terminal) and respects
 * the NO_COLOR and FORCE_COLOR environment variables per https://no-color.org/.
 *
 * Priority: FORCE_COLOR > NO_COLOR > process.stdout.isTTY
 *
 * @module cli/output/tty
 */

/**
 * Result of TTY and color capability detection.
 */
export interface TtyInfo {
  /** Whether stdout is connected to a TTY */
  isTTY: boolean
  /** Whether colors should be enabled (considers env vars) */
  useColor: boolean
}

/**
 * Detect TTY status and resolve whether colors should be used.
 *
 * - `FORCE_COLOR` env var forces colors on (any non-empty value)
 * - `NO_COLOR` env var disables colors (any non-empty value)
 * - Otherwise, uses `process.stdout.isTTY`
 *
 * @param stdout - The output stream to check (defaults to process.stdout)
 * @returns TTY detection result
 *
 * @example
 * ```ts
 * const { isTTY, useColor } = detectTTY()
 * if (useColor) {
 *   console.log(red('Error!'))
 * } else {
 *   console.log('Error!')
 * }
 * ```
 */
export function detectTTY(stdout: NodeJS.WriteStream = process.stdout): TtyInfo {
  const forceColor = getEnvFlag('FORCE_COLOR')
  const noColor = getEnvFlag('NO_COLOR')

  const isTTY = Boolean(stdout.isTTY)

  let useColor: boolean
  if (forceColor) {
    useColor = true
  } else if (noColor) {
    useColor = false
  } else {
    useColor = isTTY
  }

  return { isTTY, useColor }
}

/**
 * Convenience function: returns whether colors should be enabled.
 *
 * @param stdout - The output stream to check (defaults to process.stdout)
 * @returns `true` if colors should be used
 */
export function shouldUseColor(stdout: NodeJS.WriteStream = process.stdout): boolean {
  return detectTTY(stdout).useColor
}

/**
 * Read an environment variable and return `true` if it is set to a
 * truthy value (non-empty string, not "0", not "false").
 *
 * @param name - Environment variable name
 * @returns Whether the flag is truthy
 */
function getEnvFlag(name: string): boolean {
  const value = process.env[name]
  if (value === undefined || value === '') return false
  if (value === '0' || value === 'false') return false
  return true
}
