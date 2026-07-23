/**
 * Manel Core — Vulnerability Cache
 *
 * In-memory cache for vulnerability query results with TTL expiration.
 * No Electron or IPC dependencies.
 *
 * @module core/security/cache
 */

import type { CoreVulnerability } from '../types'

/** Default TTL: 1 hour */
const DEFAULT_TTL_MS = 60 * 60 * 1000

interface CacheEntry {
  data: CoreVulnerability[]
  expiry: number
}

/**
 * In-memory cache for vulnerability data with configurable TTL.
 *
 * Entries expire after the configured TTL and are lazily removed
 * on access.
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
   * @param key - Cache key (e.g., 'npm:lodash:4.17.21')
   * @returns Cached vulnerabilities, or null if miss/expired
   */
  get(key: string): CoreVulnerability[] | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      return null
    }
    return entry.data
  }

  /**
   * Store vulnerabilities in the cache.
   *
   * @param key - Cache key
   * @param vulns - Vulnerabilities to cache
   */
  set(key: string, vulns: CoreVulnerability[]): void {
    this.cache.set(key, {
      data: vulns,
      expiry: Date.now() + this.ttl,
    })
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Number of entries currently in the cache.
   */
  get size(): number {
    return this.cache.size
  }
}
