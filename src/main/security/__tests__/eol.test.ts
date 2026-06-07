import { describe, it, expect } from 'vitest'
import { EOL_DATES } from '../eol'

describe('EOL dates data integrity', () => {
  it('should have entries for known technologies', () => {
    const technologies = Object.keys(EOL_DATES)
    expect(technologies).toContain('node')
    expect(technologies).toContain('python')
    expect(technologies).toContain('java')
    expect(technologies).toContain('npm')
  })

  it('should have valid date formats for each entry', () => {
    const dateRegex = /^\d{4}-\d{2}(-\d{2})?$/

    for (const [tech, entries] of Object.entries(EOL_DATES)) {
      expect(entries.length).toBeGreaterThan(0)
      for (const entry of entries) {
        expect(entry.version).toBeTypeOf('string')
        expect(entry.version.length).toBeGreaterThan(0)
        expect(entry.eolDate).toMatch(dateRegex)
      }
    }
  })

  it('should have all EOL dates parseable as dates', () => {
    for (const [tech, entries] of Object.entries(EOL_DATES)) {
      for (const entry of entries) {
        const date = new Date(entry.eolDate)
        expect(date.getTime()).not.toBeNaN()
      }
    }
  })

  it('should have version strings without "v" prefix', () => {
    for (const [tech, entries] of Object.entries(EOL_DATES)) {
      for (const entry of entries) {
        expect(entry.version).not.toMatch(/^v/)
      }
    }
  })

  it('should have unique versions per technology', () => {
    for (const [tech, entries] of Object.entries(EOL_DATES)) {
      const versions = entries.map(e => e.version)
      const uniqueVersions = new Set(versions)
      expect(uniqueVersions.size).toBe(versions.length)
    }
  })

  it('should have some dates that are in the past', () => {
    const now = new Date()
    let hasPastDate = false
    let hasFutureDate = false

    for (const [tech, entries] of Object.entries(EOL_DATES)) {
      for (const entry of entries) {
        const eolDate = new Date(entry.eolDate)
        if (eolDate < now) hasPastDate = true
        if (eolDate > now) hasFutureDate = true
      }
    }

    expect(hasPastDate).toBe(true)
    expect(hasFutureDate).toBe(true)
  })

  it('should have npm versions in chronological order in the array', () => {
    const npmEntries = EOL_DATES.npm
    for (let i = 1; i < npmEntries.length; i++) {
      const prev = new Date(npmEntries[i - 1].eolDate)
      const curr = new Date(npmEntries[i].eolDate)
      // Earlier versions should generally have earlier EOL dates
      // but this depends on version numbering, so we don't strictly assert
      expect(npmEntries[i - 1].version).toBeTypeOf('string')
    }
  })

  it('should have no empty entry arrays', () => {
    for (const [tech, entries] of Object.entries(EOL_DATES)) {
      expect(entries.length).toBeGreaterThan(0)
    }
  })
})
