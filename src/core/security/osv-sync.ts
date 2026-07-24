/**
 * Manel Core — OSV Offline Sync
 *
 * Downloads OSV vulnerability database dumps per ecosystem and
 * indexes them into the local SQLite vuln_db table for fully
 * offline vulnerability queries.
 *
 * @module core/security/osv-sync
 */

import { getDatabase } from '../database'
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { execFileSync } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { homedir } from 'os'
import type { Severity } from '../types'

// ============================================================================
// 1. Types & Constants
// ============================================================================

/** Ecosystems supported by the offline OSV sync. */
export const OSV_ECOSYSTEMS = ['npm', 'PyPI', 'Maven'] as const

/** Union type of supported ecosystem names. */
export type OsvEcosystem = typeof OSV_ECOSYSTEMS[number]

/** Result of a single ecosystem sync operation. */
export interface SyncResult {
  /** Ecosystem that was synced */
  ecosystem: string
  /** Number of vulnerability rows inserted */
  entries: number
  /** Wall-clock duration of the sync in milliseconds */
  durationMs: number
}

/** Base URL for OSV data dumps. */
const OSV_DUMP_BASE_URL = 'https://osv-vulnerabilities.storage.googleapis.com'

/** Number of rows inserted per transaction commit. */
const INSERT_CHUNK_SIZE = 1000

// ============================================================================
// 2. OSV Dump Entry Types
// ============================================================================

interface OsvRangeEvent {
  introduced?: string
  fixed?: string
  last_affected?: string
}

interface OsvRange {
  type: string
  events?: OsvRangeEvent[]
}

interface OsvAffected {
  package: { name: string; ecosystem: string }
  ranges?: OsvRange[]
  versions?: string[]
}

interface OsvEntry {
  id: string
  aliases?: string[]
  summary?: string
  severity?: Array<{ type: string; score: string }>
  affected?: OsvAffected[]
  database_specific?: { severity?: string }
}

// ============================================================================
// 3. Sync Metadata
// ============================================================================

/**
 * Get the last sync metadata for an ecosystem.
 *
 * @param ecosystem - Ecosystem name (e.g., 'npm', 'PyPI', 'Maven')
 * @returns Sync timestamp and entry count, or null if never synced
 */
export function getLastSync(ecosystem: string): { syncedAt: number; entryCount: number } | null {
  try {
    const db = getDatabase()
    const row = db.prepare(
      'SELECT synced_at, entry_count FROM sync_metadata WHERE ecosystem = ?'
    ).get(ecosystem) as { synced_at: number; entry_count: number } | undefined
    if (!row) return null
    return { syncedAt: row.synced_at, entryCount: row.entry_count }
  } catch {
    return null
  }
}

// ============================================================================
// 4. Severity Normalization
// ============================================================================

/**
 * Convert a CVSS base score to a severity level.
 *
 * @param score - CVSS score (0.0 - 10.0)
 * @returns Severity level
 */
function severityFromCvss(score: number): Severity {
  if (score >= 9.0) return 'CRITICAL'
  if (score >= 7.0) return 'HIGH'
  if (score >= 4.0) return 'MEDIUM'
  if (score >= 0.1) return 'LOW'
  return 'NONE'
}

/**
 * Resolve the severity for an OSV entry.
 *
 * Priority:
 *   1. database_specific.severity (qualitative string)
 *   2. Numeric parse of severity[].score (CVSS base score)
 *   3. 'NONE' fallback (vector strings are not parsed)
 *
 * @param entry - Parsed OSV JSON entry
 * @returns Normalized severity level
 */
function resolveSeverity(entry: OsvEntry): Severity {
  const dbSev = entry.database_specific?.severity
  if (dbSev) {
    const upper = dbSev.toUpperCase().trim()
    if (upper === 'CRITICAL') return 'CRITICAL'
    if (upper === 'HIGH') return 'HIGH'
    if (upper === 'MODERATE' || upper === 'MEDIUM') return 'MEDIUM'
    if (upper === 'LOW') return 'LOW'
  }
  if (entry.severity) {
    for (const sev of entry.severity) {
      const score = parseFloat(sev.score)
      if (!isNaN(score)) {
        return severityFromCvss(score)
      }
    }
  }
  return 'NONE'
}

// ============================================================================
// 5. OSV Entry Parsing
// ============================================================================

/**
 * Extract CVE aliases from an OSV entry.
 *
 * Filters to aliases starting with 'CVE-'; keeps all aliases
 * if none match the CVE prefix.
 *
 * @param aliases - Raw alias array from the OSV entry
 * @returns JSON string of filtered aliases
 */
function extractAliases(aliases: string[] | undefined): string {
  if (!aliases || aliases.length === 0) return '[]'
  const cves = aliases.filter(a => typeof a === 'string' && a.startsWith('CVE-'))
  return JSON.stringify(cves.length > 0 ? cves : aliases)
}

