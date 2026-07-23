/**
 * Manel Core — Vulnerability Cache
 *
 * In-memory cache with SQLite persistence for vulnerability query results.
 * TTL: 1 hour in-memory, 24 hours in SQLite.
 * No Electron or IPC dependencies.
 *
 * @module core/security/cache
 */

import type { CoreVulnerability } from '../types'
import { getCachedVulnerabilities, setCachedVulnerabilities } from '../database/cache'

/** Default in-memory TTL: 1 hour */
const DEFAULT_TTL_MS = 60 * 60 * 1000

interface CacheEntry {
  data: CoreVulnerability[]
  expiry: number
}

/**
 * Vulnerability cache with SQLite persistence.
 *
 * In-memory cache for fast access, backed by SQLite for persistence
 * across process restarts.
 */
export class VulnerabilityCache {
  private cache = new Map<string, CacheEntry>()
  private ttl: number

  /**
   * @param ttlMs - Time-to-live in milliseconds (default: 1 hour)
   */
  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttl = ttlMs
  }

  /**
   * Get cached vulnerabilities for a key.
   *
   * Checks in-memory first, then falls back to SQLite.
   *
   * @param key - Cache key (e.g., 'npm:lodash:4.17.21')
   * @returns Cached vulnerabilities, or null if miss/expired
   */
  get(key: string): CoreVulnerability[] | null {
    // 1. Check in-memory cache
    const entry = this.cache.get(key)
    if (entry) {
      if (Date.now() <= entry.expiry) {
        return entry.data
      }
      this.cache.delete(key)
    }

    // 2. Fall back to SQLite
    const dbVulns = getCachedVulnerabilities(key)
    if (dbVulns !== null) {
      // Warm the in-memory cache
      this.cache.set(key, { data: dbVulns, expiry: Date.now() + this.ttl })
      return dbVulns
    }

    return null
  }

  /**
   * Store vulnerabilities in the cache.
   *
   * Writes to both in-memory and SQLite.
   *
   * @param key - Cache key
   * @param vulns - Vulnerabilities to cache
   */
  set(key: string, vulns: CoreVulnerability[]): void {
    this.cache.set(key, {
      data: vulns,
      expiry: Date.now() + this.ttl,
    })
    setCachedVulnerabilities(key, vulns)
  }

  /**
   * Clear all cached entries (in-memory only; SQLite entries expire naturally).
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Number of entries currently in the in-memory cache.
   */
  get size(): number {
    return this.cache.size
  }
}
