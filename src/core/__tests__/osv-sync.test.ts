/**
 * Tests for src/core/security/osv-sync
 *
 * Tests the OSV offline sync: a small fixture zip is built on the fly
 * with the system `zip` binary, served through a mocked global fetch,
 * and extracted by the real `unzip` binary (execFileSync is NOT mocked).
 * Verifies parsing, ecosystem filtering, malformed-file tolerance,
 * stale-row replacement, sync metadata, and download error handling.
 * Uses in-memory SQLite for isolation.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { initDatabase, closeDatabase, getDatabase } from '../database'
import { syncEcosystem, getLastSync } from '../security/osv-sync'
import { queryLocalDB, hasLocalData } from '../security/local-query'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs'
import { execFileSync } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'

// ============================================================================
// Fixture OSV entries
// ============================================================================

/** GHSA entry with CVE alias, MODERATE severity, and an ECOSYSTEM range. */
const GHSA_RANGE_ENTRY = {
  id: 'GHSA-test-0001',
  aliases: ['CVE-2024-0001'],
  summary: 'Test vulnerability in TestPkg',
  database_specific: { severity: 'MODERATE' },
  affected: [
    {
      package: { name: 'TestPkg', ecosystem: 'npm' },
      ranges: [
        { type: 'ECOSYSTEM', events: [{ introduced: '1.0.0' }, { fixed: '1.2.0' }] },
      ],
    },
  ],
}

/** Entry with an explicit versions list and a numeric CVSS score (7.5 → HIGH). */
const VERSIONS_ENTRY = {
  id: 'GHSA-test-0002',
  summary: 'Vulnerability with explicit version list',
  severity: [{ type: 'CVSS_V3', score: '7.5' }],
  affected: [
    {
      package: { name: 'VersionPkg', ecosystem: 'npm' },
      versions: ['1.0.0', '1.0.1'],
    },
  ],
}

/** Entry for a different ecosystem — must be skipped when syncing npm. */
const PYPI_ENTRY = {
  id: 'GHSA-test-0003',
  summary: 'PyPI-only vulnerability',
  affected: [
    {
      package: { name: 'PyPkg', ecosystem: 'PyPI' },
      versions: ['2.0.0'],
    },
  ],
}

/** Truncated JSON — must be skipped without aborting the sync. */
const MALFORMED_CONTENT = '{ "id": "BROKEN", "summary": '

// ============================================================================
// Fixture zip helpers
// ============================================================================

let fixtureDir: string
let zipBytes: Buffer

/** Stub global fetch to serve the fixture zip as a successful download. */
function stubFetchWithZip(): void {
  const arrayBuffer = zipBytes.buffer.slice(
    zipBytes.byteOffset,
    zipBytes.byteOffset + zipBytes.byteLength
  ) as ArrayBuffer
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    arrayBuffer: async () => arrayBuffer,
  })))
}

/** Stub global fetch to simulate a failed download. */
function stubFetchFailure(status: number): void {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: false,
    status,
    statusText: 'Service Unavailable',
  })))
}

// ============================================================================
// Tests
// ============================================================================

