import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { TechnologyResult, Vulnerability, Software, Scan } from '../../shared/types'

// Mock IPC and electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  BrowserWindow: {
    fromWebContents: vi.fn(),
  },
}))

// Mock child_process for scanner detectors (importOriginal required for vitest CJS interop)
vi.mock('child_process', () => {
  const mockExecSync = vi.fn()
  return {
    default: { execSync: mockExecSync },
    execSync: mockExecSync,
  }
})

// Mock database
vi.mock('../database', () => ({
  createScan: vi.fn(),
  updateScan: vi.fn(),
  saveSoftware: vi.fn(),
  getSoftwareByScanId: vi.fn(),
  saveVulnerabilities: vi.fn(),
  getVulnerabilitiesForSoftware: vi.fn(),
  getLatestScan: vi.fn(),
  getAllSoftware: vi.fn(),
}))

// Mock update-engine
vi.mock('../update-engine', () => ({
  getLatestVersion: vi.fn(),
}))

import { execSync } from 'child_process'
const mockExecSync = execSync as ReturnType<typeof vi.fn>

import { createScan, saveSoftware, saveVulnerabilities } from '../database'
const mockCreateScan = createScan as ReturnType<typeof vi.fn>
const mockSaveSoftware = saveSoftware as ReturnType<typeof vi.fn>
const mockSaveVulnerabilities = saveVulnerabilities as ReturnType<typeof vi.fn>

import { getLatestVersion } from '../update-engine'
const mockGetLatestVersion = getLatestVersion as ReturnType<typeof vi.fn>

// Import the functions to test
import { calculateScore, calculateHardeningScore, getTrafficLight, countBySeverity } from '../security/score-engine'
import { categorizeTechnology, hardeningStatusToScore } from '../security/score-utils'
import { detectOS, detectNode, detectNpm, detectPostgreSQL, detectMySQL, detectMongoDB, detectRedis } from '../scanner/detectors'
import { runHardeningChecks } from '../security/hardening'

function createMockVuln(severity: Vulnerability['severity'], cve: string, fixed?: string): Vulnerability {
  return {
    id: `vuln-${cve}`,
    cve,
    severity,
    description: `Test ${severity} vulnerability`,
    software_id: 'sw-1',
    fixed_version: fixed ?? '',
    source: 'test',
  }
}

