/**
 * Manel Core — Local Vulnerability Query
 *
 * Queries the local vuln_db (synced from OSV dumps) for
 * vulnerabilities affecting a given package version.
 * Zero network access.
 *
 * @module core/security/local-query
 */

import { getDatabase } from '../database'
import type { CoreVulnerability, Severity } from '../types'

// ============================================================================
// 1. Types & Constants
// ============================================================================

/** Raw row shape from the vuln_db table. */
interface VulnDbRow {
  id: string
  ecosystem: string
  package_name: string
  aliases: string | null
  severity: string
  summary: string | null
  events: string | null
  versions: string | null
}

/** Single range event from an OSV SEMVER/ECOSYSTEM range. */
interface RangeEvent {
  introduced?: string
  fixed?: string
  last_affected?: string
}

/** Maximum age of a sync before local data is considered stale (7 days). */
const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000

// ============================================================================
// 2. Version Comparison
// ============================================================================

/**
 * Compare two dotted version strings numerically.
 *
 * Missing segments are treated as 0 (e.g., '1.2' === '1.2.0').
 *
 * @param a - First version string
 * @param b - Second version string
 * @returns Negative if a < b, zero if equal, positive if a > b
 */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

// ============================================================================
// 3. Affected-Version Matching
// ============================================================================

/**
 * Check whether a version falls inside any range described by a flat
 * OSV event list.
 *
 * Events arrive as a flat array like [{introduced:"0"},{fixed:"1.2"}].
 * An event with `introduced` opens a range; `fixed` / `last_affected`
 * closes it. A version is affected when introduced <= version and
 * (no fixed OR version < fixed) and (no last_affected OR
 * version <= last_affected).
 *
 * @param events - Flat array of range events
 * @param version - Version to test
 * @returns True if the version is inside any range
 */
function isVersionInEvents(events: RangeEvent[], version: string): boolean {
  let introduced: string | null = null
  for (const event of events) {
    if (event.introduced !== undefined) {
      introduced = event.introduced
    }
    if (introduced === null) continue
    if (event.fixed !== undefined || event.last_affected !== undefined) {
      const range: RangeEvent = { introduced }
      if (event.fixed !== undefined) range.fixed = event.fixed
      if (event.last_affected !== undefined) range.last_affected = event.last_affected
      if (isVersionInRange(range, version)) return true
      introduced = null
    }
  }
  // Unclosed range: affected from introduced onwards
  if (introduced !== null) {
    return compareVersions(introduced, version) <= 0
  }
  return false
}

/**
 * Check whether a version falls inside a single opened range.
 *
 * @param range - Range with an `introduced` bound and optional closers
 * @param version - Version to test
 * @returns True if the version is inside the range
 */
function isVersionInRange(range: RangeEvent, version: string): boolean {
  if (range.introduced === undefined) return false
  if (compareVersions(range.introduced, version) > 0) return false
  if (range.fixed !== undefined && compareVersions(version, range.fixed) >= 0) return false
  if (range.last_affected !== undefined && compareVersions(version, range.last_affected) > 0) return false
  return true
}

/**
 * Determine whether a row from vuln_db affects the given version.
 *
 * Priority:
 *   1. Explicit `versions` list (authoritative when present)
 *   2. Range `events`
 *   3. Conservative fallback: treat as affected
 *
 * @param row - Row from vuln_db
 * @param version - Version to test
 * @returns True if the row applies to the version
 */
function rowAffectsVersion(row: VulnDbRow, version: string): boolean {
  if (row.versions) {
    try {
      const versions = JSON.parse(row.versions) as string[]
      if (Array.isArray(versions)) {
        return versions.includes(version)
      }
    } catch {
      // Malformed JSON — fall through to events
    }
  }
  if (row.events) {
    try {
      const events = JSON.parse(row.events) as RangeEvent[]
      if (Array.isArray(events) && events.length > 0) {
        return isVersionInEvents(events, version)
      }
    } catch {
      // Malformed JSON — fall through to conservative default
    }
  }
  return true
}

// ============================================================================
// 4. Local Query
// ============================================================================

/**
 * Query the local vulnerability database for a package version.
 *
 * Returns every vuln_db row matching the ecosystem/package that
 * affects the given version. Performs no network access. Returns
 * an empty array when the database is not initialized or no local
 * data exists.
 *
 * @param ecosystem - Package ecosystem (e.g., 'npm', 'PyPI', 'Maven')
 * @param packageName - Package name (case-insensitive)
 * @param version - Installed version to check
 * @returns Array of matching vulnerabilities
 */
export function queryLocalDB(
  ecosystem: string,
  packageName: string,
  version: string
): CoreVulnerability[] {
  try {
    const db = getDatabase()
    const rows = db.prepare(
      'SELECT * FROM vuln_db WHERE ecosystem = ? AND package_name = ?'
    ).all(ecosystem, packageName.toLowerCase()) as VulnDbRow[]

    const results: CoreVulnerability[] = []
    for (const row of rows) {
      if (!rowAffectsVersion(row, version)) continue

      let aliases: string[] = []
      if (row.aliases) {
        try {
          const parsed = JSON.parse(row.aliases) as string[]
          if (Array.isArray(parsed)) aliases = parsed
        } catch {
          // Malformed aliases JSON — fall back to row id
        }
      }
      const cve = aliases.find(a => a.startsWith('CVE-')) ?? row.id

      let fixedVersion = ''
      if (row.events) {
        try {
          const events = JSON.parse(row.events) as RangeEvent[]
          if (Array.isArray(events)) {
            const fixedEvent = events.find(e => e.fixed !== undefined)
            if (fixedEvent?.fixed) fixedVersion = fixedEvent.fixed
          }
        } catch {
          // Malformed events JSON — no fixed version available
        }
      }

      results.push({
        cve,
        severity: row.severity as Severity,
        description: row.summary ?? '',
        softwareId: '',
        fixedVersion,
        source: 'OSV-local',
      })
    }
    return results
  } catch {
    // Database not initialized or table missing — treat as no local data
    return []
  }
}

// ============================================================================
// 5. Freshness Check
// ============================================================================

/**
 * Check whether fresh local data exists for an ecosystem.
 *
 * Local data is considered fresh when sync_metadata holds a row
 * for the ecosystem synced within the last 7 days.
 *
 * @param ecosystem - Package ecosystem (e.g., 'npm')
 * @returns True if fresh local data is available
 */
export function hasLocalData(ecosystem: string): boolean {
  try {
    const db = getDatabase()
    const row = db.prepare(
      'SELECT synced_at FROM sync_metadata WHERE ecosystem = ?'
    ).get(ecosystem) as { synced_at: number } | undefined
    if (!row) return false
    return Date.now() - row.synced_at < STALE_THRESHOLD_MS
  } catch {
    return false
  }
}
