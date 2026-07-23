/**
 * Manel Core — Database Cache
 *
 * SQLite-backed cache for version and vulnerability data.
 * Provides persistent storage that survives process restarts.
 * Falls back gracefully if database is not initialized.
 *
 * @module core/database/cache
 */

import { getDatabase } from './index'
import type { CoreVulnerability } from '../types'

// ============================================================================
// 1. Version Cache
// ============================================================================

/** Version cache TTL: 24 hours */
const VERSION_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Get a cached version from SQLite.
 *
 * @param techName - Technology name
 * @returns Cached version string, or null if miss/expired
 */
export function getCachedVersion(techName: string): string | null {
  try {
    const db = getDatabase()
    const row = db.prepare(
      'SELECT latest_version, fetched_at FROM version_cache WHERE tech_name = ?'
    ).get(techName) as { latest_version: string; fetched_at: number } | undefined

    if (!row) return null

    // Check expiry
    if (Date.now() - row.fetched_at > VERSION_CACHE_TTL_MS) {
      db.prepare('DELETE FROM version_cache WHERE tech_name = ?').run(techName)
      return null
    }

    return row.latest_version
  } catch {
    return null
  }
}

/**
 * Store a version in the SQLite cache.
 *
 * @param techName - Technology name
 * @param version - Version string to cache
 */
export function setCachedVersion(techName: string, version: string): void {
  try {
    const db = getDatabase()
    db.prepare(
      'INSERT OR REPLACE INTO version_cache (tech_name, latest_version, fetched_at) VALUES (?, ?, ?)'
    ).run(techName, version, Date.now())
  } catch {
    // Silently fail if DB not initialized
  }
}

/**
 * Clear all expired version cache entries.
 */
export function clearExpiredVersions(): void {
  try {
    const db = getDatabase()
    const cutoff = Date.now() - VERSION_CACHE_TTL_MS
    db.prepare('DELETE FROM version_cache WHERE fetched_at < ?').run(cutoff)
  } catch {
    // Silently fail
  }
}

// ============================================================================
// 2. Vulnerability Cache
// ============================================================================

/** Vulnerability cache TTL: 24 hours */
const VULN_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Get cached vulnerabilities from SQLite.
 *
 * @param key - Cache key (e.g., 'npm:lodash:4.17.21')
 * @returns Cached vulnerabilities, or null if miss/expired
 */
export function getCachedVulnerabilities(key: string): CoreVulnerability[] | null {
  try {
    const db = getDatabase()
    const row = db.prepare(
      'SELECT data, fetched_at FROM vulnerability_cache WHERE cache_key = ?'
    ).get(key) as { data: string; fetched_at: number } | undefined

    if (!row) return null

    // Check expiry
    if (Date.now() - row.fetched_at > VULN_CACHE_TTL_MS) {
      db.prepare('DELETE FROM vulnerability_cache WHERE cache_key = ?').run(key)
      return null
    }

    return JSON.parse(row.data) as CoreVulnerability[]
  } catch {
    return null
  }
}

/**
 * Store vulnerabilities in the SQLite cache.
 *
 * @param key - Cache key
 * @param vulns - Vulnerabilities to cache
 */
export function setCachedVulnerabilities(key: string, vulns: CoreVulnerability[]): void {
  try {
    const db = getDatabase()
    db.prepare(
      'INSERT OR REPLACE INTO vulnerability_cache (cache_key, data, fetched_at) VALUES (?, ?, ?)'
    ).run(key, JSON.stringify(vulns), Date.now())
  } catch {
    // Silently fail if DB not initialized
  }
}

/**
 * Clear all expired vulnerability cache entries.
 */
export function clearExpiredVulnerabilities(): void {
  try {
    const db = getDatabase()
    const cutoff = Date.now() - VULN_CACHE_TTL_MS
    db.prepare('DELETE FROM vulnerability_cache WHERE fetched_at < ?').run(cutoff)
  } catch {
    // Silently fail
  }
}
