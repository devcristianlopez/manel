import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateScore, getTrafficLight, countBySeverity, generateScanSummary } from '../score-engine'
import { categorizeTechnology, technologyStatusToScore } from '../score-utils'
import type { TechnologyResult, Vulnerability } from '../../../shared/types'
import { updateScan } from '../../database'

vi.mock('../../database', () => ({
  updateScan: vi.fn()
}))

function makeTech(
  name: string,
  status: TechnologyResult['status'] = 'green',
  vulnerabilities: Vulnerability[] = []
): TechnologyResult {
  return {
    name,
    installedVersion: '1.0.0',
    latestVersion: '2.0.0',
    status,
    vulnerabilities,
    recommendation: ''
  }
}

function makeVuln(
  severity: Vulnerability['severity'],
  fixedVersion?: string
): Vulnerability {
  return {
    id: 'test-id',
    cve: 'CVE-2024-0001',
    severity,
    description: 'Test vulnerability',
    software_id: 'sw-1',
    fixed_version: fixedVersion ?? '',
    source: 'test'
  }
}

describe('categorizeTechnology', () => {
  it('should categorize OS technologies', () => {
    expect(categorizeTechnology('ubuntu')).toBe('os')
    expect(categorizeTechnology('windows')).toBe('os')
    expect(categorizeTechnology('macos')).toBe('os')
    expect(categorizeTechnology('os')).toBe('os')
    expect(categorizeTechnology('platform')).toBe('os')
  })

  it('should categorize tools', () => {
    expect(categorizeTechnology('npm')).toBe('tools')
    expect(categorizeTechnology('yarn')).toBe('tools')
    expect(categorizeTechnology('git')).toBe('tools')
    expect(categorizeTechnology('docker')).toBe('tools')
    expect(categorizeTechnology('code')).toBe('tools')
    expect(categorizeTechnology('pip')).toBe('tools')
  })

  it('should categorize dependencies', () => {
    expect(categorizeTechnology('node')).toBe('dependencies')
    expect(categorizeTechnology('python')).toBe('dependencies')
    expect(categorizeTechnology('java')).toBe('dependencies')
    expect(categorizeTechnology('maven')).toBe('dependencies')
    expect(categorizeTechnology('gradle')).toBe('dependencies')
  })

  it('should be case insensitive', () => {
    expect(categorizeTechnology('NPM')).toBe('tools')
    expect(categorizeTechnology('Ubuntu')).toBe('os')
    expect(categorizeTechnology('Node')).toBe('dependencies')
  })

  it('should default unknown technologies to dependencies', () => {
    expect(categorizeTechnology('unknown')).toBe('dependencies')
    expect(categorizeTechnology('foo')).toBe('dependencies')
  })
})

describe('technologyStatusToScore', () => {
  it('should return 100 for green', () => {
    expect(technologyStatusToScore('green')).toBe(100)
  })

  it('should return 60 for yellow', () => {
    expect(technologyStatusToScore('yellow')).toBe(60)
  })

  it('should return 25 for red', () => {
    expect(technologyStatusToScore('red')).toBe(25)
  })

  it('should return 0 for black', () => {
    expect(technologyStatusToScore('black')).toBe(0)
  })
})