describe('OSV Sync', () => {
  beforeAll(() => {
    // Use in-memory SQLite for testing
    initDatabase(':memory:')

    // Build a small fixture zip with the real `zip` binary
    fixtureDir = mkdtempSync(join(tmpdir(), 'manel-osv-fixture-'))
    const files: Record<string, string> = {
      'GHSA-test-0001.json': JSON.stringify(GHSA_RANGE_ENTRY),
      'GHSA-test-0002.json': JSON.stringify(VERSIONS_ENTRY),
      'GHSA-test-0003.json': JSON.stringify(PYPI_ENTRY),
      'MALFORMED-broken.json': MALFORMED_CONTENT,
    }
    const paths: string[] = []
    for (const [name, content] of Object.entries(files)) {
      const filePath = join(fixtureDir, name)
      writeFileSync(filePath, content)
      paths.push(filePath)
    }
    const zipPath = join(fixtureDir, 'all.zip')
    execFileSync('zip', ['-j', '-q', zipPath, ...paths])
    zipBytes = readFileSync(zipPath)
  })

  afterAll(() => {
    closeDatabase()
    rmSync(fixtureDir, { recursive: true, force: true })
  })

  beforeEach(() => {
    const db = getDatabase()
    db.exec('DELETE FROM vuln_db')
    db.exec('DELETE FROM sync_metadata')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getLastSync', () => {
    it('should return null when ecosystem was never synced', () => {
      expect(getLastSync('npm')).toBeNull()
    })
  })

  describe('syncEcosystem', () => {
    it('should insert only entries matching the synced ecosystem', async () => {
      stubFetchWithZip()
      const result = await syncEcosystem('npm')

      expect(result.ecosystem).toBe('npm')
      expect(result.entries).toBe(2)
      expect(result.durationMs).toBeGreaterThanOrEqual(0)

      const db = getDatabase()
      const count = db.prepare('SELECT COUNT(*) AS c FROM vuln_db WHERE ecosystem = ?')
        .get('npm') as { c: number }
      expect(count.c).toBe(2)
    })

    it('should skip malformed JSON files without aborting the sync', async () => {
      stubFetchWithZip()
      // 4 files in the zip: 2 valid npm entries, 1 PyPI-only, 1 malformed
      const result = await syncEcosystem('npm')
      expect(result.entries).toBe(2)

      const db = getDatabase()
      const broken = db.prepare('SELECT * FROM vuln_db WHERE id = ?').get('BROKEN')
      expect(broken).toBeUndefined()
    })

    it('should store range-based entries queryable via the local query', async () => {
      stubFetchWithZip()
      await syncEcosystem('npm')

      const results = queryLocalDB('npm', 'TestPkg', '1.1.0')
      expect(results).toHaveLength(1)
      expect(results[0]).toEqual({
        cve: 'CVE-2024-0001',
        severity: 'MEDIUM', // normalized from MODERATE
        description: 'Test vulnerability in TestPkg',
        softwareId: '',
        fixedVersion: '1.2.0',
        source: 'OSV-local',
      })
      // Outside the fixed range → no match
      expect(queryLocalDB('npm', 'testpkg', '1.2.0')).toHaveLength(0)
    })

    it('should store explicit versions lists with normalized severity', async () => {
      stubFetchWithZip()
      await syncEcosystem('npm')

      const listed = queryLocalDB('npm', 'versionpkg', '1.0.1')
      expect(listed).toHaveLength(1)
      expect(listed[0]!.severity).toBe('HIGH') // parsed from CVSS score 7.5
      // Unlisted version → no match
      expect(queryLocalDB('npm', 'versionpkg', '1.0.2')).toHaveLength(0)
    })

    it('should lowercase package names when inserting', async () => {
      stubFetchWithZip()
      await syncEcosystem('npm')

      const db = getDatabase()
      const row = db.prepare('SELECT package_name FROM vuln_db WHERE id = ?')
        .get('GHSA-test-0001') as { package_name: string }
      expect(row.package_name).toBe('testpkg')
    })

    it('should update sync metadata and mark local data as fresh', async () => {
      stubFetchWithZip()
      await syncEcosystem('npm')

      const meta = getLastSync('npm')
      expect(meta).not.toBeNull()
      expect(meta!.entryCount).toBe(2)
      expect(Date.now() - meta!.syncedAt).toBeLessThan(60_000)
      expect(hasLocalData('npm')).toBe(true)
    })

    it('should replace stale rows for the ecosystem on re-sync', async () => {
      const db = getDatabase()
      db.prepare(`
        INSERT INTO vuln_db (id, ecosystem, package_name, aliases, severity, summary, events, versions)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('STALE-1', 'npm', 'stalepkg', '[]', 'LOW', 'stale row', null, null)

      stubFetchWithZip()
      await syncEcosystem('npm')

      expect(db.prepare('SELECT * FROM vuln_db WHERE id = ?').get('STALE-1')).toBeUndefined()
      const count = db.prepare('SELECT COUNT(*) AS c FROM vuln_db WHERE ecosystem = ?')
        .get('npm') as { c: number }
      expect(count.c).toBe(2)
    })

    it('should report progress through the callback', async () => {
      stubFetchWithZip()
      const messages: string[] = []
      await syncEcosystem('npm', msg => messages.push(msg))

      expect(messages).toContain('downloading')
      expect(messages).toContain('extracting')
      expect(messages.some(m => /parsing 4 files/.test(m))).toBe(true)
      expect(messages).toContain('inserting')
      expect(messages[messages.length - 1]).toBe('done')
    })

    it('should reject when the download fails', async () => {
      stubFetchFailure(503)
      await expect(syncEcosystem('npm')).rejects.toThrow(/OSV dump download failed: 503/)
      expect(getLastSync('npm')).toBeNull()
    })
  })
})
