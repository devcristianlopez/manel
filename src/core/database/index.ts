/**
 * Manel Core — Database Layer
 *
 * SQLite database operations using better-sqlite3.
 * Provides CRUD operations for scans, software, vulnerabilities,
 * and hardening results. No Electron dependencies — the database
 * path is configured at initialization time.
 *
 * @module core/database
 */

import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import type {
  CoreSoftware,
  CoreScan,
  CoreVulnerabilityRecord,
  CoreHardeningRecord,
} from '../types'

// ============================================================================
// 1. Database Instance
// ============================================================================

/** Active database connection (null until initialized) */
let db: Database.Database | null = null

/**
 * Initialize the database with a given file path.
 *
 * Must be called before any other database operations.
 * Sets up WAL mode, foreign keys, and creates the schema.
 *
 * @param dbPath - Absolute path to the SQLite database file
 * @returns The database instance
 * @throws If the database cannot be opened
 */
export function initDatabase(dbPath: string): Database.Database {
  if (db) {
    db.close()
  }
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  initializeSchema()
  return db
}

/**
 * Get the active database instance.
 *
 * @returns The database instance
 * @throws If the database has not been initialized
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase(dbPath) first.')
  }
  return db
}

/**
 * Close the database connection.
 */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

// ============================================================================
// 2. Schema
// ============================================================================

function initializeSchema(): void {
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

// ============================================================================
// 3. Scan Operations
// ============================================================================

/**
 * Create a new scan record with pending status.
 *
 * @returns The newly created scan
 */
export function createScan(): CoreScan {
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
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    status: 'pending',
  }
}

/**
 * Update a scan record.
 *
 * @param id - Scan ID to update
 * @param data - Fields to update (camelCase keys mapped to snake_case columns)
 */
export function updateScan(id: string, data: Partial<Omit<CoreScan, 'id'>>): void {
  const database = getDatabase()

  // Map camelCase to snake_case for SQL
  const fieldMap: Record<string, string> = {
    criticalCount: 'critical_count',
    highCount: 'high_count',
    mediumCount: 'medium_count',
    lowCount: 'low_count',
  }

  const entries = Object.entries(data).filter(([, value]) => value !== undefined)
  if (entries.length === 0) return

  const setClause = entries.map(([key]) => `${fieldMap[key] ?? key} = ?`).join(', ')
  const values = entries.map(([, value]) => value)
  database.prepare(`UPDATE scans SET ${setClause} WHERE id = ?`).run(...values, id)
}

/**
 * Get the most recent scan.
 *
 * @returns The latest scan, or null if none exist
 */
export function getLatestScan(): CoreScan | null {
  const database = getDatabase()
  const row = database.prepare('SELECT * FROM scans ORDER BY date DESC LIMIT 1').get() as Record<string, unknown> | undefined
  if (!row) return null
  return mapScanRow(row)
}

function mapScanRow(row: Record<string, unknown>): CoreScan {
  return {
    id: row.id as string,
    date: row.date as number,
    score: row.score as number | null,
    criticalCount: row.critical_count as number,
    highCount: row.high_count as number,
    mediumCount: row.medium_count as number,
    lowCount: row.low_count as number,
    status: row.status as CoreScan['status'],
  }
}

// ============================================================================
// 4. Software Operations
// ============================================================================

/**
 * Save detected software entries to the database.
 *
 * @param softwareList - Array of software entries (without IDs)
 * @returns Array of saved software entries with generated IDs
 */
