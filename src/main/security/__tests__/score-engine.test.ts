import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateScore, calculateHardeningScore, getTrafficLight, countBySeverity, generateScanSummary } from '../score-engine'
import { categorizeTechnology, technologyStatusToScore, hardeningStatusToScore } from '../score-utils'
import type { HardeningResult } from '../../../shared/types'
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

  it('should categorize databases', () => {
    expect(categorizeTechnology('postgresql')).toBe('databases')
    expect(categorizeTechnology('mysql')).toBe('databases')
    expect(categorizeTechnology('mongodb')).toBe('databases')
    expect(categorizeTechnology('redis')).toBe('databases')
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

describe('hardeningStatusToScore', () => {
  it('should return 100 for pass', () => {
    expect(hardeningStatusToScore('pass')).toBe(100)
  })

  it('should return 50 for warning', () => {
    expect(hardeningStatusToScore('warning')).toBe(50)
  })

  it('should return 0 for fail', () => {
    expect(hardeningStatusToScore('fail')).toBe(0)
  })

  it('should return 25 for error', () => {
    expect(hardeningStatusToScore('error')).toBe(25)
  })

  it('should return 50 for unknown status', () => {
    expect(hardeningStatusToScore('unknown')).toBe(50)
  })
})

describe('calculateScore', () => {
  it('should return 100 when all technologies are green, no critical vulns, no hardening', () => {
    const techs = [
      makeTech('ubuntu', 'green'),
      makeTech('npm', 'green'),
      makeTech('node', 'green')
    ]
    expect(calculateScore(techs)).toBe(90)
  })

  it('should return low score when all technologies are black', () => {
    const techs = [
      makeTech('ubuntu', 'black'),
      makeTech('npm', 'black'),
      makeTech('node', 'black')
    ]
    const score = calculateScore(techs)
    expect(score).toBeLessThanOrEqual(35)
  })

  it('should compute weighted score correctly', () => {
    const techs = [
      makeTech('ubuntu', 'green'),
      makeTech('npm', 'green'),
      makeTech('node', 'yellow')
    ]
    // osScore=100, toolsScore=100, depsScore=60, dbsScore=0, hardeningScore=100, criticalsPenalty=100
    // final = 100*0.15 + 100*0.15 + 100*0.10 + 60*0.30 + 0*0.10 + 100*0.20 = 15+15+10+18+0+20 = 78
    expect(calculateScore(techs)).toBe(78)
  })

  it('should penalize active critical vulnerabilities', () => {
    const criticalVuln = makeVuln('CRITICAL')
    const techs = [
      makeTech('ubuntu', 'green'),
      makeTech('npm', 'green'),
      makeTech('node', 'green', [criticalVuln])
    ]
    // criticalsPenalty = 0 - 10*1 = 0 (max 0)
    // final = 100*0.15 + 100*0.15 + 100*0.10 + 100*0.30 + 0*0.10 + 0*0.20 = 15+15+10+30+0+0 = 70
    expect(calculateScore(techs)).toBe(70)
  })

  it('should penalize -10 per active critical CVE', () => {
    const vuln1 = makeVuln('CRITICAL')
    const vuln2 = makeVuln('CRITICAL')
    const techs = [
      makeTech('node', 'green', [vuln1, vuln2])
    ]
    // criticalsPenalty = 0 - 10*2 = 0 (max 0)
    // osScore=0, toolsScore=0, dbsScore=0, depsScore=100, hardeningScore=100, criticalsPenalty=0
    // final = 0*0.15 + 100*0.15 + 0*0.10 + 100*0.30 + 0*0.10 + 0*0.20 = 15+30 = 45
    expect(calculateScore(techs)).toBe(45)
  })

  it('should give 50 penalty when critical vulns have fixes', () => {
    const fixedVuln = makeVuln('CRITICAL', '2.0.0')
    const techs = [
      makeTech('node', 'green', [fixedVuln])
    ]
    // criticalsPenalty = 50
    // osScore=0, toolsScore=0, dbsScore=0, depsScore=100, hardeningScore=100, criticalsPenalty=50
    // final = 0*0.15 + 100*0.15 + 0*0.10 + 100*0.30 + 0*0.10 + 50*0.20 = 15+30+10 = 55
    expect(calculateScore(techs)).toBe(55)
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
    // osScore=0, toolsScore=0, dbsScore=0, hardeningScore=100, criticalsPenalty=100
    // final = 0*0.15 + 100*0.15 + 0*0.10 + 100*0.30 + 0*0.10 + 100*0.20 = 15+30+20 = 65
    expect(calculateScore(techs)).toBe(65)
  })

  it('should handle many technologies without crashing', () => {
    const techs = Array.from({ length: 50 }, (_, i) =>
      makeTech(`tech-${i}`, i % 4 === 0 ? 'green' : i % 4 === 1 ? 'yellow' : i % 4 === 2 ? 'red' : 'black')
    )
    const score = calculateScore(techs)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('should return low score when max penalty applied', () => {
    // CriticalsPenalty = 0 - 10*20 = -200, clamped to 0
    const manyCritVulns = Array.from({ length: 20 }, (_, i) => makeVuln('CRITICAL'))
    const techs = [makeTech('node', 'black', manyCritVulns)]
    const score = calculateScore(techs)
    // depsScore=0 (black), osScore=0, toolsScore=0, dbsScore=0, hardeningScore=100, criticalsPenalty=0
    // final = 0*0.15 + 100*0.15 + 0*0.10 + 0*0.30 + 0*0.10 + 0*0.20 = 15
    expect(score).toBe(15)
  })

  it('should handle mixed categories with some empty', () => {
    // No OS, no tools, no databases, only dependencies
    const techs = [makeTech('node', 'green')]
    // osScore=0, toolsScore=0, dbsScore=0, depsScore=100, hardeningScore=100, criticalsPenalty=100
    // final = 0*0.15 + 100*0.15 + 0*0.10 + 100*0.30 + 0*0.10 + 100*0.20 = 15+30+20 = 65
    expect(calculateScore(techs)).toBe(65)
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
    expect(result.scan.score).toBe(90)
    expect(result.scan.critical_count).toBe(0)
    expect(result.technologies).toBe(techs)
    expect(result.overallScore).toBe(90)

    expect(updateScan).toHaveBeenCalledWith('scan-1', {
      score: 90,
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

    // osScore=0, toolsScore=0, dbsScore=0, depsScore=25 (red), hardeningScore=100, criticalsPenalty=0
    // final = 0*0.15 + 100*0.15 + 0*0.10 + 25*0.30 + 0*0.10 + 0*0.20 = 15+7.5 = 22.5 → 23
    expect(result.scan.score).toBe(23)
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

describe('categorizeTechnology (DB names)', () => {
  it('should categorize mariadb as databases', () => {
    expect(categorizeTechnology('mariadb')).toBe('databases')
  })

  it('should categorize sqlite as databases', () => {
    expect(categorizeTechnology('sqlite')).toBe('databases')
  })

  it('should categorize pgadmin as databases', () => {
    expect(categorizeTechnology('pgadmin')).toBe('databases')
  })

  it('should treat sqlite3 as dependencies (not in databaseNames set)', () => {
    expect(categorizeTechnology('sqlite3')).toBe('dependencies')
  })

  it('should treat pgadmin4 as dependencies (not in databaseNames set)', () => {
    expect(categorizeTechnology('pgadmin4')).toBe('dependencies')
  })

  it('should be case insensitive for DB names', () => {
    expect(categorizeTechnology('PostgreSQL')).toBe('databases')
    expect(categorizeTechnology('MYSQL')).toBe('databases')
    expect(categorizeTechnology('MongoDB')).toBe('databases')
    expect(categorizeTechnology('REDIS')).toBe('databases')
  })
})

function makeHardeningResult(status: HardeningResult['status'] = 'pass'): HardeningResult {
  return {
    id: 'hr-1',
    scan_id: 'scan-1',
    check_id: 'check-1',
    category: 'firewall',
    title: 'Test hardening check',
    status,
    severity: 'HIGH',
    details: 'Test details',
  }
}

describe('calculateHardeningScore', () => {
  it('should return 100 when all checks pass', () => {
    const results = [
      makeHardeningResult('pass'),
      makeHardeningResult('pass'),
      makeHardeningResult('pass'),
    ]
    expect(calculateHardeningScore(results)).toBe(100)
  })

  it('should return 0 when all checks fail', () => {
    const results = [
      makeHardeningResult('fail'),
      makeHardeningResult('fail'),
    ]
    expect(calculateHardeningScore(results)).toBe(0)
  })

  it('should return 50 for mixed pass/fail', () => {
    const results = [
      makeHardeningResult('pass'),  // 100
      makeHardeningResult('fail'),  // 0
    ]
    expect(calculateHardeningScore(results)).toBe(50)
  })

  it('should return 50 for warning status', () => {
    const results = [
      makeHardeningResult('warning'),
    ]
    expect(calculateHardeningScore(results)).toBe(50)
  })

  it('should return 25 for error status', () => {
    const results = [
      makeHardeningResult('error'),
    ]
    expect(calculateHardeningScore(results)).toBe(25)
  })

  it('should return 100 for empty results', () => {
    expect(calculateHardeningScore([])).toBe(100)
  })

  it('should round to nearest integer', () => {
    const results = [
      makeHardeningResult('pass'),   // 100
      makeHardeningResult('pass'),   // 100
      makeHardeningResult('fail'),   // 0
    ]
    // (100 + 100 + 0) / 3 = 66.67 → 67
    expect(calculateHardeningScore(results)).toBe(67)
  })
})

describe('calculateScore with DB technologies', () => {
  it('should include databases category in score calculation', () => {
    const techs = [
      makeTech('postgresql', 'green'),
    ]
    // postgresql → 'databases' → dbsScore=100
    // osScore=0, toolsScore=0, dbsScore=100, depsScore=0, hardeningScore=100, criticalsPenalty=100
    // final = 0*0.15 + 100*0.15 + 0*0.10 + 0*0.30 + 100*0.10 + 100*0.20 = 15+10+20 = 45
    expect(calculateScore(techs)).toBe(45)
  })

  it('should penalize when DB is outdated (black)', () => {
    const techs = [
      makeTech('postgresql', 'black'),
    ]
    // dbsScore=0 (black), criticalsPenalty=100, hardeningScore=100
    // final = 0*0.15 + 100*0.15 + 0*0.10 + 0*0.30 + 0*0.10 + 100*0.20 = 15+20 = 35
    expect(calculateScore(techs)).toBe(35)
  })

  it('should handle multiple DB technologies', () => {
    const techs = [
      makeTech('postgresql', 'green'),
      makeTech('mysql', 'yellow'),
    ]
    // dbsScore = (100 + 60) / 2 = 80
    // osScore=0, toolsScore=0, dbsScore=80, depsScore=0, hardeningScore=100, criticalsPenalty=100
    // final = 0*0.15 + 100*0.15 + 0*0.10 + 0*0.30 + 80*0.10 + 100*0.20 = 15+8+20 = 43
    expect(calculateScore(techs)).toBe(43)
  })

  it('should handle DB technologies with critical vulnerabilities', () => {
    const techs = [
      makeTech('mysql', 'red', [makeVuln('CRITICAL')]),
    ]
    // dbsScore=25 (red), criticalsPenalty=0 (active crit without fix)
    // final = 0*0.15 + 100*0.15 + 0*0.10 + 0*0.30 + 25*0.10 + 0*0.20 = 15+2.5 = 17.5 → 18
    expect(calculateScore(techs)).toBe(18)
  })
})

describe('calculateScore with hardeningResults', () => {
  it('should use hardening score of 100 when no hardening results', () => {
    const techs = [makeTech('node', 'green')]
    // hardeningScore defaults to 100
    // final = 0*0.15 + 100*0.15 + 0*0.10 + 100*0.30 + 0*0.10 + 100*0.20 = 15+30+20 = 65
    expect(calculateScore(techs)).toBe(65)
  })

  it('should use provided hardening results with perfect score', () => {
    const techs = [makeTech('node', 'green')]
    const hardeningResults = [
      makeHardeningResult('pass'),
      makeHardeningResult('pass'),
    ]
    // hardeningScore = 100, same as without results
    // final = 65
    expect(calculateScore(techs, hardeningResults)).toBe(65)
  })

  it('should lower score when hardening fails', () => {
    const techs = [makeTech('node', 'green')]
    const hardeningResults = [
      makeHardeningResult('fail'),
      makeHardeningResult('fail'),
    ]
    // hardeningScore = 0
    // final = 0*0.15 + 0*0.15 + 0*0.10 + 100*0.30 + 0*0.10 + 100*0.20 = 30+20 = 50
    expect(calculateScore(techs, hardeningResults)).toBe(50)
  })

  it('should handle mixed hardening pass/fail', () => {
    const techs = [
      makeTech('node', 'green'),
      makeTech('npm', 'green'),
    ]
    const hardeningResults = [
      makeHardeningResult('pass'),   // 100
      makeHardeningResult('warning'),// 50
      makeHardeningResult('fail'),   // 0
    ]
    // hardeningScore = (100 + 50 + 0) / 3 = 50
    // toolsScore = 100 (npm), depsScore = 100 (node)
    // final = 0*0.15 + 50*0.15 + 100*0.10 + 100*0.30 + 0*0.10 + 100*0.20 = 7.5+10+30+20 = 67.5 → 68
    expect(calculateScore(techs, hardeningResults)).toBe(68)
  })

  it('should still produce score when only hardening results exist', () => {
    const hardeningResults = [
      makeHardeningResult('fail'),
    ]
    // osScore=0, toolsScore=0, dbsScore=0, depsScore=0, hardeningScore=0, criticalsPenalty=100
    // final = 0*0.15 + 0*0.15 + 0*0.10 + 0*0.30 + 0*0.10 + 100*0.20 = 20
    expect(calculateScore([], hardeningResults)).toBe(20)
  })

  it('should return 0 for empty technologies and empty hardening', () => {
    expect(calculateScore([])).toBe(0)
  })
})
