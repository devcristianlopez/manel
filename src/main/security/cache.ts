import type { Vulnerability } from '../../shared/types'

const TTL_MS = 60 * 60 * 1000

interface CacheEntry {
  data: Vulnerability[]
  expiry: number
}

export class VulnerabilityCache {
  private cache = new Map<string, CacheEntry>()

  get(key: string): Vulnerability[] | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      return null
    }
    return entry.data
  }

  set(key: string, vulns: Vulnerability[]): void {
    this.cache.set(key, {
      data: vulns,
      expiry: Date.now() + TTL_MS
    })
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }
}
