/**
 * Tests for src/core/database/cache — API failure negative caching
 *
 * Tests the negative-cache functions used to avoid hammering failing
 * APIs: recordApiFailure, hasRecentApiFailure (15-minute TTL), and
 * clearApiFailure. Uses in-memory SQLite for isolation.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initDatabase, closeDatabase, getDatabase } from '../database'
import {
  recordApiFailure,
  hasRecentApiFailure,
  clearApiFailure,
} from '../database/cache'

describe('API Failure Cache (Negative Caching)', () => {
  beforeAll(() => {
    // Use in-memory SQLite for testing
    initDatabase(':memory:')
  })

  afterAll(() => {
    closeDatabase()
  })

  beforeEach(() => {
    const db = getDatabase()
    db.exec('DELETE FROM api_failures')
  })

  it('should return false for a key with no recorded failure', () => {
    expect(hasRecentApiFailure('version:node')).toBe(false)
  })

  it('should return true after recording a failure', () => {
    recordApiFailure('version:node')
    expect(hasRecentApiFailure('version:node')).toBe(true)
  })

  it('should track failures independently per key', () => {
    recordApiFailure('version:node')
    expect(hasRecentApiFailure('version:node')).toBe(true)
    expect(hasRecentApiFailure('version:npm')).toBe(false)
  })

  it('should return false after clearing the failure', () => {
    recordApiFailure('version:node')
    clearApiFailure('version:node')
    expect(hasRecentApiFailure('version:node')).toBe(false)
  })

  it('should not throw when clearing a non-existent key', () => {
    expect(() => clearApiFailure('version:nonexistent')).not.toThrow()
  })

  it('should return false for failures older than 15 minutes', () => {
    const db = getDatabase()
    const sixteenMinutesAgo = Date.now() - 16 * 60 * 1000
    db.prepare('INSERT OR REPLACE INTO api_failures (api_key, failed_at) VALUES (?, ?)')
      .run('version:old', sixteenMinutesAgo)
    expect(hasRecentApiFailure('version:old')).toBe(false)
  })

  it('should return true for failures within the 15 minute window', () => {
    const db = getDatabase()
    const fourteenMinutesAgo = Date.now() - 14 * 60 * 1000
    db.prepare('INSERT OR REPLACE INTO api_failures (api_key, failed_at) VALUES (?, ?)')
      .run('version:recent', fourteenMinutesAgo)
    expect(hasRecentApiFailure('version:recent')).toBe(true)
  })

  it('should overwrite a stale failure timestamp on re-record', () => {
    const db = getDatabase()
    const sixteenMinutesAgo = Date.now() - 16 * 60 * 1000
    db.prepare('INSERT OR REPLACE INTO api_failures (api_key, failed_at) VALUES (?, ?)')
      .run('version:node', sixteenMinutesAgo)
    expect(hasRecentApiFailure('version:node')).toBe(false)

    recordApiFailure('version:node')
    expect(hasRecentApiFailure('version:node')).toBe(true)
  })

  it('should keep expired failure rows until overwritten or cleared', () => {
    const db = getDatabase()
    const sixteenMinutesAgo = Date.now() - 16 * 60 * 1000
    db.prepare('INSERT OR REPLACE INTO api_failures (api_key, failed_at) VALUES (?, ?)')
      .run('version:stale', sixteenMinutesAgo)

    // Expired entries are invisible to hasRecentApiFailure but the row remains
    expect(hasRecentApiFailure('version:stale')).toBe(false)
    const row = db.prepare('SELECT failed_at FROM api_failures WHERE api_key = ?')
      .get('version:stale')
    expect(row).toBeDefined()
  })
})
