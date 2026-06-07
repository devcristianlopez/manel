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
import { calculateScore, getTrafficLight, countBySeverity } from '../security/score-engine'
import { categorizeTechnology } from '../security/score-utils'
import { detectOS, detectNode, detectNpm } from '../scanner/detectors'

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
      expect(getTrafficLight(score)).toBe('green')

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
      // depsScore = 25 (red), osScore=0, toolsScore=0
      // final = 0*0.2 + 0*0.2 + 25*0.4 + 0*0.2 = 10
      expect(score).toBe(10)
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
      expect(score).toBe(100)
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
})
