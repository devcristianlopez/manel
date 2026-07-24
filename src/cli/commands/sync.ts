/**
 * Manel CLI — Sync Command
 *
 * Downloads and indexes OSV vulnerability database dumps into the local
 * SQLite database for fully offline vulnerability queries.
 * Supports per-ecosystem selection, freshness checks, and forced re-syncs.
 *
 * @module cli/commands/sync
 */

import type { Command } from 'commander'
import { detectAll } from '../../core/scanner'
import {
  OSV_ECOSYSTEMS,
  SOFTWARE_ECOSYSTEM_MAP,
  syncEcosystem,
  getLastSync,
} from '../../core/security'
import type { OsvEcosystem } from '../../core/security'
import type { CliError, ResponseEnvelope } from '../../shared/types'
import { detectTTY, formatJsonError } from '../output'
import { green, red, dim } from '../output/colors'
import type { ColorOptions } from '../output/colors'
import type { CommonFlags } from '../flags'
import { Spinner, setActiveSpinner } from '../spinner'
import { getPackageVersion } from '../version'
import { internalError, validationError, formatErrorForStderr, successEnvelope } from '../errors'

// ============================================================================
// 1. Types & Constants
// ============================================================================

/** Sync-specific CLI flags. */
export interface SyncFlags extends CommonFlags {
  /** Comma-separated list of ecosystems to sync (e.g., 'npm,pypi') */
  ecosystem?: string
  /** Force re-sync even when local data is fresh */
  force?: boolean
}

/** Ecosystems are considered fresh for 24 hours after a successful sync. */
const FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1000

/** Warning shown before downloading the large npm dump. */
const NPM_DUMP_SIZE_WARNING = 'npm dump is ~200MB — download may take a while'

/** Successful per-ecosystem sync outcome. */
interface SyncedEntry {
  /** Ecosystem that was synced */
  ecosystem: string
  /** Number of vulnerability entries indexed */
  entries: number
  /** Wall-clock duration of the sync in milliseconds */
  durationMs: number
}

/** Skipped per-ecosystem outcome (local data still fresh). */
interface SkippedEntry {
  /** Ecosystem that was skipped */
  ecosystem: string
  /** Human-readable reason for skipping */
  reason: string
  /** Timestamp (ms epoch) of the last successful sync */
  syncedAt: number
  /** Number of entries already indexed */
  entryCount: number
}

/** Failed per-ecosystem outcome. */
interface FailedEntry {
  /** Ecosystem that failed to sync */
  ecosystem: string
  /** Error message */
  error: string
}

/** Aggregate result of a sync run. */
interface SyncSummary {
  synced: SyncedEntry[]
  skipped: SkippedEntry[]
  failed: FailedEntry[]
}

// ============================================================================
// 2. Command Registration
// ============================================================================

/**
 * Register the sync command with Commander.js.
 *
 * @param program - Commander.js program instance
 */
export function registerSyncCommand(program: Command): void {
  program
    .command('sync')
    .description('Download and index OSV vulnerability databases for offline use')
    .option('-e, --ecosystem <list>', 'Comma-separated ecosystems to sync (npm, PyPI, Maven)')
    .option('--force', 'Re-sync even when local data is fresh (< 24h)')
    .option('-f, --format <format>', 'Output format (table, json)', 'table')
    .option('--no-color', 'Disable ANSI color output')
    .option('-q, --quiet', 'Suppress non-error output')
    .option('-V, --verbose', 'Enable verbose output')
    .addHelpText('after', `
Examples:
  $ manel sync
  $ manel sync --ecosystem npm,pypi
  $ manel sync --ecosystem maven --force
  $ manel sync --format json`)
    .action(async (options: SyncFlags) => {
      process.exitCode = await executeSyncCommand(options)
    })
}

// ============================================================================
// 3. Command Execution
// ============================================================================

/**
 * Execute the sync command.
 *
 * Resolves target ecosystems, skips fresh ones (< 24h), and downloads +
 * indexes the rest. A failure in one ecosystem does not abort the others.
 *
 * @param options - Parsed CLI options
 * @returns Exit code (0 = success, 1 = some ecosystems failed, 2 = error)
 */