/**
 * Collect range events from an affected block.
 *
 * Flattens events from all ranges with type 'SEMVER' or 'ECOSYSTEM'.
 *
 * @param affected - OSV affected block
 * @returns Flat array of range events
 */
function collectEvents(affected: OsvAffected): OsvRangeEvent[] {
  const events: OsvRangeEvent[] = []
  if (!affected.ranges) return events
  for (const range of affected.ranges) {
    if ((range.type === 'SEMVER' || range.type === 'ECOSYSTEM') && range.events) {
      events.push(...range.events)
    }
  }
  return events
}

// ============================================================================
// 6. Sync
// ============================================================================

/**
 * Download and index the OSV vulnerability dump for an ecosystem.
 *
 * Downloads the all.zip dump from the OSV GCS bucket, extracts it
 * with the system unzip command, and bulk-inserts every vulnerability
 * into the local vuln_db table.
 *
 * @param ecosystem - Target ecosystem ('npm', 'PyPI', or 'Maven')
 * @param onProgress - Optional callback for progress messages
 * @returns Sync result with entry count and duration
 * @throws If the database is not initialized or the download/extraction fails
 */
export async function syncEcosystem(
  ecosystem: OsvEcosystem,
  onProgress?: (msg: string) => void
): Promise<SyncResult> {
  const startMs = Date.now()
  const tempDir = mkdtempSync(join(tmpdir(), 'manel-osv-'))

  try {
    // --------------------------------------------------------------
    // Download
    // --------------------------------------------------------------
    onProgress?.('downloading')
    const url = `${OSV_DUMP_BASE_URL}/${ecosystem}/all.zip`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`OSV dump download failed: ${response.status} ${response.statusText}`)
    }
    const buffer = await response.arrayBuffer()
    const zipPath = join(tempDir, 'all.zip')
    writeFileSync(zipPath, Buffer.from(buffer))

    // --------------------------------------------------------------
    // Extract
    // --------------------------------------------------------------
    onProgress?.('extracting')
    const extractDir = join(tempDir, 'extracted')
    mkdirSync(extractDir, { recursive: true })
    execFileSync('unzip', ['-o', '-q', zipPath, '-d', extractDir])

    // --------------------------------------------------------------
    // Parse
    // --------------------------------------------------------------
    const files = readdirSync(extractDir).filter(f => f.endsWith('.json'))
    onProgress?.(`parsing ${files.length} files`)

    const db = getDatabase()

    // Remove stale rows for this ecosystem before inserting fresh data
    db.prepare('DELETE FROM vuln_db WHERE ecosystem = ?').run(ecosystem)

    interface VulnRow {
      id: string
      packageName: string
      aliases: string
      severity: Severity
      summary: string
      events: string | null
      versions: string | null
    }

    const rows: VulnRow[] = []
    for (const file of files) {
      try {
        const raw = readFileSync(join(extractDir, file), 'utf-8')
        const entry: OsvEntry = JSON.parse(raw)
        const aliases = extractAliases(entry.aliases)
        const severity = resolveSeverity(entry)
        const summary = entry.summary ?? ''

        if (!entry.affected) continue
        for (const affected of entry.affected) {
          if (affected.package.ecosystem.toLowerCase() !== ecosystem.toLowerCase()) continue
          const events = collectEvents(affected)
          rows.push({
            id: entry.id,
            packageName: affected.package.name.toLowerCase(),
            aliases,
            severity,
            summary,
            events: events.length > 0 ? JSON.stringify(events) : null,
            versions: affected.versions ? JSON.stringify(affected.versions) : null,
          })
        }
      } catch {
        // Skip malformed JSON files — a single bad entry must not abort the sync
        continue
      }
    }

    // --------------------------------------------------------------
    // Insert (chunked transactions)
    // --------------------------------------------------------------
    onProgress?.('inserting')
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO vuln_db (id, ecosystem, package_name, aliases, severity, summary, events, versions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    let inserted = 0
    for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
      const chunk = rows.slice(i, i + INSERT_CHUNK_SIZE)
      const insertChunk = db.transaction((items: VulnRow[]) => {
        for (const item of items) {
          stmt.run(item.id, ecosystem, item.packageName, item.aliases, item.severity, item.summary, item.events, item.versions)
        }
      })
      insertChunk(chunk)
      inserted += chunk.length
    }

    // --------------------------------------------------------------
    // Update sync metadata
    // --------------------------------------------------------------
    db.prepare(
      'INSERT OR REPLACE INTO sync_metadata (ecosystem, synced_at, entry_count) VALUES (?, ?, ?)'
    ).run(ecosystem, Date.now(), inserted)

    onProgress?.('done')
    return {
      ecosystem,
      entries: inserted,
      durationMs: Date.now() - startMs,
    }
  } finally {
    // --------------------------------------------------------------
    // Cleanup
    // --------------------------------------------------------------
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Best-effort cleanup — temp dir removal failure is non-fatal
    }
  }
}
