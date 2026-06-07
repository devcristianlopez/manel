import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { VulnerabilityCache } from '../cache'
import type { Vulnerability } from '../../../shared/types'

function makeVulns(count: number): Vulnerability[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `vuln-${i}`,
    cve: `CVE-2024-${String(i).padStart(4, '0')}`,
    severity: i === 0 ? 'CRITICAL' : 'LOW' as Vulnerability['severity'],
    description: `Test vulnerability ${i}`,
    software_id: 'sw-1',
    fixed_version: '',
    source: 'test',
  }))
}

describe('VulnerabilityCache', () => {
  let cache: VulnerabilityCache

  beforeEach(() => {
    vi.useFakeTimers()
    cache = new VulnerabilityCache()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('get', () => {
    it('should return null for a cache miss', () => {
      const result = cache.get('nonexistent-key')
      expect(result).toBeNull()
    })

    it('should return cached data when not expired', () => {
      const vulns = makeVulns(2)
      cache.set('test-key', vulns)

      const result = cache.get('test-key')
      expect(result).toEqual(vulns)
      expect(result).toHaveLength(2)
    })

    it('should return null and delete entry when TTL has expired', () => {
      const vulns = makeVulns(1)
      cache.set('expiring-key', vulns)

      // Advance time past the TTL (1 hour = 3600000ms)
      vi.advanceTimersByTime(3600001)

      const result = cache.get('expiring-key')
      expect(result).toBeNull()
    })

    it('should still return data just before TTL expires', () => {
      const vulns = makeVulns(1)
      cache.set('almost-expired', vulns)

      // Advance to just before expiry
      vi.advanceTimersByTime(3599999)

      const result = cache.get('almost-expired')
      expect(result).toEqual(vulns)
    })
  })

  describe('set', () => {
    it('should store data that can be retrieved', () => {
      const vulns = makeVulns(3)
      cache.set('key-1', vulns)

      expect(cache.get('key-1')).toEqual(vulns)
    })

    it('should overwrite existing entry', () => {
      cache.set('key-1', makeVulns(1))
      cache.set('key-1', makeVulns(5))

      const result = cache.get('key-1')
      expect(result).toHaveLength(5)
    })

    it('should store multiple keys', () => {
      cache.set('a', makeVulns(1))
      cache.set('b', makeVulns(2))

      expect(cache.get('a')).toHaveLength(1)
      expect(cache.get('b')).toHaveLength(2)
    })

    it('should reset expiry on re-set', () => {
      cache.set('refresh-key', makeVulns(1))
      vi.advanceTimersByTime(1800000) // 30 min

      // Re-set the same key (refreshes TTL)
      cache.set('refresh-key', makeVulns(2))
      vi.advanceTimersByTime(1800000) // Another 30 min (still within 1 hour TTL)

      expect(cache.get('refresh-key')).toHaveLength(2)
    })
  })

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('a', makeVulns(1))
      cache.set('b', makeVulns(2))
      cache.set('c', makeVulns(3))

      expect(cache.size).toBe(3)

      cache.clear()

      expect(cache.size).toBe(0)
      expect(cache.get('a')).toBeNull()
      expect(cache.get('b')).toBeNull()
      expect(cache.get('c')).toBeNull()
    })

    it('should work on an empty cache', () => {
      expect(() => cache.clear()).not.toThrow()
      expect(cache.size).toBe(0)
    })
  })

  describe('size', () => {
    it('should return 0 for empty cache', () => {
      expect(cache.size).toBe(0)
    })

    it('should return the number of entries', () => {
      cache.set('a', makeVulns(1))
      expect(cache.size).toBe(1)

      cache.set('b', makeVulns(2))
      expect(cache.size).toBe(2)

      cache.clear()
      expect(cache.size).toBe(0)
    })
  })
})
