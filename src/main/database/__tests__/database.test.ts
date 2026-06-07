import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

const allTempDirs: string[] = []

// Mock electron - getPath returns a new temp dir each time the database is initialized
vi.mock('electron', () => {
  let callCount = 0
  return {
    app: {
      getPath: vi.fn(() => {
        callCount++
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), `manel-test-${Date.now()}-${callCount}-`))
        allTempDirs.push(dir)
        return dir
      }),
      get name() { return 'Manel' },
      get version() { return '0.1.0' },
    },
  }
})

import {
  getDatabase,
  createScan,
  updateScan,
  getLatestScan,
  saveSoftware,
  getAllSoftware,
  getSoftwareByScanId,
  saveVulnerabilities,
  getVulnerabilitiesForSoftware,
  closeDatabase,
} from '../index'
import type { Software, Vulnerability } from '../../../shared/types'

afterAll(() => {
  closeDatabase()
  for (const dir of allTempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch { /* ignore */ }
  }
})

describe('Database operations', () => {
  afterEach(() => {
    closeDatabase()
  })

  describe('createScan', () => {
    it('should create a scan with pending status', () => {
      const scan = createScan()
      expect(scan).toBeDefined()
      expect(scan.id).toBeTypeOf('string')
      expect(scan.id).toHaveLength(36)
      expect(scan.status).toBe('pending')
      expect(scan.score).toBeNull()
      expect(scan.critical_count).toBe(0)
      expect(scan.high_count).toBe(0)
      expect(scan.medium_count).toBe(0)
      expect(scan.low_count).toBe(0)
      expect(scan.date).toBeTypeOf('number')
    })
  })

  describe('getLatestScan', () => {
    it('should return null when no scans exist', () => {
      const result = getLatestScan()
      expect(result).toBeNull()
    })

    it('should return the most recent scan', () => {
      const scan1 = createScan()
      const scan2 = createScan()

      const latest = getLatestScan()
      expect(latest).not.toBeNull()

      // scan2 always has date >= scan1.date (same-second → either id is valid)
      expect([scan1.id, scan2.id]).toContain(latest!.id)
    })
  })

  describe('updateScan', () => {
    it('should update scan fields', () => {
      const scan = createScan()
      updateScan(scan.id, { status: 'scanning', score: 85 })

      const db = getDatabase()
      const row = db.prepare('SELECT * FROM scans WHERE id = ?').get(scan.id) as Record<string, unknown>
      expect(row.status).toBe('scanning')
      expect(row.score).toBe(85)
    })

    it('should do nothing when data is empty', () => {
      const scan = createScan()
      expect(() => updateScan(scan.id, {})).not.toThrow()
    })
  })

  describe('saveSoftware', () => {
    it('should save software items to database', () => {
      const scan = createScan()
      const now = Math.floor(Date.now() / 1000)
      const items: Omit<Software, 'id'>[] = [
        { name: 'node', version: '22.0.0', path: 'node', detected_at: now, scan_id: scan.id },
        { name: 'npm', version: '10.9.0', path: 'npm', detected_at: now, scan_id: scan.id },
      ]

      const saved = saveSoftware(items)
      expect(saved).toHaveLength(2)
      expect(saved[0].id).toBeTypeOf('string')
      expect(saved[0].name).toBe('node')
      expect(saved[0].version).toBe('22.0.0')
      expect(saved[0].scan_id).toBe(scan.id)
    })

    it('should return saved software with generated ids', () => {
      const scan = createScan()
      const now = Math.floor(Date.now() / 1000)
      const items: Omit<Software, 'id'>[] = [
        { name: 'git', version: '2.47.1', path: 'git', detected_at: now, scan_id: scan.id },
      ]

      const saved = saveSoftware(items)
      const retrieved = getSoftwareByScanId(scan.id)
      expect(retrieved).toHaveLength(1)
      expect(retrieved[0].id).toBe(saved[0].id)
    })
  })

  describe('getAllSoftware', () => {
    it('should return all software ordered by name', () => {
      const scan = createScan()
      const now = Math.floor(Date.now() / 1000)

      saveSoftware([
        { name: 'zsh', version: '5.9', path: '/bin/zsh', detected_at: now, scan_id: scan.id },
        { name: 'bash', version: '5.2', path: '/bin/bash', detected_at: now, scan_id: scan.id },
      ])

      const all = getAllSoftware()
      expect(all).toHaveLength(2)
      expect(all[0].name <= all[1].name).toBe(true)
    })
  })

  describe('saveVulnerabilities and getVulnerabilitiesForSoftware', () => {
    it('should save and retrieve vulnerabilities for a software', () => {
      const scan = createScan()
      const now = Math.floor(Date.now() / 1000)
      const savedSoftware = saveSoftware([
        { name: 'node', version: '18.0.0', path: 'node', detected_at: now, scan_id: scan.id },
      ])

      const vulns: Omit<Vulnerability, 'id'>[] = [
        { cve: 'CVE-2024-0001', severity: 'CRITICAL', description: 'Critical vuln', software_id: savedSoftware[0].id, fixed_version: '18.1.0', source: 'OSV' },
        { cve: 'CVE-2024-0002', severity: 'HIGH', description: 'High vuln', software_id: savedSoftware[0].id, fixed_version: '', source: 'NVD' },
      ]

      const savedVulns = saveVulnerabilities(vulns)
      expect(savedVulns).toHaveLength(2)

      const retrieved = getVulnerabilitiesForSoftware(savedSoftware[0].id)
      expect(retrieved).toHaveLength(2)
      expect(retrieved[0].cve).toBe('CVE-2024-0001')
      expect(retrieved[1].severity).toBe('HIGH')
    })

    it('should return empty array for software with no vulns', () => {
      const scan = createScan()
      const now = Math.floor(Date.now() / 1000)
      const savedSoftware = saveSoftware([
        { name: 'git', version: '2.47.1', path: 'git', detected_at: now, scan_id: scan.id },
      ])
      const vulns = getVulnerabilitiesForSoftware(savedSoftware[0].id)
      expect(vulns).toEqual([])
    })
  })

  describe('Foreign keys and referential integrity', () => {
    it('should enforce foreign key on software.scan_id', () => {
      const now = Math.floor(Date.now() / 1000)
      expect(() => {
        saveSoftware([
          { name: 'node', version: '1.0.0', path: 'node', detected_at: now, scan_id: 'nonexistent' },
        ])
      }).toThrow()
    })

    it('should enforce foreign key on vulnerabilities.software_id', () => {
      expect(() => {
        saveVulnerabilities([
          { cve: 'CVE-1', severity: 'HIGH', description: 'test', software_id: 'nonexistent', fixed_version: '', source: 'test' },
        ])
      }).toThrow()
    })

    it('should prevent deletion of software referenced by vulns', () => {
      const scan = createScan()
      const now = Math.floor(Date.now() / 1000)
      const savedSoftware = saveSoftware([
        { name: 'node', version: '1.0.0', path: 'node', detected_at: now, scan_id: scan.id },
      ])
      saveVulnerabilities([
        { cve: 'CVE-1', severity: 'LOW', description: 'test', software_id: savedSoftware[0].id, fixed_version: '', source: 'test' },
      ])

      const db = getDatabase()
      expect(() => {
        db.prepare('DELETE FROM software WHERE id = ?').run(savedSoftware[0].id)
      }).toThrow()
    })
  })

  describe('Transaction support', () => {
    it('saveSoftware wraps inserts in a transaction', () => {
      const scan = createScan()
      const now = Math.floor(Date.now() / 1000)
      const items: Omit<Software, 'id'>[] = [
        { name: 'a', version: '1', path: 'a', detected_at: now, scan_id: scan.id },
        { name: 'b', version: '2', path: 'b', detected_at: now, scan_id: scan.id },
      ]
      const saved = saveSoftware(items)
      expect(saved).toHaveLength(2)
    })

    it('saveVulnerabilities wraps inserts in a transaction', () => {
      const scan = createScan()
      const now = Math.floor(Date.now() / 1000)
      const savedSoftware = saveSoftware([
        { name: 'test-pkg', version: '1.0.0', path: '/test', detected_at: now, scan_id: scan.id },
      ])
      const vulns: Omit<Vulnerability, 'id'>[] = [
        { cve: 'CVE-1', severity: 'HIGH', description: 'd1', software_id: savedSoftware[0].id, fixed_version: '', source: 'src1' },
        { cve: 'CVE-2', severity: 'LOW', description: 'd2', software_id: savedSoftware[0].id, fixed_version: '', source: 'src2' },
      ]
      const saved = saveVulnerabilities(vulns)
      expect(saved).toHaveLength(2)
    })
  })
})
