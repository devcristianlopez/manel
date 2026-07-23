/**
 * Tests for src/core/scanner
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('child_process', () => {
  const mockExecSync = vi.fn()
  return {
    default: { execSync: mockExecSync },
    execSync: mockExecSync,
  }
})

import { execSync } from 'child_process'
import {
  detectOS,
  detectNode,
  detectNpm,
  detectGit,
  detectPostgreSQL,
  detectMySQL,
  detectMongoDB,
  detectRedis,
  detectSingle,
  detectAll,
  getOS,
  DETECTORS,
} from '../scanner'

const mockExecSync = execSync as ReturnType<typeof vi.fn>

describe('Core Scanner', () => {
  beforeEach(() => { mockExecSync.mockReset() })

  describe('detectNode', () => {
    it('should detect node version', () => {
      mockExecSync.mockReturnValue('v22.0.0\n')
      expect(detectNode()).toEqual({ name: 'node', version: '22.0.0', path: 'node' })
    })

    it('should return null when node not found', () => {
      mockExecSync.mockImplementation(() => { throw new Error('not found') })
      expect(detectNode()).toBeNull()
    })
  })

  describe('detectNpm', () => {
    it('should detect npm version', () => {
      mockExecSync.mockReturnValue('10.9.0\n')
      expect(detectNpm()).toEqual({ name: 'npm', version: '10.9.0', path: 'npm' })
    })
  })

  describe('detectGit', () => {
    it('should detect git version', () => {
      mockExecSync.mockReturnValue('git version 2.47.1\n')
      expect(detectGit()).toEqual({ name: 'git', version: '2.47.1', path: 'git' })
    })
  })

  describe('detectPostgreSQL', () => {
    it('should detect postgresql version', () => {
      mockExecSync.mockReturnValue('psql (PostgreSQL 16.2)\n')
      expect(detectPostgreSQL()).toEqual({ name: 'postgresql', version: '16.2', path: 'psql' })
    })
  })

  describe('detectMySQL', () => {
    it('should detect mysql version', () => {
      mockExecSync.mockReturnValue('mysql  Ver 8.0.36 for Linux on x86_64\n')
      expect(detectMySQL()).toEqual({ name: 'mysql', version: '8.0.36', path: 'mysql' })
    })
  })

  describe('detectMongoDB', () => {
    it('should detect mongodb version', () => {
      mockExecSync.mockReturnValue('db version v7.3.1\n')
      expect(detectMongoDB()).toEqual({ name: 'mongodb', version: '7.3.1', path: 'mongod' })
    })
  })

  describe('detectRedis', () => {
    it('should detect redis version', () => {
      mockExecSync.mockReturnValue('redis-cli 7.2.5\n')
      expect(detectRedis()).toEqual({ name: 'redis', version: '7.2.5', path: 'redis-cli' })
    })
  })

  describe('detectOS', () => {
    const originalPlatform = process.platform
    afterEach(() => { Object.defineProperty(process, 'platform', { value: originalPlatform }) })

    it('should detect Linux platform', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' })
      const result = detectOS()
      expect(result.platform).toBe('linux')
      expect(typeof result.release).toBe('string')
    })

    it('should detect macOS platform', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' })
      mockExecSync.mockReturnValue('14.5.0')
      const result = detectOS()
      expect(result.platform).toBe('darwin')
      expect(result.distro).toBe('macOS')
      expect(result.version).toBe('14.5.0')
    })
  })

  describe('detectSingle', () => {
    it('should detect a single technology by name', () => {
      mockExecSync.mockReturnValue('v22.0.0\n')
      const result = detectSingle('node')
      expect(result).not.toBeNull()
      expect(result!.name).toBe('node')
    })

    it('should be case-insensitive', () => {
      mockExecSync.mockReturnValue('v22.0.0\n')
      const result = detectSingle('Node')
      expect(result).not.toBeNull()
    })

    it('should return null for unknown technology', () => {
      expect(detectSingle('unknown-tech')).toBeNull()
    })
  })

  describe('detectAll', () => {
    it('should detect multiple technologies', () => {
      mockExecSync
        .mockReturnValueOnce('v22.0.0\n')  // node
        .mockReturnValueOnce('10.9.0\n')    // npm
        .mockImplementation(() => { throw new Error('not found') })

      const results = detectAll('scan-1')
      expect(results.length).toBeGreaterThanOrEqual(2)
      expect(results[0].name).toBe('node')
      expect(results[0].scanId).toBe('scan-1')
      expect(results[1].name).toBe('npm')
    })

    it('should return empty array when nothing is detected', () => {
      mockExecSync.mockImplementation(() => { throw new Error('not found') })
      const results = detectAll()
      expect(results).toEqual([])
    })
  })

  describe('DETECTORS', () => {
    it('should have 21 detectors', () => {
      expect(DETECTORS).toHaveLength(21)
    })

    it('should all be functions', () => {
      for (const detector of DETECTORS) {
        expect(typeof detector).toBe('function')
      }
    })
  })

  describe('getOS', () => {
    it('should return OS info', () => {
      const result = getOS()
      expect(result).toHaveProperty('platform')
      expect(result).toHaveProperty('release')
    })
  })

  describe('No Electron dependencies', () => {
    it('should not reference electron in its source', async () => {
      // Read the source file directly to verify no Electron imports
      const { readFileSync } = await import('fs')
      const { resolve } = await import('path')
      const sourcePath = resolve(__dirname, '../scanner/index.ts')
      const source = readFileSync(sourcePath, 'utf-8')
      expect(source).not.toContain("from 'electron'")
      expect(source).not.toContain("require('electron')")
      expect(source).toContain("from 'child_process'")
      expect(source).toContain("from 'crypto'")
    })
  })
})