describe('Scan Flow Integration', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    // Setup default mocks
    mockCreateScan.mockReturnValue({
      id: 'test-scan-id',
      date: Math.floor(Date.now() / 1000),
      score: null,
      critical_count: 0,
      high_count: 0,
      medium_count: 0,
      low_count: 0,
      status: 'pending',
    } as Scan)

    mockSaveSoftware.mockImplementation(
      (items: Omit<Software, 'id'>[]) => items.map((item, i) => ({ ...item, id: `sw-${i}` }))
    )

    mockSaveVulnerabilities.mockImplementation(
      (vulns: Omit<Vulnerability, 'id'>[]) => vulns.map((v, i) => ({ ...v, id: `v-${i}` }))
    )

    mockGetLatestVersion.mockResolvedValue('22.0.0')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Scanner → Security Engine → Score Engine pipeline', () => {
    it('should detect technologies and then analyze their vulnerabilities', async () => {
      // Step 1: Scanner detects technologies
      mockExecSync
        .mockReturnValueOnce('v22.0.0\n')   // node
        .mockReturnValueOnce('10.9.0\n')     // npm

      const nodeResult = detectNode()
      const npmResult = detectNpm()

      expect(nodeResult).not.toBeNull()
      expect(npmResult).not.toBeNull()
      expect(nodeResult!.version).toBe('22.0.0')
      expect(npmResult!.version).toBe('10.9.0')

      // Step 2: Simulate creating a scan and saving detected software
      const scan = mockCreateScan()
      const softwareList = [
        { ...nodeResult!, scan_id: scan.id, detected_at: Math.floor(Date.now() / 1000), id: 'sw-node' },
        { ...npmResult!, scan_id: scan.id, detected_at: Math.floor(Date.now() / 1000), id: 'sw-npm' },
      ]
      mockSaveSoftware.mockReturnValueOnce(softwareList)

      const savedSoftware = mockSaveSoftware(softwareList.map(({ id, ...rest }) => rest))
      expect(savedSoftware).toHaveLength(2)

      // Step 3: Check categorization
      expect(categorizeTechnology('node')).toBe('dependencies')
      expect(categorizeTechnology('npm')).toBe('tools')

      // Step 4: Calculate score for detected technologies
      const techResults: TechnologyResult[] = [
        {
          name: 'node',
          installedVersion: '22.0.0',
          latestVersion: '22.0.0',
          status: 'green',
          vulnerabilities: [],
          recommendation: 'Up to date',
        },
        {
          name: 'npm',
          installedVersion: '10.9.0',
          latestVersion: '10.9.0',
          status: 'green',
          vulnerabilities: [],
          recommendation: 'Up to date',
        },
      ]

      const score = calculateScore(techResults)
      expect(score).toBeGreaterThanOrEqual(60)
      expect(getTrafficLight(score)).toBe('yellow')

      // Step 5: Score breakdown
      const counts = countBySeverity(techResults)
      expect(counts.critical).toBe(0)
      expect(counts.high).toBe(0)
    })

    it('should handle end-to-end with vulnerabilities found', async () => {
      // Step 1: Detect technologies
      mockExecSync
        .mockReturnValueOnce('v18.0.0\n')   // node (outdated)
        .mockReturnValueOnce('6.14.0\n')     // npm (outdated)

      const nodeResult = detectNode()
      const npmResult = detectNpm()

      expect(nodeResult).not.toBeNull()
      expect(nodeResult!.version).toBe('18.0.0')

      // Step 2: Create mock vulnerabilities for node
      const criticalVuln = createMockVuln('CRITICAL', 'CVE-2024-CRIT', '18.1.0')
      const highVuln = createMockVuln('HIGH', 'CVE-2024-HIGH')

      const nodeTechResult: TechnologyResult = {
        name: 'node',
        installedVersion: '18.0.0',
        latestVersion: '22.0.0',
        status: 'red',
        vulnerabilities: [criticalVuln, highVuln],
        recommendation: 'Update to 22.0.0',
      }

      const npmTechResult: TechnologyResult = {
        name: 'npm',
        installedVersion: '6.14.0',
        latestVersion: '10.9.0',
        status: 'red',
        vulnerabilities: [],
        recommendation: 'Update to 10.9.0',
      }

      // Step 3: Calculate score with vulnerabilities
      const techResults = [nodeTechResult, npmTechResult]
      const score = calculateScore(techResults)
      expect(score).toBeLessThan(80)
      expect(getTrafficLight(score)).not.toBe('green')

      // Step 4: Verify counts
      const counts = countBySeverity(techResults)
      expect(counts.critical).toBe(1)
      expect(counts.high).toBe(1)
      expect(counts.medium).toBe(0)
    })

    it('should handle scenario where no technologies are detected', async () => {
      mockExecSync.mockImplementation(() => { throw new Error('not found') })

      const nodeResult = detectNode()
      const npmResult = detectNpm()

      expect(nodeResult).toBeNull()
      expect(npmResult).toBeNull()

      // No techs → score 0
      const score = calculateScore([])
      expect(score).toBe(0)
      expect(getTrafficLight(score)).toBe('black')
    })

    it('should detect OS and categorize it', async () => {
      const originalPlatform = process.platform

      Object.defineProperty(process, 'platform', { value: 'linux' })

      const osInfo = detectOS()
      expect(osInfo.platform).toBe('linux')
      expect(typeof osInfo.release).toBe('string')

      // OS should be categorizable
      expect(categorizeTechnology('ubuntu')).toBe('os')
      expect(categorizeTechnology('macos')).toBe('os')

      Object.defineProperty(process, 'platform', { value: originalPlatform })
    })
  })

  describe('Score calculation with real scan data patterns', () => {
    it('should compute score with many critical vulns', () => {
      const manyCritVulns = Array.from({ length: 10 }, (_, i) => createMockVuln('CRITICAL', `CVE-2024-${i}`))
      const techs: TechnologyResult[] = [
        {
          name: 'node',
          installedVersion: '16.0.0',
          latestVersion: '22.0.0',
          status: 'red',
          vulnerabilities: manyCritVulns,
          recommendation: 'Urgent update needed',
        },
      ]

      const score = calculateScore(techs)
      // With 10 active critical vulns: criticalsPenalty = 0 - 10*10 = -100 → max(0, -100) = 0
      // depsScore = 25 (red), osScore=0, toolsScore=0, dbsScore=0, hardeningScore=100, criticalsPenalty=0
      // final = 0*0.15 + 100*0.15 + 0*0.10 + 25*0.30 + 0*0.10 + 0*0.20 = 15+7.5 = 22.5 → 23
      expect(score).toBe(23)
    })

    it('should give green light for clean, up-to-date stack', () => {
      const cleanTechs: TechnologyResult[] = [
        {
          name: 'ubuntu', installedVersion: '24.04', latestVersion: '24.04',
          status: 'green', vulnerabilities: [], recommendation: '',
        },
        {
          name: 'node', installedVersion: '22.0.0', latestVersion: '22.0.0',
          status: 'green', vulnerabilities: [], recommendation: '',
        },
        {
          name: 'npm', installedVersion: '10.9.0', latestVersion: '10.9.0',
          status: 'green', vulnerabilities: [], recommendation: '',
        },
        {
          name: 'git', installedVersion: '2.47.0', latestVersion: '2.47.0',
          status: 'green', vulnerabilities: [], recommendation: '',
        },
      ]

      const score = calculateScore(cleanTechs)
      // os=100 (ubuntu), tools=100 (npm, git), deps=100 (node), dbs=0, hardening=100, criticals=100
      // final = 100*0.15 + 100*0.15 + 100*0.10 + 100*0.30 + 0*0.10 + 100*0.20 = 15+15+10+30+20 = 90
      expect(score).toBe(90)
      expect(getTrafficLight(score)).toBe('green')
    })

    it('should handle mixed severity levels', () => {
      const techs: TechnologyResult[] = [
        {
          name: 'node', installedVersion: '18.0.0', latestVersion: '22.0.0',
          status: 'red',
          vulnerabilities: [
            createMockVuln('CRITICAL', 'CVE-CRIT'),
            createMockVuln('HIGH', 'CVE-HIGH-1'),
            createMockVuln('HIGH', 'CVE-HIGH-2'),
          ],
          recommendation: '',
        },
        {
          name: 'npm', installedVersion: '8.0.0', latestVersion: '10.0.0',
          status: 'yellow',
          vulnerabilities: [createMockVuln('MEDIUM', 'CVE-MED')],
          recommendation: '',
        },
        {
          name: 'git', installedVersion: '2.47.0', latestVersion: '2.47.0',
          status: 'green', vulnerabilities: [], recommendation: '',
        },
        {
          name: 'docker', installedVersion: '26.0.0', latestVersion: '26.0.0',
          status: 'green', vulnerabilities: [], recommendation: '',
        },
      ]

      const score = calculateScore(techs)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)

      const counts = countBySeverity(techs)
      expect(counts.critical).toBe(1)
      expect(counts.high).toBe(2)
      expect(counts.medium).toBe(1)
      expect(counts.low).toBe(0)
    })
  })

  describe('DB detectors integration', () => {
    beforeEach(() => {
      vi.resetAllMocks()
      mockCreateScan.mockReturnValue({
        id: 'test-scan-id',
        date: Math.floor(Date.now() / 1000),
        score: null,
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        status: 'pending',
      } as Scan)
      mockSaveSoftware.mockImplementation(
        (items: Omit<Software, 'id'>[]) => items.map((item, i) => ({ ...item, id: `sw-${i}` }))
      )
      mockGetLatestVersion.mockResolvedValue('16.2')
    })

    it('should detect PostgreSQL', () => {
      mockExecSync.mockReturnValue('psql (PostgreSQL 16.2)\n')
      const result = detectPostgreSQL()
      expect(result).not.toBeNull()
      expect(result!.name).toBe('postgresql')
      expect(result!.version).toBe('16.2')
      expect(categorizeTechnology('postgresql')).toBe('databases')
    })

    it('should detect MySQL', () => {
      mockExecSync.mockReturnValue('mysql  Ver 8.0.36 for Linux on x86_64\n')
      const result = detectMySQL()
      expect(result).not.toBeNull()
      expect(result!.name).toBe('mysql')
      expect(result!.version).toBe('8.0.36')
      expect(categorizeTechnology('mysql')).toBe('databases')
    })

    it('should detect MongoDB', () => {
      mockExecSync.mockReturnValue('db version v7.3.1\n')
      const result = detectMongoDB()
      expect(result).not.toBeNull()
      expect(result!.name).toBe('mongodb')
      expect(result!.version).toBe('7.3.1')
      expect(categorizeTechnology('mongodb')).toBe('databases')
    })

    it('should detect Redis', () => {
      mockExecSync.mockReturnValue('redis-cli 7.2.5\n')
      const result = detectRedis()
      expect(result).not.toBeNull()
      expect(result!.name).toBe('redis')
      expect(result!.version).toBe('7.2.5')
      expect(categorizeTechnology('redis')).toBe('databases')
    })

    it('should handle missing DB dependencies gracefully', () => {
      mockExecSync.mockImplementation(() => { throw new Error('not found') })
      expect(detectPostgreSQL()).toBeNull()
      expect(detectMySQL()).toBeNull()
      expect(detectMongoDB()).toBeNull()
      expect(detectRedis()).toBeNull()
    })

    it('should calculate score including DB technologies', () => {
      const techs: TechnologyResult[] = [
        {
          name: 'postgresql', installedVersion: '16.2', latestVersion: '16.2',
          status: 'green', vulnerabilities: [], recommendation: '',
        },
        {
          name: 'node', installedVersion: '22.0.0', latestVersion: '22.0.0',
          status: 'green', vulnerabilities: [], recommendation: '',
        },
      ]

      const score = calculateScore(techs)
      // postgresql → 'databases' → dbsScore=100
      // node → 'dependencies' → depsScore=100
      // final = 0*0.15 + 100*0.15 + 0*0.10 + 100*0.30 + 100*0.10 + 100*0.20 = 15+30+10+20 = 75
      expect(score).toBe(75)
      expect(getTrafficLight(score)).toBe('yellow')
    })

    it('should penalize outdated DB technologies with critical vulns', () => {
      const techs: TechnologyResult[] = [
        {
          name: 'mysql', installedVersion: '5.7.0', latestVersion: '8.0.36',
          status: 'red',
          vulnerabilities: [createMockVuln('CRITICAL', 'CVE-DB-001')],
          recommendation: 'Update MySQL',
        },
      ]

      const score = calculateScore(techs)
      // dbsScore=25 (red), criticalsPenalty=0, hardeningScore=100
      // final = 0*0.15 + 100*0.15 + 0*0.10 + 0*0.30 + 25*0.10 + 0*0.20 = 15+2.5 = 17.5 → 18
      expect(score).toBe(18)
      expect(getTrafficLight(score)).toBe('black')
    })
  })

  describe('Hardening checks integration', () => {
    const originalPlatform = process.platform

    beforeEach(() => {
      vi.resetAllMocks()
      Object.defineProperty(process, 'platform', { value: 'linux' })
      mockCreateScan.mockReturnValue({
        id: 'test-scan-id',
        date: Math.floor(Date.now() / 1000),
        score: null,
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        status: 'pending',
      } as Scan)
    })

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform })
    })

    it('should run hardening checks and score them', async () => {
      // Mock all hardening checks to pass
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd === 'ufw status') return 'Status: active'
        if (cmd === 'getenforce') return 'Enforcing'
        if (cmd.includes('permitrootlogin')) return 'PermitRootLogin no'
        if (cmd.includes('passwordauthentication')) return 'PasswordAuthentication no'
        if (cmd === 'ss -tlnp') return 'LISTEN 0 128 0.0.0.0:22 0.0.0.0:*'
        if (cmd.includes('apt') && cmd.includes('upgradable')) return ''
        if (cmd.includes('suid_dumpable')) return 'fs.suid_dumpable = 0'
        return null
      })

      const results = await runHardeningChecks()
      expect(results).toHaveLength(7)
      expect(results.every(r => r.status === 'pass')).toBe(true)

      // Calculate hardening score
      const hScore = calculateHardeningScore(results)
      expect(hScore).toBe(100)
    })

    it('should calculate overall score with hardening results', async () => {
      const techs: TechnologyResult[] = [
        {
          name: 'node', installedVersion: '22.0.0', latestVersion: '22.0.0',
          status: 'green', vulnerabilities: [], recommendation: '',
        },
      ]

      // Hardening: some pass, some fail
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd === 'ufw status') return 'Status: active'
        if (cmd === 'getenforce') return 'Enforcing'
        if (cmd.includes('permitrootlogin')) return 'PermitRootLogin yes' // fail
        if (cmd.includes('passwordauthentication')) return 'PasswordAuthentication no'
        if (cmd === 'ss -tlnp') return 'LISTEN 0 128 0.0.0.0:9999 0.0.0.0:*'  // fail (unknown port)
        if (cmd.includes('apt') && cmd.includes('upgradable')) return ''
        if (cmd.includes('suid_dumpable')) return 'fs.suid_dumpable = 1'  // fail
        return null
      })

      const hardeningResults = await runHardeningChecks()
      const hScore = calculateHardeningScore(hardeningResults)
      // Expected: passes (firewall, selinux, ssh-password, updates) = 4 × 100 = 400
      // fails (ssh-root, ports, coredumps) = 3 × 0 = 0
      // total = 400 / 7 = 57.14 → 57
      expect(hScore).toBe(57)

      const score = calculateScore(techs, hardeningResults)
      // osScore=0, hardeningScore=57, toolsScore=0, depsScore=100, dbsScore=0, criticalsPenalty=100
      // final = 0*0.15 + 57*0.15 + 0*0.10 + 100*0.30 + 0*0.10 + 100*0.20 = 8.55+30+20 = 58.55 → 59
      expect(score).toBe(59)
    })

    it('should return empty hardening on non-linux platforms', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' })

      const results = await runHardeningChecks()
      expect(results).toEqual([])

      // Score with empty hardening should default to 100
      const techs: TechnologyResult[] = [
        {
          name: 'node', installedVersion: '22.0.0', latestVersion: '22.0.0',
          status: 'green', vulnerabilities: [], recommendation: '',
        },
      ]
      const score = calculateScore(techs, [])
      // Empty hardening results → hardeningScore = 100
      // final = 65
      expect(score).toBe(65)
    })

    it('should handle hardening check failures gracefully in score', async () => {
      // All hardening checks fail to execute
      mockExecSync.mockImplementation(() => { throw new Error('not found') })

      const results = await runHardeningChecks()
      expect(results).toHaveLength(7)
      // Each check should still return gracefully via safeExec
      results.forEach(r => {
        expect(['pass', 'fail', 'warning', 'error']).toContain(r.status)
      })

      const score = calculateHardeningScore(results)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })
  })
})