export async function executeSyncCommand(options: SyncFlags): Promise<number> {
  const startTime = Date.now()
  const ttyInfo = detectTTY()
  const useColor = options.color ?? ttyInfo.useColor
  const format = options.format === 'json' ? 'json' : 'table'
  const version = getPackageVersion()
  const colorOpts: ColorOptions = { forceColor: useColor }

  // Resolve target ecosystems (invalid input exits 2 before any work starts)
  let targets: OsvEcosystem[]
  if (options.ecosystem) {
    try {
      targets = parseEcosystemList(options.ecosystem)
    } catch (err) {
      const error = validationError(
        err instanceof Error ? err.message : 'Invalid ecosystem list',
        [`Valid ecosystems: ${OSV_ECOSYSTEMS.join(', ')}`]
      )
      emitError(error, format, useColor, Date.now() - startTime, version)
      return 2
    }
  } else {
    try {
      targets = detectTargetEcosystems()
    } catch (err) {
      const error = internalError(
        err instanceof Error ? err.message : 'Failed to detect installed technologies'
      )
      emitError(error, format, useColor, Date.now() - startTime, version)
      return 2
    }
  }

  const spinner = new Spinner('🔄 Syncing vulnerability databases...', { enabled: !options.quiet })
  setActiveSpinner(spinner)

  const summary: SyncSummary = { synced: [], skipped: [], failed: [] }
  const warnings: string[] = []

  try {
    for (const ecosystem of targets) {
      // Freshness check — skip ecosystems synced within the last 24h
      const lastSync = getLastSync(ecosystem)
      if (lastSync && !options.force && Date.now() - lastSync.syncedAt < FRESHNESS_WINDOW_MS) {
        const hoursAgo = Math.floor((Date.now() - lastSync.syncedAt) / (60 * 60 * 1000))
        const reason = `already fresh (synced ${hoursAgo}h ago), use --force to re-sync`
        summary.skipped.push({
          ecosystem,
          reason,
          syncedAt: lastSync.syncedAt,
          entryCount: lastSync.entryCount,
        })
        spinner.step(`  ${ecosystem}: ${reason}`)
        continue
      }

      if (ecosystem === 'npm') {
        warnings.push(NPM_DUMP_SIZE_WARNING)
        spinner.step(`  ⚠ ${NPM_DUMP_SIZE_WARNING}`)
      }

      spinner.step(`  Syncing ${ecosystem}...`)
      try {
        const result = await syncEcosystem(ecosystem, msg => spinner.step(`  ${ecosystem}: ${msg}`))
        summary.synced.push({
          ecosystem: result.ecosystem,
          entries: result.entries,
          durationMs: result.durationMs,
        })
      } catch (err) {
        // Isolate failures: one ecosystem must not abort the remaining syncs
        summary.failed.push({
          ecosystem,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  } catch (err) {
    spinner.stop()
    const error = internalError(
      err instanceof Error ? err.message : 'Unknown error during sync command'
    )
    emitError(error, format, useColor, Date.now() - startTime, version)
    return 2
  }

  const duration = Date.now() - startTime
  const hasFailures = summary.failed.length > 0

  if (format === 'json') {
    const envelope = hasFailures
      ? buildFailureEnvelope(summary, duration, version, warnings)
      : { ...successEnvelope(summary, duration, version), warnings }
    process.stdout.write(JSON.stringify(envelope, null, 2) + '\n')
  } else if (!options.quiet) {
    process.stdout.write(formatSyncReport(summary, colorOpts) + '\n')
  }

  // Failures are error output — always visible on stderr, even in quiet mode
  if (hasFailures && format !== 'json') {
    for (const failure of summary.failed) {
      process.stderr.write(red(`Error: ${failure.ecosystem}: ${failure.error}`, colorOpts) + '\n')
    }
  }

  spinner.stop(hasFailures ? '⚠ Sync completed with failures' : '✅ Sync complete')
  return hasFailures ? 1 : 0
}

// ============================================================================
// 4. Ecosystem Resolution
// ============================================================================

/**
 * Parse a comma-separated ecosystem list, matching case-insensitively
 * against the supported OSV ecosystems (e.g., 'pypi' → 'PyPI').
 *
 * @param input - Comma-separated ecosystem names
 * @returns Deduplicated list of valid ecosystems
 * @throws Error listing the unknown names when validation fails
 */
function parseEcosystemList(input: string): OsvEcosystem[] {
  const parts = input.split(',').map(part => part.trim()).filter(part => part.length > 0)
  const unknown: string[] = []
  const resolved: OsvEcosystem[] = []

  for (const part of parts) {
    const match = OSV_ECOSYSTEMS.find(eco => eco.toLowerCase() === part.toLowerCase())
    if (!match) {
      unknown.push(part)
    } else if (!resolved.includes(match)) {
      resolved.push(match)
    }
  }

  if (unknown.length > 0) {
    throw new Error(
      `Unknown ecosystem(s): ${unknown.join(', ')}. Valid ecosystems: ${OSV_ECOSYSTEMS.join(', ')}`
    )
  }
  if (resolved.length === 0) {
    throw new Error(`No valid ecosystems provided. Valid ecosystems: ${OSV_ECOSYSTEMS.join(', ')}`)
  }

  return resolved
}

/**
 * Auto-detect target ecosystems from the installed software list.
 * Maps detected technology names through SOFTWARE_ECOSYSTEM_MAP and
 * deduplicates the result. Falls back to all ecosystems when no
 * supported technology is detected.
 *
 * @returns Deduplicated list of ecosystems to sync
 */
function detectTargetEcosystems(): OsvEcosystem[] {
  const detected = new Set<OsvEcosystem>()

  for (const software of detectAll()) {
    const mapped = SOFTWARE_ECOSYSTEM_MAP[software.name]
    const match = OSV_ECOSYSTEMS.find(eco => eco === mapped)
    if (match) detected.add(match)
  }

  return detected.size > 0 ? [...detected] : [...OSV_ECOSYSTEMS]
}

// ============================================================================
// 5. Output Helpers
// ============================================================================

/**
 * Build a failure envelope that still carries the per-ecosystem breakdown,
 * so machine consumers can see which ecosystems succeeded before the failure.
 *
 * @param summary - Aggregate sync result
 * @param duration - Execution duration in ms
 * @param version - CLI version string
 * @param warnings - Non-fatal warnings collected during the run
 * @returns Response envelope with ok=false and the summary as data
 */
function buildFailureEnvelope(
  summary: SyncSummary,
  duration: number,
  version: string,
  warnings: string[]
): ResponseEnvelope<SyncSummary> {
  const failedNames = summary.failed.map(entry => entry.ecosystem).join(', ')
  const error: CliError = {
    code: 'SYNC_FAILED',
    type: 'network',
    message: `Failed to sync: ${failedNames}`,
    recoverable: true,
    suggestions: ['Check your network connection', 'Retry with --force'],
  }

  return {
    ok: false,
    data: summary,
    error,
    warnings,
    meta: {
      timestamp: new Date().toISOString(),
      duration,
      version,
    },
  }
}

/**
 * Format the per-ecosystem sync report for human consumption.
 *
 * @param summary - Aggregate sync result
 * @param colorOpts - Color options
 * @returns Multi-line report string
 */
function formatSyncReport(summary: SyncSummary, colorOpts: ColorOptions): string {
  const lines: string[] = []

  for (const entry of summary.synced) {
    const seconds = (entry.durationMs / 1000).toFixed(1)
    lines.push(green('✓', colorOpts) + ` ${entry.ecosystem}: ${entry.entries.toLocaleString('en-US')} entries indexed in ${seconds}s`)
  }
  for (const entry of summary.skipped) {
    lines.push(dim(`- ${entry.ecosystem}: ${entry.reason}`, colorOpts))
  }
  for (const entry of summary.failed) {
    lines.push(red('✗', colorOpts) + ` ${entry.ecosystem}: failed — ${entry.error}`)
  }

  if (lines.length === 0) {
    lines.push(dim('Nothing to sync.', colorOpts))
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
