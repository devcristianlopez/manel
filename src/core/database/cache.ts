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

// ============================================================================
// 3. API Failure Cache (Negative Caching)
// ============================================================================

/** Negative cache TTL: 15 minutes */
const FAILURE_TTL_MS = 15 * 60 * 1000

/**
 * Record an API failure (for negative caching).
 *
 * Silently ignores DB errors.
 *
 * @param key - API key identifier (e.g., 'version:node')
 */
export function recordApiFailure(key: string): void {
  try {
    const db = getDatabase()
    db.prepare(
      'INSERT OR REPLACE INTO api_failures (api_key, failed_at) VALUES (?, ?)'
    ).run(key, Date.now())
  } catch {
    // Silently fail if DB not initialized
  }
}

/**
 * Check if an API recently failed (within 15 minutes).
 *
 * Returns false on DB errors.
 *
 * @param key - API key identifier
 * @returns true if the API failed within the TTL window
 */
export function hasRecentApiFailure(key: string): boolean {
  try {
    const db = getDatabase()
    const row = db.prepare(
      'SELECT failed_at FROM api_failures WHERE api_key = ?'
    ).get(key) as { failed_at: number } | undefined

    if (!row) return false

    return Date.now() - row.failed_at < FAILURE_TTL_MS
  } catch {
    return false
  }
}

/**
 * Clear a recorded failure (e.g., after a successful call).
 *
 * @param key - API key identifier
 */
export function clearApiFailure(key: string): void {
  try {
    const db = getDatabase()
    db.prepare('DELETE FROM api_failures WHERE api_key = ?').run(key)
  } catch {
    // Silently fail
  }
}
