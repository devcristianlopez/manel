/**
 * Tests for src/core/update-engine
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getLatestVersion, getAllLatestVersions, getCache, TECH_SOURCES, VersionCache } from '../update-engine'

const originalFetch = globalThis.fetch

function mockFetch(data: unknown, status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => data,
  })
}

function mockFetchError() {
  globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
}

describe('Core Update Engine', () => {
  beforeEach(() => {
    getCache().clear()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('getLatestVersion', () => {
    it('should return null for unknown technology', async () => {
      const result = await getLatestVersion('unknown-tech')
      expect(result).toBeNull()
    })

    it('should return latest Node.js LTS version', async () => {
      mockFetch([
        { version: 'v22.0.0', lts: false },
        { version: 'v20.17.0', lts: 'Iron' },
        { version: 'v18.20.4', lts: 'Hydrogen' },
      ])
      const version = await getLatestVersion('node')
      expect(version).toBe('20.17.0')
    })

    it('should return latest npm version', async () => {
      mockFetch({ version: '10.9.0' })
      const version = await getLatestVersion('npm')
      expect(version).toBe('10.9.0')
    })

    it('should return latest git version', async () => {
      mockFetch({ tag_name: 'v2.47.1' })
      const version = await getLatestVersion('git')
      expect(version).toBe('2.47.1')
    })

    it('should return null on fetch error', async () => {
      mockFetchError()
      const version = await getLatestVersion('node')
      expect(version).toBeNull()
    })

    it('should return null on HTTP error', async () => {
      mockFetch(null, 500)
      const version = await getLatestVersion('node')
      expect(version).toBeNull()
    })

    it('should cache results', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ version: '10.9.0' }),
      })
      globalThis.fetch = fetchMock

      await getLatestVersion('npm')
      await getLatestVersion('npm')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('getAllLatestVersions', () => {
    it('should return versions for all technologies', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ version: '1.0.0' }),
      })
      const result = await getAllLatestVersions()
      expect(Object.keys(result).length).toBe(Object.keys(TECH_SOURCES).length)
      expect(result.npm).toBe('1.0.0')
    })
  })

  describe('VersionCache', () => {
    it('should respect TTL', async () => {
      const cache = new VersionCache(50)
      cache.set('test', '1.0.0')
      expect(cache.get('test')).toBe('1.0.0')
      await new Promise(resolve => setTimeout(resolve, 60))
      expect(cache.get('test')).toBeNull()
    })

    it('should clear entries', () => {
      const cache = new VersionCache(5000)
      cache.set('a', '1.0.0')
      cache.clear()
      expect(cache.get('a')).toBeNull()
    })
  })

  describe('TECH_SOURCES', () => {
    it('should have sources for all expected technologies', () => {
      const expected = ['node', 'npm', 'yarn', 'pnpm', 'git', 'docker', 'python', 'java', 'gradle']
      for (const tech of expected) {
        expect(TECH_SOURCES[tech]).toBeDefined()
        expect(TECH_SOURCES[tech].url).toBeTruthy()
        expect(typeof TECH_SOURCES[tech].parse).toBe('function')
      }
    })
  })
})
