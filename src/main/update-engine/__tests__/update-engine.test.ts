import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getLatestVersion, getAllLatestVersions, cache, TECH_SOURCES, VersionCache } from '../index'

const originalFetch = globalThis.fetch

function mockFetch(data: unknown, status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => data
  })
}

function mockFetchError() {
  globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
}

describe('Update Engine', () => {
  beforeEach(() => {
    cache.clear()
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
        { version: 'v18.20.4', lts: 'Hydrogen' }
      ])
      const version = await getLatestVersion('node')
      expect(version).toBe('20.17.0')
    })

    it('should handle Node.js with no LTS entries', async () => {
      mockFetch([
        { version: 'v22.0.0-nightly', lts: false }
      ])
      const version = await getLatestVersion('node')
      expect(version).toBeNull()
    })

    it('should return latest npm version', async () => {
      mockFetch({ version: '10.9.0' })
      const version = await getLatestVersion('npm')
      expect(version).toBe('10.9.0')
    })

    it('should return latest yarn version', async () => {
      mockFetch({ version: '1.22.22' })
      const version = await getLatestVersion('yarn')
      expect(version).toBe('1.22.22')
    })

    it('should return latest pnpm version', async () => {
      mockFetch({ version: '9.15.0' })
      const version = await getLatestVersion('pnpm')
      expect(version).toBe('9.15.0')
    })

    it('should return latest git version from GitHub', async () => {
      mockFetch({ tag_name: 'v2.47.1' })
      const version = await getLatestVersion('git')
      expect(version).toBe('2.47.1')
    })

    it('should return latest docker version', async () => {
      mockFetch({ tag_name: 'v26.1.4' })
      const version = await getLatestVersion('docker')
      expect(version).toBe('26.1.4')
    })

    it('should return latest docker-compose version', async () => {
      mockFetch({ tag_name: 'v2.32.1' })
      const version = await getLatestVersion('docker-compose')
      expect(version).toBe('2.32.1')
    })

    it('should return latest python version', async () => {
      mockFetch({ latest: '3.13.0' })
      const version = await getLatestVersion('python')
      expect(version).toBe('3.13.0')
    })

    it('should return latest pip version', async () => {
      mockFetch({ info: { version: '24.3.1' } })
      const version = await getLatestVersion('pip')
      expect(version).toBe('24.3.1')
    })

    it('should return latest Java LTS version', async () => {
      mockFetch([
        { cycle: '21', lts: true, latest: '21.0.5', latestRelease: '21.0.5' },
        { cycle: '17', lts: true, latest: '17.0.12', latestRelease: '17.0.12' },
        { cycle: '23', lts: false, latest: '23.0.0' }
      ])
      const version = await getLatestVersion('java')
      expect(version).toBe('21.0.5')
    })

    it('should return latest Maven version', async () => {
      mockFetch({ tag_name: 'maven-3.9.9' })
      const version = await getLatestVersion('maven')
      expect(version).toBe('3.9.9')
    })

    it('should return latest Gradle version', async () => {
      mockFetch({ version: '8.11.1' })
      const version = await getLatestVersion('gradle')
      expect(version).toBe('8.11.1')
    })

    it('should return latest VS Code version', async () => {
      mockFetch({ tag_name: '1.95.3' })
      const version = await getLatestVersion('code')
      expect(version).toBe('1.95.3')
    })

    it('should strip v prefix from VS Code tag', async () => {
      mockFetch({ tag_name: 'v1.95.3' })
      const version = await getLatestVersion('code')
      expect(version).toBe('1.95.3')
    })

    it('should return latest Ubuntu version', async () => {
      mockFetch([
        { cycle: '24.04', latest: '24.04.1' },
        { cycle: '22.04', latest: '22.04.5' },
        { cycle: '20.04', latest: '20.04.6' }
      ])
      const version = await getLatestVersion('ubuntu')
      expect(version).toBe('24.04.1')
    })

    it('should handle Ubuntu versions with 24.10 after 24.04', async () => {
      mockFetch([
        { cycle: '24.10', latest: '24.10.1' },
        { cycle: '24.04', latest: '24.04.1' }
      ])
      const version = await getLatestVersion('ubuntu')
      expect(version).toBe('24.10.1')
    })

    it('should return latest Debian version', async () => {
      mockFetch([
        { cycle: '12', latest: '12.8' },
        { cycle: '11', latest: '11.11' }
      ])
      const version = await getLatestVersion('debian')
      expect(version).toBe('12.8')
    })

    it('should return latest Fedora version', async () => {
      mockFetch([
        { cycle: '41', latest: '41' },
        { cycle: '40', latest: '40' }
      ])
      const version = await getLatestVersion('fedora')
      expect(version).toBe('41')
    })

    it('should return latest macOS version', async () => {
      mockFetch([
        { cycle: '15', latest: '15.1' },
        { cycle: '14', latest: '14.7' }
      ])
      const version = await getLatestVersion('macos')
      expect(version).toBe('15.1')
    })

    it('should return latest Windows version', async () => {
      mockFetch([
        { cycle: '11', latest: '11.24H2' },
        { cycle: '10', latest: '10.22H2' }
      ])
      const version = await getLatestVersion('windows')
      expect(version).toBe('11.24H2')
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

    it('should use cache on repeated calls', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ version: '10.9.0' })
      })

      globalThis.fetch = fetchMock

      const first = await getLatestVersion('npm')
      expect(first).toBe('10.9.0')
      expect(fetchMock).toHaveBeenCalledTimes(1)

      const second = await getLatestVersion('npm')
      expect(second).toBe('10.9.0')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('getAllLatestVersions', () => {
    it('should return versions for all technologies that parse correctly', async () => {
      const techCount = Object.keys(TECH_SOURCES).length

      // Use a mock that only returns data matching parse functions correctly
      // npm, yarn, pnpm, gradle use { version: 'xxx' }
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ version: '1.0.0' })
      })

      const result = await getAllLatestVersions()
      // All 18 techs should return, but some will be null because their parse expects different data
      expect(Object.keys(result).length).toBe(techCount)
      // npm, yarn, pnpm, gradle return '1.0.0'; others return null
      expect(result.npm).toBe('1.0.0')
      expect(result.yarn).toBe('1.0.0')
      expect(result.pnpm).toBe('1.0.0')
      expect(result.gradle).toBe('1.0.0')
      // node expects array, so it returns null
      expect(result.node).toBeNull()
    })

    it('should not fail entirely when one API fails', async () => {
      let callCount = 0
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.reject(new Error('First API fails'))
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({ tag_name: 'v1.0.0' })
        })
      })

      const result = await getAllLatestVersions()
      // All 18 keys should be present (the first one will be null, rest have tag_name-based parse)
      expect(Object.keys(result).length).toBe(Object.keys(TECH_SOURCES).length)
      // The first tech (node) falls into the failing API call and returns null
      // node's parse expects array, not tag_name, so it returns null anyway
      expect(result.node).toBeNull()
    })
  })

  describe('VersionCache', () => {
    it('should respect TTL', async () => {
      const smallCache = new VersionCache(50)

      smallCache.set('test', '1.0.0')
      expect(smallCache.get('test')).toBe('1.0.0')

      await new Promise(resolve => setTimeout(resolve, 60))

      expect(smallCache.get('test')).toBeNull()
    })

    it('should clear all entries', () => {
      const smallCache = new VersionCache(5000)

      smallCache.set('a', '1.0.0')
      smallCache.set('b', '2.0.0')
      smallCache.clear()

      expect(smallCache.get('a')).toBeNull()
      expect(smallCache.get('b')).toBeNull()
    })
  })
})
