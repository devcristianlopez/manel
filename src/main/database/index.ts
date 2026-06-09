import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import { randomUUID } from 'crypto'
import { Software, Vulnerability, Scan, HardeningResult } from '../../shared/types'

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'manel.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initializeSchema()
  }
  return db
}

function initializeSchema() {
  db!.exec(`
    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      date INTEGER NOT NULL,
      score INTEGER,
      critical_count INTEGER DEFAULT 0,
      high_count INTEGER DEFAULT 0,
      medium_count INTEGER DEFAULT 0,
      low_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS software (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      path TEXT,
      detected_at INTEGER NOT NULL,
      scan_id TEXT,
      FOREIGN KEY (scan_id) REFERENCES scans(id)
    );

    CREATE TABLE IF NOT EXISTS hardening_results (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL,
      check_id TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      severity TEXT NOT NULL,
      details TEXT,
      FOREIGN KEY (scan_id) REFERENCES scans(id)
    );

    CREATE TABLE IF NOT EXISTS vulnerabilities (
      id TEXT PRIMARY KEY,
      cve TEXT,
      severity TEXT NOT NULL,
      description TEXT,
      software_id TEXT NOT NULL,
      fixed_version TEXT,
      source TEXT,
      FOREIGN KEY (software_id) REFERENCES software(id)
    );
  `)
}

export function saveSoftware(softwareList: Omit<Software, 'id'>[]): Software[] {
  const database = getDatabase()
  const stmt = database.prepare(`
    INSERT INTO software (id, name, version, path, detected_at, scan_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const results: Software[] = []
  const insertMany = database.transaction((items: Omit<Software, 'id'>[]) => {
    for (const item of items) {
      const id = randomUUID()
      stmt.run(id, item.name, item.version, item.path, item.detected_at, item.scan_id)
      results.push({ ...item, id })
    }
  })
  insertMany(softwareList)
  return results
}

export function saveHardeningResults(results: Omit<HardeningResult, 'id'>[]): HardeningResult[] {
  const database = getDatabase()
  const stmt = database.prepare(`
    INSERT INTO hardening_results (id, scan_id, check_id, category, title, status, severity, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const saved: HardeningResult[] = []
  const insertMany = database.transaction((items: Omit<HardeningResult, 'id'>[]) => {
    for (const item of items) {
      const id = randomUUID()
      stmt.run(id, item.scan_id, item.check_id, item.category, item.title, item.status, item.severity, item.details)
      saved.push({ ...item, id })
    }
  })
  insertMany(results)
  return saved
}

export function getHardeningResultsByScanId(scanId: string): HardeningResult[] {
  const database = getDatabase()
  return database.prepare('SELECT * FROM hardening_results WHERE scan_id = ? ORDER BY category').all(scanId) as HardeningResult[]
}

export function saveVulnerabilities(vulns: Omit<Vulnerability, 'id'>[]): Vulnerability[] {
  const database = getDatabase()
  const stmt = database.prepare(`
    INSERT INTO vulnerabilities (id, cve, severity, description, software_id, fixed_version, source)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const results: Vulnerability[] = []
  const insertMany = database.transaction((items: Omit<Vulnerability, 'id'>[]) => {
    for (const item of items) {
      const id = randomUUID()
      stmt.run(id, item.cve, item.severity, item.description, item.software_id, item.fixed_version, item.source)
      results.push({ ...item, id })
    }
  })
  insertMany(vulns)
  return results
}

export function createScan(): Scan {
  const database = getDatabase()
  const id = randomUUID()
  const date = Math.floor(Date.now() / 1000)
  database.prepare(`
    INSERT INTO scans (id, date, score, critical_count, high_count, medium_count, low_count, status)
    VALUES (?, ?, NULL, 0, 0, 0, 0, 'pending')
  `).run(id, date)
  return {
    id,
    date,
    score: null,
    critical_count: 0,
    high_count: 0,
    medium_count: 0,
    low_count: 0,
    status: 'pending'
  }
}

export function updateScan(id: string, data: Partial<Scan>): void {
  const database = getDatabase()
  const entries = Object.entries(data)
  if (entries.length === 0) return
  const setClause = entries.map(([key]) => `${key} = ?`).join(', ')
  const values = entries.map(([, value]) => value)
  database.prepare(`UPDATE scans SET ${setClause} WHERE id = ?`).run(...values, id)
}

export function getLatestScan(): Scan | null {
  const database = getDatabase()
  const row = database.prepare('SELECT * FROM scans ORDER BY date DESC LIMIT 1').get() as Scan | undefined
  return row || null
}

export function getAllSoftware(): Software[] {
  const database = getDatabase()
  return database.prepare('SELECT * FROM software ORDER BY name').all() as Software[]
}

export function getSoftwareByScanId(scanId: string): Software[] {
  const database = getDatabase()
  return database.prepare('SELECT * FROM software WHERE scan_id = ? ORDER BY name').all(scanId) as Software[]
}

export function getVulnerabilitiesForSoftware(softwareId: string): Vulnerability[] {
  const database = getDatabase()
  return database.prepare('SELECT * FROM vulnerabilities WHERE software_id = ?').all(softwareId) as Vulnerability[]
}

export function closeDatabase() {
  if (db) {
    db.close()
    db = null
  }
}
