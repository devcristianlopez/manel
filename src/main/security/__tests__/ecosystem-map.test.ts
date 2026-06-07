import { describe, it, expect } from 'vitest'
import { SOFTWARE_ECOSYSTEM_MAP } from '../ecosystem-map'

describe('SOFTWARE_ECOSYSTEM_MAP', () => {
  it('should have entries for all known technologies', () => {
    const knownTechs = ['node', 'npm', 'yarn', 'pnpm', 'python', 'python3', 'pip', 'java', 'mvn', 'gradle']

    for (const tech of knownTechs) {
      expect(SOFTWARE_ECOSYSTEM_MAP).toHaveProperty(tech)
    }
  })

  it('should map npm-related tools to npm ecosystem', () => {
    expect(SOFTWARE_ECOSYSTEM_MAP.node).toBe('npm')
    expect(SOFTWARE_ECOSYSTEM_MAP.npm).toBe('npm')
    expect(SOFTWARE_ECOSYSTEM_MAP.yarn).toBe('npm')
    expect(SOFTWARE_ECOSYSTEM_MAP.pnpm).toBe('npm')
  })

  it('should map Python-related tools to PyPI ecosystem', () => {
    expect(SOFTWARE_ECOSYSTEM_MAP.python).toBe('PyPI')
    expect(SOFTWARE_ECOSYSTEM_MAP.python3).toBe('PyPI')
    expect(SOFTWARE_ECOSYSTEM_MAP.pip).toBe('PyPI')
  })

  it('should map Java-related tools to Maven ecosystem', () => {
    expect(SOFTWARE_ECOSYSTEM_MAP.java).toBe('Maven')
    expect(SOFTWARE_ECOSYSTEM_MAP.mvn).toBe('Maven')
    expect(SOFTWARE_ECOSYSTEM_MAP.gradle).toBe('Maven')
  })

  it('should have consistent capitalization', () => {
    const ecosystems = Object.values(SOFTWARE_ECOSYSTEM_MAP)
    const expectedEcosystems = ['npm', 'PyPI', 'Maven']

    for (const eco of expectedEcosystems) {
      expect(ecosystems).toContain(eco)
    }
  })

  it('should contain only expected ecosystem values', () => {
    const ecosystems = new Set(Object.values(SOFTWARE_ECOSYSTEM_MAP))
    const allowedEcosystems = ['npm', 'PyPI', 'Maven']

    for (const eco of ecosystems) {
      expect(allowedEcosystems).toContain(eco)
    }
  })

  it('should map every entry to exactly one ecosystem', () => {
    for (const [software, ecosystem] of Object.entries(SOFTWARE_ECOSYSTEM_MAP)) {
      expect(ecosystem).toBeTypeOf('string')
      expect(ecosystem.length).toBeGreaterThan(0)
    }
  })
})
