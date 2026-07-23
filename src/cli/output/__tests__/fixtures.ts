/**
 * Shared test fixtures for output formatter tests.
 *
 * Provides reusable mock data that matches the output engine types.
 *
 * @module cli/output/__tests__/fixtures
 */

import type {
  OutputScanResult,
  OutputTechnology,
  OutputVulnerability,
  OutputHardeningResult,
  OutputSecurityScore,
  OutputScanSummary,
} from '../types'
import type { UpdateInfo } from '@shared/types'

// ============================================================================
// 1. Technology Fixtures
// ============================================================================

export function makeTechnology(overrides: Partial<OutputTechnology> = {}): OutputTechnology {
  return {
    name: 'node',
    version: '18.0.0',
    detected: true,
    ecosystem: 'npm',
    latestVersion: '20.0.0',
    updateAvailable: true,
    ...overrides,
  }
}

export const TECHNOLOGIES: OutputTechnology[] = [
  makeTechnology({ name: 'node', version: '18.0.0', ecosystem: 'npm', updateAvailable: true }),
  makeTechnology({ name: 'python', version: '3.11.0', ecosystem: 'PyPI', updateAvailable: false }),
  makeTechnology({ name: 'postgresql', version: '15.0', ecosystem: 'unknown', detected: true }),
  makeTechnology({ name: 'rust', version: null, detected: false, ecosystem: 'unknown' }),
]

// ============================================================================
// 2. Vulnerability Fixtures
// ============================================================================

export function makeVulnerability(overrides: Partial<OutputVulnerability> = {}): OutputVulnerability {
  return {
    id: 'GHSA-1234-abcd',
    source: 'GHSA',
    severity: 'HIGH',
    title: 'Test Vulnerability',
    description: 'A test vulnerability for unit testing',
    affectedPackage: 'test-package',
    affectedVersions: '<2.0.0',
    fixedVersion: '2.0.0',
    cvssScore: 7.5,
    cveId: 'CVE-2024-12345',
    references: ['https://example.com/advisory'],
    ...overrides,
  }
}

export const VULNERABILITIES: OutputVulnerability[] = [
  makeVulnerability({
    id: 'CVE-2024-0001',
    severity: 'CRITICAL',
    title: 'Remote Code Execution',
    affectedPackage: 'lodash',
    cveId: 'CVE-2024-0001',
    cvssScore: 9.8,
  }),
  makeVulnerability({
    id: 'CVE-2024-0002',
    severity: 'HIGH',
    title: 'SQL Injection',
    affectedPackage: 'express',
    cveId: 'CVE-2024-0002',
    cvssScore: 8.1,
    fixedVersion: undefined,
  }),
  makeVulnerability({
    id: 'CVE-2024-0003',
    severity: 'MEDIUM',
    title: 'XSS Vulnerability',
    affectedPackage: 'react',
    cveId: 'CVE-2024-0003',
    cvssScore: 5.4,
    fixedVersion: '18.2.1',
  }),
  makeVulnerability({
    id: 'CVE-2024-0004',
    severity: 'LOW',
    title: 'Information Disclosure',
    affectedPackage: 'axios',
    cveId: 'CVE-2024-0004',
    cvssScore: 3.1,
  }),
]

// ============================================================================
// 3. Hardening Fixtures
// ============================================================================

export function makeHardeningResult(overrides: Partial<OutputHardeningResult> = {}): OutputHardeningResult {
  return {
    checks: [
      { id: 'firewall-active', title: 'Firewall is active', status: 'pass', severity: 'HIGH' },
      { id: 'ssh-root-login', title: 'SSH root login disabled', status: 'fail', severity: 'CRITICAL', description: 'Root login is enabled' },
      { id: 'auto-updates', title: 'Automatic updates enabled', status: 'warning', severity: 'MEDIUM', description: 'Auto-updates partially configured' },
    ],
    summary: { pass: 1, fail: 1, warning: 1 },
    ...overrides,
  }
}

export const HARDENING_RESULTS: OutputHardeningResult[] = [
  makeHardeningResult(),
]

// ============================================================================
// 4. Score Fixtures
// ============================================================================

export function makeScore(overrides: Partial<OutputSecurityScore> = {}): OutputSecurityScore {
  return {
    overall: 72,
    breakdown: {
      os: 80,
      hardening: 60,
      tools: 90,
      dependencies: 65,
      databases: 85,
      criticalsPenalty: 50,
    },
    ...overrides,
  }
}

export const SCORE: OutputSecurityScore = makeScore()

// ============================================================================
// 5. Summary Fixtures
// ============================================================================

export function makeSummary(overrides: Partial<OutputScanSummary> = {}): OutputScanSummary {
  return {
    totalTechnologies: 4,
    detectedTechnologies: 3,
    totalVulnerabilities: 4,
    criticalVulnerabilities: 1,
    highVulnerabilities: 1,
    hardeningPassRate: 33,
    ...overrides,
  }
}

export const SUMMARY: OutputScanSummary = makeSummary()

// ============================================================================
// 6. Complete ScanResult Fixture
// ============================================================================

export function makeScanResult(overrides: Partial<OutputScanResult> = {}): OutputScanResult {
  return {
    technologies: TECHNOLOGIES,
    vulnerabilities: VULNERABILITIES,
    hardening: HARDENING_RESULTS,
    score: SCORE,
    summary: SUMMARY,
    ...overrides,
  }
}

export const SCAN_RESULT: OutputScanResult = makeScanResult()

// ============================================================================
// 7. UpdateInfo Fixtures
// ============================================================================

export function makeUpdateInfo(overrides: Partial<UpdateInfo> = {}): UpdateInfo {
  return {
    technology: 'node',
    currentVersion: '18.0.0',
    latestVersion: '20.0.0',
    updateAvailable: true,
    source: 'nodejs.org',
    releaseDate: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export const UPDATE_INFOS: UpdateInfo[] = [
  makeUpdateInfo({ technology: 'node', currentVersion: '18.0.0', latestVersion: '20.0.0', updateAvailable: true }),
  makeUpdateInfo({ technology: 'python', currentVersion: '3.11.0', latestVersion: '3.11.0', updateAvailable: false }),
  makeUpdateInfo({ technology: 'postgresql', currentVersion: '15.0', latestVersion: '16.0', updateAvailable: true, source: 'postgresql.org' }),
]