describe('calculateScore', () => {
  it('should return 100 when all technologies are green and no critical vulns', () => {
    const techs = [
      makeTech('ubuntu', 'green'),
      makeTech('npm', 'green'),
      makeTech('node', 'green')
    ]
    expect(calculateScore(techs)).toBe(100)
  })

  it('should return low score when all technologies are black', () => {
    const techs = [
      makeTech('ubuntu', 'black'),
      makeTech('npm', 'black'),
      makeTech('node', 'black')
    ]
    const score = calculateScore(techs)
    expect(score).toBeLessThanOrEqual(30)
  })

  it('should compute weighted score correctly', () => {
    const techs = [
      makeTech('ubuntu', 'green'),
      makeTech('npm', 'green'),
      makeTech('node', 'yellow')
    ]
    // osScore=100, toolsScore=100, depsScore=60, criticalsPenalty=100
    // final = 100*0.2 + 100*0.2 + 60*0.4 + 100*0.2 = 20+20+24+20 = 84
    expect(calculateScore(techs)).toBe(84)
  })

  it('should penalize active critical vulnerabilities', () => {
    const criticalVuln = makeVuln('CRITICAL')
    const techs = [
      makeTech('ubuntu', 'green'),
      makeTech('npm', 'green'),
      makeTech('node', 'green', [criticalVuln])
    ]
    // criticalsPenalty = 0 - 10*1 = 0 (max 0)
    // final = 100*0.2 + 100*0.2 + 100*0.4 + 0*0.2 = 20+20+40+0 = 80
    expect(calculateScore(techs)).toBe(80)
  })

  it('should penalize -10 per active critical CVE', () => {
    const vuln1 = makeVuln('CRITICAL')
    const vuln2 = makeVuln('CRITICAL')
    const techs = [
      makeTech('node', 'green', [vuln1, vuln2])
    ]
    // criticalsPenalty = 0 - 10*2 = 0 (max 0)
    // osScore=0, toolsScore=0, depsScore=100, criticalsPenalty=0
    // final = 0*0.2 + 0*0.2 + 100*0.4 + 0*0.2 = 40
    expect(calculateScore(techs)).toBe(40)
  })

  it('should give 50 penalty when critical vulns have fixes', () => {
    const fixedVuln = makeVuln('CRITICAL', '2.0.0')
    const techs = [
      makeTech('node', 'green', [fixedVuln])
    ]
    // criticalsPenalty = 50
    // final = 0*0.2 + 0*0.2 + 100*0.4 + 50*0.2 = 40+10 = 50
    expect(calculateScore(techs)).toBe(50)
  })

  it('should clamp score to 0-100', () => {
    const techs = [
      makeTech('node', 'black', [makeVuln('CRITICAL'), makeVuln('CRITICAL'), makeVuln('CRITICAL')])
    ]
    const score = calculateScore(techs)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('should return 0 for empty technologies', () => {
    expect(calculateScore([])).toBe(0)
  })

  it('should handle single technology', () => {
    const techs = [makeTech('node', 'green')]
    // node is 'dependencies' category → depsScore=100
    // osScore=0, toolsScore=0, criticalsPenalty=100
    // final = 0*0.2 + 0*0.2 + 100*0.4 + 100*0.2 = 40+20 = 60
    expect(calculateScore(techs)).toBe(60)
  })

  it('should handle many technologies without crashing', () => {
    const techs = Array.from({ length: 50 }, (_, i) =>
      makeTech(`tech-${i}`, i % 4 === 0 ? 'green' : i % 4 === 1 ? 'yellow' : i % 4 === 2 ? 'red' : 'black')
    )
    const score = calculateScore(techs)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('should return score 0 when max penalty applied', () => {
    // CriticalsPenalty = 0 - 10*100 = -1000, clamped to 0
    // With so many critical vulns, the penalty dominates
    const manyCritVulns = Array.from({ length: 20 }, (_, i) => makeVuln('CRITICAL'))
    const techs = [makeTech('node', 'black', manyCritVulns)]
    const score = calculateScore(techs)
    // Even with penalty = 0 (max(0, -200) = 0), depsScore=0 (black=0), final = 0
    expect(score).toBe(0)
  })

  it('should handle mixed categories with some empty', () => {
    // No OS tools, no tools, only dependencies
    const techs = [makeTech('node', 'green')]
    // osScore=0, toolsScore=0, depsScore=100, criticalsPenalty=100
    // final = 0*0.2 + 0*0.2 + 100*0.4 + 100*0.2 = 0+0+40+20 = 60
    expect(calculateScore(techs)).toBe(60)
  })
})

describe('getTrafficLight', () => {
  it('should return green for score >= 80', () => {
    expect(getTrafficLight(80)).toBe('green')
    expect(getTrafficLight(100)).toBe('green')
  })

  it('should return yellow for scores 60-79', () => {
    expect(getTrafficLight(60)).toBe('yellow')
    expect(getTrafficLight(79)).toBe('yellow')
  })

  it('should return red for scores 40-59', () => {
    expect(getTrafficLight(40)).toBe('red')
    expect(getTrafficLight(59)).toBe('red')
  })

  it('should return black for scores < 40', () => {
    expect(getTrafficLight(0)).toBe('black')
    expect(getTrafficLight(39)).toBe('black')
  })
})

describe('countBySeverity', () => {
  it('should count zero when no vulnerabilities', () => {
    expect(countBySeverity([])).toEqual({ critical: 0, high: 0, medium: 0, low: 0 })
  })

  it('should count vulnerabilities by severity', () => {
    const techs = [
      makeTech('node', 'red', [
        makeVuln('CRITICAL'),
        makeVuln('HIGH'),
        makeVuln('MEDIUM'),
        makeVuln('LOW')
      ])
    ]
    expect(countBySeverity(techs)).toEqual({ critical: 1, high: 1, medium: 1, low: 1 })
  })

  it('should aggregate across all technologies', () => {
    const techs = [
      makeTech('node', 'red', [makeVuln('CRITICAL'), makeVuln('HIGH')]),
      makeTech('npm', 'yellow', [makeVuln('MEDIUM')]),
      makeTech('git', 'green', [makeVuln('LOW')])
    ]
    expect(countBySeverity(techs)).toEqual({ critical: 1, high: 1, medium: 1, low: 1 })
  })

  it('should treat NONE severity as low', () => {
    const techs = [
      makeTech('node', 'green', [makeVuln('NONE')])
    ]
    expect(countBySeverity(techs)).toEqual({ critical: 0, high: 0, medium: 0, low: 1 })
  })
})

describe('generateScanSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should calculate score and counts and update scan', async () => {
    const techs = [
      makeTech('ubuntu', 'green'),
      makeTech('npm', 'green'),
      makeTech('node', 'green')
    ]

    const result = await generateScanSummary('scan-1', techs)

    expect(result.scan.id).toBe('scan-1')
    expect(result.scan.status).toBe('completed')
    expect(result.scan.score).toBe(100)
    expect(result.scan.critical_count).toBe(0)
    expect(result.technologies).toBe(techs)
    expect(result.overallScore).toBe(100)

    expect(updateScan).toHaveBeenCalledWith('scan-1', {
      score: 100,
      critical_count: 0,
      high_count: 0,
      medium_count: 0,
      low_count: 0,
      status: 'completed'
    })
  })

  it('should handle technologies with vulnerabilities', async () => {
    const techs = [
      makeTech('node', 'red', [
        makeVuln('CRITICAL'),
        makeVuln('HIGH'),
        makeVuln('HIGH')
      ])
    ]

    const result = await generateScanSummary('scan-2', techs)

    expect(result.scan.score).toBe(10)
    expect(result.scan.critical_count).toBe(1)
    expect(result.scan.high_count).toBe(2)
    expect(result.scan.medium_count).toBe(0)
    expect(result.scan.low_count).toBe(0)
  })

  it('should update scan with counts from countBySeverity', async () => {
    const techs = [
      makeTech('node', 'red', [
        makeVuln('CRITICAL'),
        makeVuln('HIGH'),
      ]),
      makeTech('npm', 'green'),
    ]

    await generateScanSummary('scan-3', techs)

    expect(updateScan).toHaveBeenCalledWith('scan-3', expect.objectContaining({
      critical_count: 1,
      high_count: 1,
    }))
  })
})
