/**
 * Manel CLI — Spinner
 *
 * Zero-dependency progress spinner for long-running CLI operations.
 * Auto-detects TTY and falls back to simple line output for pipes.
 * Respects NO_COLOR environment variable.
 *
 * @module cli/spinner
 */

import { shouldUseColor } from './output/tty'

// ============================================================================
// 1. Types
// ============================================================================

export interface SpinnerOptions {
  /** Whether to enable the spinner animation (auto-detected from TTY) */
  enabled?: boolean
  /** Stream to write to (default: stderr) */
  stream?: NodeJS.WriteStream
}

// ============================================================================
// 2. Spinner Class
// ============================================================================

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const FRAME_INTERVAL_MS = 80

/**
 * Interactive spinner for CLI progress feedback.
 *
 * In TTY mode: shows animated spinner with step messages.
 * In pipe/non-TTY mode: outputs one line per step.
 * In quiet mode: produces no output.
 *
 * @example
 * ```ts
 * const spinner = new Spinner('Scanning...')
 * spinner.step('Detecting technologies...')
 * spinner.step('Analyzing vulnerabilities...')
 * spinner.stop('✅ Scan complete')
 * ```
 */
export class Spinner {
  private frames = FRAMES
  private frameIndex = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private currentMessage = ''
  private finalMessage: string | null = null
  private readonly isTTY: boolean
  private readonly stream: NodeJS.WriteStream
  private stopped = false

  constructor(message: string, options: SpinnerOptions = {}) {
    this.stream = options.stream ?? process.stderr
    this.isTTY = options.enabled ?? !!this.stream.isTTY
    this.currentMessage = message

    if (this.isTTY) {
      // Hide cursor and start animation
      this.stream.write('\x1b[?25l')
      this.render()
      this.timer = setInterval(() => this.render(), FRAME_INTERVAL_MS)
    } else if (options.enabled !== false) {
      // Non-TTY: write a single line
      this.stream.write(`${message}\n`)
    }
  }

  /**
   * Update the spinner message.
   *
   * In TTY mode: updates the message and the next render cycle displays it.
   * In non-TTY mode: writes the message directly as a new line.
   *
   * @param message - New message to display
   */
  step(message: string): void {
    if (this.stopped) return
    this.currentMessage = message

    // In non-TTY mode (no real terminal), write step messages directly
    // so they appear immediately instead of waiting for async timer
    if (!this.stream.isTTY) {
      this.stream.write(`${message}\n`)
    }
  }

  /**
   * Stop the spinner and optionally show a final message.
   *
   * @param finalMessage - Optional message to display after stopping
   */
  stop(finalMessage?: string): void {
    if (this.stopped) return
    this.stopped = true

    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    if (this.isTTY) {
      // Clear the spinner line
      this.stream.write('\r\x1b[K')
      // Show cursor
      this.stream.write('\x1b[?25h')
      // Write final message if provided
      if (finalMessage) {
        this.stream.write(`${finalMessage}\n`)
      }
    }

    this.finalMessage = finalMessage ?? null
  }

  /**
   * Get the final message displayed when the spinner stopped.
   */
  getFinalMessage(): string | null {
    return this.finalMessage
  }

  /**
   * Check if the spinner is still running.
   */
  isActive(): boolean {
    return !this.stopped
  }

  private render(): void {
    if (this.stopped) return
    const frame = this.frames[this.frameIndex]
    this.stream.write(`\r${frame} ${this.currentMessage}`)
    this.frameIndex = (this.frameIndex + 1) % this.frames.length
  }
}

// ============================================================================
// 3. Global Spinner Registry (for signal handling)
// ============================================================================

let activeSpinner: Spinner | null = null

/**
 * Set the globally active spinner (for signal handling).
 *
 * @param spinner - The active spinner, or null to clear
 */
export function setActiveSpinner(spinner: Spinner | null): void {
  activeSpinner = spinner
}

/**
 * Get the globally active spinner.
 *
 * @returns The active spinner, or null
 */
export function getActiveSpinner(): Spinner | null {
  return activeSpinner
}

/**
 * Stop the globally active spinner if one exists.
 *
 * @param finalMessage - Optional final message
 */
export function stopActiveSpinner(finalMessage?: string): void {
  if (activeSpinner) {
    activeSpinner.stop(finalMessage)
    activeSpinner = null
  }
}
