/**
 * Tests for src/core/security/local-query
 *
 * Tests offline vulnerability queries against the local vuln_db
 * table: row selection, explicit versions lists (authoritative),
 * OSV range-event matching, conservative fallbacks, alias/fixedVersion
 * extraction, and the 7-day sync freshness check.
 * Uses in-memory SQLite for isolation.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initDatabase, closeDatabase, getDatabase } from '../database'
import { queryLocalDB, hasLocalData } from '../security/local-query'

interface VulnRowOverrides {
  id: string
  ecosystem?: string
  packageName?: string
  aliases?: string | null
  severity?: string
  summary?: string | null
  events?: string | null | object[]
  versions?: string | null | string[]
}

/** Insert a row directly into vuln_db with sensible defaults. */
function insertVulnRow(overrides: VulnRowOverrides): void {
  const db = getDatabase()
  const events = Array.isArray(overrides.events)
    ? JSON.stringify(overrides.events)
    : overrides.events ?? null
  const versions = Array.isArray(overrides.versions)
    ? JSON.stringify(overrides.versions)
    : overrides.versions ?? null
  db.prepare(`
    INSERT OR REPLACE INTO vuln_db (id, ecosystem, package_name, aliases, severity, summary, events, versions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    overrides.id,
    overrides.ecosystem ?? 'npm',
    (overrides.packageName ?? 'testpkg').toLowerCase(),
    overrides.aliases ?? null,
    overrides.severity ?? 'HIGH',
    overrides.summary ?? null,
    events,
    versions
  )
}

describe('Local Vulnerability Query', () => {
  beforeAll(() => {
    // Use in-memory SQLite for testing
    initDatabase(':memory:')
  })

  afterAll(() => {
    closeDatabase()
  })

  beforeEach(() => {
    const db = getDatabase()
    db.exec('DELETE FROM vuln_db')
    db.exec('DELETE FROM sync_metadata')
  })

  describe('queryLocalDB — row selection', () => {
    it('should return empty array when no rows exist', () => {
      expect(queryLocalDB('npm', 'testpkg', '1.0.0')).toEqual([])
    })

    it('should return empty array when no rows match the package name', () => {
      insertVulnRow({ id: 'SEL-1', packageName: 'otherpkg' })
      expect(queryLocalDB('npm', 'testpkg', '1.0.0')).toEqual([])
    })

    it('should not return rows from a different ecosystem', () => {
      insertVulnRow({ id: 'SEL-2', ecosystem: 'PyPI', packageName: 'testpkg' })
      expect(queryLocalDB('npm', 'testpkg', '1.0.0')).toEqual([])
    })

    it('should match package name case-insensitively', () => {
      insertVulnRow({ id: 'SEL-3', packageName: 'TestPkg' }) // stored lowercase
      expect(queryLocalDB('npm', 'TESTPKG', '1.0.0')).toHaveLength(1)
    })

    it('should return all matching rows for the package', () => {
      insertVulnRow({ id: 'SEL-M1', events: [{ introduced: '0' }] })
      insertVulnRow({ id: 'SEL-M2', versions: ['1.0.0'] })
      insertVulnRow({ id: 'SEL-M3', versions: ['9.9.9'] })
      const results = queryLocalDB('npm', 'testpkg', '1.0.0')
      expect(results).toHaveLength(2)
      expect(results.map(r => r.cve).sort()).toEqual(['SEL-M1', 'SEL-M2'])
    })

    it('should map row fields to CoreVulnerability with OSV-local source', () => {
      insertVulnRow({
        id: 'GHSA-xxxx-yyyy',
        aliases: JSON.stringify(['CVE-2024-0001', 'GHSA-xxxx-yyyy']),
        severity: 'MEDIUM',
        summary: 'Test summary',
        events: [{ introduced: '1.0.0' }, { fixed: '1.2.0' }],
      })
      const results = queryLocalDB('npm', 'testpkg', '1.1.0')
      expect(results).toHaveLength(1)
      expect(results[0]).toEqual({
        cve: 'CVE-2024-0001',
        severity: 'MEDIUM',
        description: 'Test summary',
        softwareId: '',
        fixedVersion: '1.2.0',
        source: 'OSV-local',
      })
    })
  })

  describe('queryLocalDB — explicit versions list (authoritative)', () => {
    it('should match when version is in the versions list', () => {
      insertVulnRow({ id: 'VER-1', versions: ['1.0.0', '1.0.1'] })
      expect(queryLocalDB('npm', 'testpkg', '1.0.1')).toHaveLength(1)
    })

    it('should not match when version is absent from the versions list', () => {
      insertVulnRow({ id: 'VER-2', versions: ['1.0.0', '1.0.1'] })
      expect(queryLocalDB('npm', 'testpkg', '1.0.2')).toHaveLength(0)
    })

    it('should treat versions list as authoritative over matching events', () => {
      insertVulnRow({
        id: 'VER-3',
        versions: ['1.0.0'],
        events: [{ introduced: '0' }, { fixed: '9.9.9' }],
      })
      // Events would match 5.0.0, but versions list wins
      expect(queryLocalDB('npm', 'testpkg', '5.0.0')).toHaveLength(0)
      expect(queryLocalDB('npm', 'testpkg', '1.0.0')).toHaveLength(1)
    })

    it('should match nothing when versions list is empty', () => {
      insertVulnRow({ id: 'VER-4', versions: [] })
      expect(queryLocalDB('npm', 'testpkg', '1.0.0')).toHaveLength(0)
    })

    it('should fall back to events when versions JSON is malformed', () => {
      insertVulnRow({
        id: 'VER-5',
        versions: 'not-json',
        events: [{ introduced: '1.0.0' }, { fixed: '2.0.0' }],
      })
      expect(queryLocalDB('npm', 'testpkg', '1.5.0')).toHaveLength(1)
      expect(queryLocalDB('npm', 'testpkg', '2.5.0')).toHaveLength(0)
    })
  })

  describe('queryLocalDB — range events matching', () => {
    it('should match version inside an introduced/fixed range', () => {
      insertVulnRow({ id: 'EV-1', events: [{ introduced: '7.4.0' }, { fixed: '7.4.3.132' }] })
      expect(queryLocalDB('npm', 'testpkg', '7.4.2')).toHaveLength(1)
    })

    it('should match version equal to introduced', () => {
      insertVulnRow({ id: 'EV-2', events: [{ introduced: '1.0.0' }, { fixed: '2.0.0' }] })
      expect(queryLocalDB('npm', 'testpkg', '1.0.0')).toHaveLength(1)
    })

    it('should not match version below introduced', () => {
      insertVulnRow({ id: 'EV-3', events: [{ introduced: '1.0.0' }, { fixed: '2.0.0' }] })
      expect(queryLocalDB('npm', 'testpkg', '0.9.9')).toHaveLength(0)
    })

    it('should not match version equal to fixed', () => {
      insertVulnRow({ id: 'EV-4', events: [{ introduced: '1.0.0' }, { fixed: '2.0.0' }] })
      expect(queryLocalDB('npm', 'testpkg', '2.0.0')).toHaveLength(0)
    })

    it('should treat missing version segments as zero', () => {
      insertVulnRow({ id: 'EV-5', events: [{ introduced: '1.0' }, { fixed: '2.0' }] })
      expect(queryLocalDB('npm', 'testpkg', '1.0.0')).toHaveLength(1)
      expect(queryLocalDB('npm', 'testpkg', '2.0.0')).toHaveLength(0)
    })

    it('should match version inside any of multiple ranges', () => {
      insertVulnRow({
        id: 'EV-6',
        events: [
          { introduced: '1.0.0' }, { fixed: '1.2.0' },
          { introduced: '2.0.0' }, { fixed: '2.5.0' },
        ],
      })
      expect(queryLocalDB('npm', 'testpkg', '1.1.0')).toHaveLength(1)
      expect(queryLocalDB('npm', 'testpkg', '2.3.0')).toHaveLength(1)
    })

    it('should not match version in the gap between ranges', () => {
      insertVulnRow({
        id: 'EV-7',
        events: [
          { introduced: '1.0.0' }, { fixed: '1.2.0' },
          { introduced: '2.0.0' }, { fixed: '2.5.0' },
        ],
      })
      expect(queryLocalDB('npm', 'testpkg', '1.5.0')).toHaveLength(0)
    })

    it('should match versions at or after an unclosed trailing introduced', () => {
      insertVulnRow({
        id: 'EV-8',
        events: [{ introduced: '1.0.0' }, { fixed: '1.2.0' }, { introduced: '3.0.0' }],
      })
      expect(queryLocalDB('npm', 'testpkg', '3.1.0')).toHaveLength(1)
      expect(queryLocalDB('npm', 'testpkg', '2.0.0')).toHaveLength(0)
    })

    it('should match version equal to last_affected', () => {
      insertVulnRow({ id: 'EV-9', events: [{ introduced: '1.0.0' }, { last_affected: '1.5.0' }] })
      expect(queryLocalDB('npm', 'testpkg', '1.5.0')).toHaveLength(1)
    })

    it('should not match version after last_affected', () => {
      insertVulnRow({ id: 'EV-10', events: [{ introduced: '1.0.0' }, { last_affected: '1.5.0' }] })
      expect(queryLocalDB('npm', 'testpkg', '1.5.1')).toHaveLength(0)
    })
  })

  describe('queryLocalDB — conservative fallbacks', () => {
    it('should conservatively match when row has neither versions nor events', () => {
      insertVulnRow({ id: 'CF-1', versions: null, events: null })
      expect(queryLocalDB('npm', 'testpkg', '99.0.0')).toHaveLength(1)
    })

    it('should conservatively match when events JSON is malformed', () => {
      insertVulnRow({ id: 'CF-2', versions: null, events: '[{bad json' })
      expect(queryLocalDB('npm', 'testpkg', '1.0.0')).toHaveLength(1)
    })
  })

  describe('queryLocalDB — field extraction', () => {
    it('should fall back to row id when aliases contain no CVE', () => {
      insertVulnRow({ id: 'GHSA-no-cve', aliases: JSON.stringify(['GHSA-no-cve']), events: [{ introduced: '0' }] })
      const results = queryLocalDB('npm', 'testpkg', '1.0.0')
      expect(results[0]!.cve).toBe('GHSA-no-cve')
    })

    it('should fall back to row id when aliases JSON is malformed', () => {
      insertVulnRow({ id: 'GHSA-bad-alias', aliases: '[invalid', events: [{ introduced: '0' }] })
      const results = queryLocalDB('npm', 'testpkg', '1.0.0')
      expect(results[0]!.cve).toBe('GHSA-bad-alias')
    })

    it('should return empty fixedVersion when events have no fixed entry', () => {
      insertVulnRow({ id: 'FLD-1', events: [{ introduced: '1.0.0' }] })
      const results = queryLocalDB('npm', 'testpkg', '1.0.0')
      expect(results[0]!.fixedVersion).toBe('')
    })

    it('should return empty fixedVersion when events JSON is malformed', () => {
      insertVulnRow({ id: 'FLD-2', events: 'not-json' })
      const results = queryLocalDB('npm', 'testpkg', '1.0.0')
      expect(results[0]!.fixedVersion).toBe('')
    })

    it('should return empty description when summary is null', () => {
      insertVulnRow({ id: 'FLD-3', summary: null, events: [{ introduced: '0' }] })
      const results = queryLocalDB('npm', 'testpkg', '1.0.0')
      expect(results[0]!.description).toBe('')
    })
  })

  describe('hasLocalData', () => {
    it('should return false when ecosystem was never synced', () => {
      expect(hasLocalData('npm')).toBe(false)
    })

    it('should return true when synced just now', () => {
      const db = getDatabase()
      db.prepare('INSERT OR REPLACE INTO sync_metadata (ecosystem, synced_at, entry_count) VALUES (?, ?, ?)')
        .run('npm', Date.now(), 100)
      expect(hasLocalData('npm')).toBe(true)
    })

    it('should return true when synced 6 days ago', () => {
      const db = getDatabase()
      const sixDaysAgo = Date.now() - 6 * 24 * 60 * 60 * 1000
      db.prepare('INSERT OR REPLACE INTO sync_metadata (ecosystem, synced_at, entry_count) VALUES (?, ?, ?)')
        .run('npm', sixDaysAgo, 100)
      expect(hasLocalData('npm')).toBe(true)
    })

    it('should return false when synced more than 7 days ago', () => {
      const db = getDatabase()
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
      db.prepare('INSERT OR REPLACE INTO sync_metadata (ecosystem, synced_at, entry_count) VALUES (?, ?, ?)')
        .run('npm', eightDaysAgo, 100)
      expect(hasLocalData('npm')).toBe(false)
    })

    it('should track freshness independently per ecosystem', () => {
      const db = getDatabase()
      db.prepare('INSERT OR REPLACE INTO sync_metadata (ecosystem, synced_at, entry_count) VALUES (?, ?, ?)')
        .run('npm', Date.now(), 100)
      expect(hasLocalData('PyPI')).toBe(false)
    })
  })
})
