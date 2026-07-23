/**
 * Tests for src/core/security/score-engine and score-utils
 */
import { describe, it, expect } from 'vitest'
import {
  calculateScore,
  calculateScoreBreakdown,
  calculateHardeningScore,
  getTrafficLight,
  countBySeverity,
} from '../security/score-engine'
import {
  categorizeTechnology,
  technologyStatusToScore,
  hardeningStatusToScore,
} from '../security/score-utils'
import type { CoreTechnologyResult, CoreHardeningCheck } from '../types'

function makeTech(
  name: string,
  status: CoreTechnologyResult['status'] = 'green',
  vulnerabilities: CoreTechnologyResult['vulnerabilities'] = []
): CoreTechnologyResult {
  return {
    name,
    installedVersion: '1.0.0',
    latestVersion: '2.0.0',
    status,
    vulnerabilities,
    recommendation: '',
  }
}

function makeVuln(severity: string, fixedVersion?: string): CoreTechnologyResult['vulnerabilities'][0] {
  return {
    cve: 'CVE-2024-0001',
    severity: severity as any,
    description: 'Test vulnerability',
    softwareId: 'sw-1',
    fixedVersion: fixedVersion ?? '',
    source: 'test',
  }
}

function makeHardeningCheck(status: CoreHardeningCheck['status'] = 'pass'): CoreHardeningCheck {
  return {
    checkId: 'check-1',
    category: 'firewall',
    title: 'Test check',
    status,
    severity: 'HIGH',
    details: 'Test details',
  }
}

describe('Core Score Engine', () => {
  describe('calculateScore', () => {
    it('should return 0 for empty input', () => {
      expect(calculateScore([])).toBe(0)
    })

    it('should compute weighted score for green technologies', () => {
      const techs = [
        makeTech('ubuntu', 'green'),
        makeTech('npm', 'green'),
        makeTech('node', 'green'),
      ]
      expect(calculateScore(techs)).toBe(90)
    })

    it('should penalize critical vulnerabilities', () => {
      // node (green, deps): depsScore=100
      // criticalsPenalty: 1 active critical = max(0, 0-10) = 0
      // osScore=0, toolsScore=0, dbsScore=0, hardeningScore=100
      // final = 0*0.15 + 100*0.15 + 0*0.10 + 100*0.30 + 0*0.10 + 0*0.20 = 15+30 = 45
      const techs = [
        makeTech('node', 'green', [makeVuln('CRITICAL')]),
      ]
      expect(calculateScore(techs)).toBe(45)
    })

    it('should give lower score for black status', () => {
      const techs = [
        makeTech('ubuntu', 'black'),
        makeTech('npm', 'black'),
        makeTech('node', 'black'),
      ]
      expect(calculateScore(techs)).toBeLessThanOrEqual(35)
    })

    it('should handle hardening results', () => {
      const techs = [makeTech('node', 'green')]
      const hardening = [
        makeHardeningCheck('pass'),
        makeHardeningCheck('pass'),
      ]
      expect(calculateScore(techs, hardening)).toBe(65)
    })

    it('should penalize failing hardening checks', () => {
      const techs = [makeTech('node', 'green')]
      const hardening = [
        makeHardeningCheck('fail'),
        makeHardeningCheck('fail'),
      ]
      expect(calculateScore(techs, hardening)).toBe(50)
    })
  })

  describe('calculateScoreBreakdown', () => {
    it('should return full breakdown', () => {
      const techs = [
        makeTech('ubuntu', 'green'),
        makeTech('node', 'green'),
      ]
      const breakdown = calculateScoreBreakdown(techs)
      expect(breakdown).toHaveProperty('overall')
      expect(breakdown).toHaveProperty('breakdown')
      expect(breakdown.breakdown).toHaveProperty('os')
      expect(breakdown.breakdown).toHaveProperty('hardening')
      expect(breakdown.breakdown).toHaveProperty('tools')
      expect(breakdown.breakdown).toHaveProperty('dependencies')
      expect(breakdown.breakdown).toHaveProperty('databases')
      expect(breakdown.breakdown).toHaveProperty('criticalsPenalty')
    })
  })

  describe('calculateHardeningScore', () => {
    it('should return 100 for empty results', () => {
      expect(calculateHardeningScore([])).toBe(100)
    })

    it('should return 100 when all checks pass', () => {
      expect(calculateHardeningScore([
        makeHardeningCheck('pass'),
        makeHardeningCheck('pass'),
      ])).toBe(100)
    })

    it('should return 0 when all checks fail', () => {
      expect(calculateHardeningScore([
        makeHardeningCheck('fail'),
        makeHardeningCheck('fail'),
      ])).toBe(0)
    })

    it('should return 50 for mixed pass/fail', () => {
      expect(calculateHardeningScore([
        makeHardeningCheck('pass'),
        makeHardeningCheck('fail'),
      ])).toBe(50)
    })
  })

  describe('getTrafficLight', () => {
    it('should return green for score >= 80', () => {
      expect(getTrafficLight(80)).toBe('green')
      expect(getTrafficLight(100)).toBe('green')
    })

    it('should return yellow for scores 60-79', () => {
      expect(getTrafficLight(60)).toBe('yellow')
    })

    it('should return red for scores 40-59', () => {
      expect(getTrafficLight(40)).toBe('red')
    })

    it('should return black for scores < 40', () => {
      expect(getTrafficLight(0)).toBe('black')
    })
  })

  describe('countBySeverity', () => {
    it('should count zero for empty', () => {
      expect(countBySeverity([])).toEqual({ critical: 0, high: 0, medium: 0, low: 0 })
    })

    it('should count by severity', () => {
      const techs = [
        makeTech('node', 'red', [
          makeVuln('CRITICAL'),
          makeVuln('HIGH'),
          makeVuln('MEDIUM'),
          makeVuln('LOW'),
        ]),
      ]
      expect(countBySeverity(techs)).toEqual({ critical: 1, high: 1, medium: 1, low: 1 })
    })
  })
})

describe('Core Score Utils', () => {
  describe('categorizeTechnology', () => {
    it('should categorize OS technologies', () => {
      expect(categorizeTechnology('ubuntu')).toBe('os')
      expect(categorizeTechnology('macos')).toBe('os')
    })

    it('should categorize tools', () => {
      expect(categorizeTechnology('npm')).toBe('tools')
      expect(categorizeTechnology('git')).toBe('tools')
    })

    it('should categorize databases', () => {
      expect(categorizeTechnology('postgresql')).toBe('databases')
      expect(categorizeTechnology('mysql')).toBe('databases')
    })

    it('should categorize dependencies', () => {
      expect(categorizeTechnology('node')).toBe('dependencies')
      expect(categorizeTechnology('python')).toBe('dependencies')
    })

    it('should default unknown to dependencies', () => {
      expect(categorizeTechnology('unknown')).toBe('dependencies')
    })
  })

  describe('technologyStatusToScore', () => {
    it('should convert statuses correctly', () => {
      expect(technologyStatusToScore('green')).toBe(100)
      expect(technologyStatusToScore('yellow')).toBe(60)
      expect(technologyStatusToScore('red')).toBe(25)
      expect(technologyStatusToScore('black')).toBe(0)
    })
  })

  describe('hardeningStatusToScore', () => {
    it('should convert statuses correctly', () => {
      expect(hardeningStatusToScore('pass')).toBe(100)
      expect(hardeningStatusToScore('warning')).toBe(50)
      expect(hardeningStatusToScore('fail')).toBe(0)
      expect(hardeningStatusToScore('error')).toBe(25)
    })
  })
})