export function saveSoftware(softwareList: Array<Omit<CoreSoftware, 'id'>>): CoreSoftware[] {
  const database = getDatabase()
  const stmt = database.prepare(`
    INSERT INTO software (id, name, version, path, detected_at, scan_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const results: CoreSoftware[] = []
  const insertMany = database.transaction((items: Array<Omit<CoreSoftware, 'id'>>) => {
    for (const item of items) {
      const id = randomUUID()
      stmt.run(id, item.name, item.version, item.path, item.detectedAt, item.scanId)
      results.push({ ...item, id })
    }
  })
  insertMany(softwareList)
  return results
}

/**
 * Get all software entries ordered by name.
 *
 * @returns Array of all software entries
 */
export function getAllSoftware(): CoreSoftware[] {
  const database = getDatabase()
  const rows = database.prepare('SELECT * FROM software ORDER BY name').all() as Record<string, unknown>[]
  return rows.map(mapSoftwareRow)
}

/**
 * Get software entries for a specific scan.
 *
 * @param scanId - Scan ID to filter by
 * @returns Array of software entries for the scan
 */
export function getSoftwareByScanId(scanId: string): CoreSoftware[] {
  const database = getDatabase()
  const rows = database.prepare('SELECT * FROM software WHERE scan_id = ? ORDER BY name').all(scanId) as Record<string, unknown>[]
  return rows.map(mapSoftwareRow)
}

function mapSoftwareRow(row: Record<string, unknown>): CoreSoftware {
  return {
    id: row.id as string,
    name: row.name as string,
    version: row.version as string,
    path: row.path as string,
    detectedAt: row.detected_at as number,
    scanId: row.scan_id as string,
  }
}

// ============================================================================
// 5. Vulnerability Operations
// ============================================================================

/**
 * Save vulnerability records to the database.
 *
 * @param vulns - Array of vulnerability records (without IDs)
 * @returns Array of saved vulnerability records with generated IDs
 */
export function saveVulnerabilities(vulns: Array<Omit<CoreVulnerabilityRecord, 'id'>>): CoreVulnerabilityRecord[] {
  const database = getDatabase()
  const stmt = database.prepare(`
    INSERT INTO vulnerabilities (id, cve, severity, description, software_id, fixed_version, source)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const results: CoreVulnerabilityRecord[] = []
  const insertMany = database.transaction((items: Array<Omit<CoreVulnerabilityRecord, 'id'>>) => {
    for (const item of items) {
      const id = randomUUID()
      stmt.run(id, item.cve, item.severity, item.description, item.softwareId, item.fixedVersion, item.source)
      results.push({ ...item, id })
    }
  })
  insertMany(vulns)
  return results
}

/**
 * Get vulnerabilities for a specific software entry.
 *
 * @param softwareId - Software ID to filter by
 * @returns Array of vulnerability records
 */
export function getVulnerabilitiesForSoftware(softwareId: string): CoreVulnerabilityRecord[] {
  const database = getDatabase()
  const rows = database.prepare('SELECT * FROM vulnerabilities WHERE software_id = ?').all(softwareId) as Record<string, unknown>[]
  return rows.map(mapVulnerabilityRow)
}

function mapVulnerabilityRow(row: Record<string, unknown>): CoreVulnerabilityRecord {
  return {
    id: row.id as string,
    cve: row.cve as string,
    severity: row.severity as string,
    description: row.description as string,
    softwareId: row.software_id as string,
    fixedVersion: row.fixed_version as string,
    source: row.source as string,
  }
}

// ============================================================================
// 6. Hardening Operations
// ============================================================================

/**
 * Save hardening check results to the database.
 *
 * @param results - Array of hardening results (without IDs)
 * @returns Array of saved hardening results with generated IDs
 */
export function saveHardeningResults(results: Array<Omit<CoreHardeningRecord, 'id'>>): CoreHardeningRecord[] {
  const database = getDatabase()
  const stmt = database.prepare(`
    INSERT INTO hardening_results (id, scan_id, check_id, category, title, status, severity, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const saved: CoreHardeningRecord[] = []
  const insertMany = database.transaction((items: Array<Omit<CoreHardeningRecord, 'id'>>) => {
    for (const item of items) {
      const id = randomUUID()
      stmt.run(id, item.scanId, item.checkId, item.category, item.title, item.status, item.severity, item.details)
      saved.push({ ...item, id })
    }
  })
  insertMany(results)
  return saved
}

/**
 * Get hardening results for a specific scan.
 *
 * @param scanId - Scan ID to filter by
 * @returns Array of hardening results ordered by category
 */
export function getHardeningResultsByScanId(scanId: string): CoreHardeningRecord[] {
  const database = getDatabase()
  const rows = database.prepare('SELECT * FROM hardening_results WHERE scan_id = ? ORDER BY category').all(scanId) as Record<string, unknown>[]
  return rows.map(mapHardeningRow)
}

function mapHardeningRow(row: Record<string, unknown>): CoreHardeningRecord {
  return {
    id: row.id as string,
    scanId: row.scan_id as string,
    checkId: row.check_id as string,
    category: row.category as string,
    title: row.title as string,
    status: row.status as CoreHardeningRecord['status'],
    severity: row.severity as string,
    details: row.details as string,
  }
}
