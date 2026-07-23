/**
 * Manel CLI — Utils Tests
 *
 * Tests for shared utility functions (ecosystem mapping, severity checking).
 */

import { describe, it, expect } from 'vitest'
import { getEcosystemName, shouldFailOnSeverity, shouldFailOnSeverityVulns } from '../utils'
import type { OutputScanResult, OutputVulnerability } from '../output/types'

describe('getEcosystemName', () => {
  it('should map node to npm', () => {
    expect(getEcosystemName('node')).toBe('npm')
  })

  it('should map npm to npm', () => {
    expect(getEcosystemName('npm')).toBe('npm')
  })

  it('should map yarn to npm', () => {
    expect(getEcosystemName('yarn')).toBe('npm')
  })

  it('should map pnpm to npm', () => {
    expect(getEcosystemName('pnpm')).toBe('npm')
  })

  it('should map git to git', () => {
    expect(getEcosystemName('git')).toBe('git')
  })

  it('should map docker to docker', () => {
    expect(getEcosystemName('docker')).toBe('docker')
  })

  it('should map python to PyPI', () => {
    expect(getEcosystemName('python')).toBe('PyPI')
  })

  it('should map pip to PyPI', () => {
    expect(getEcosystemName('pip')).toBe('PyPI')
  })

  it('should map java to Maven', () => {
    expect(getEcosystemName('java')).toBe('Maven')
  })

  it('should map postgresql to PostgreSQL', () => {
    expect(getEcosystemName('postgresql')).toBe('PostgreSQL')
  })

  it('should map mysql to MySQL', () => {
    expect(getEcosystemName('mysql')).toBe('MySQL')
  })

  it('should map mariadb to MySQL', () => {
    expect(getEcosystemName('mariadb')).toBe('MySQL')
  })

  it('should map mongodb to MongoDB', () => {
    expect(getEcosystemName('mongodb')).toBe('MongoDB')
  })

  it('should map redis to Redis', () => {
    expect(getEcosystemName('redis')).toBe('Redis')
  })

  it('should map unknown technology to unknown', () => {
    expect(getEcosystemName('something-unknown')).toBe('unknown')
  })
})

describe('shouldFailOnSeverity', () => {
  function makeScanResult(vulns: Partial<OutputVulnerability>[], hardeningFails: number = 0): OutputScanResult {
    return {
      technologies: [],
      vulnerabilities: vulns.map(v => ({
        id: v.id ?? 'CVE-0000-0000',
        source: v.source ?? 'test',
        severity: v.severity ?? 'HIGH',
        title: v.title ?? 'Test vuln',
        description: v.description ?? 'Test',
        affectedPackage: v.affectedPackage ?? 'test',
        affectedVersions: v.affectedVersions ?? '1.0.0',
        fixedVersion: v.fixedVersion,
        references: [],
      })),
      hardening: [{
        checks: Array.from({ length: hardeningFails }, (_, i) => ({
          id: `check-${i}`,
          title: `Check ${i}`,
          status: 'fail' as const,
          severity: 'HIGH',
        })),
        summary: { pass: 0, fail: hardeningFails, warning: 0 },
      }],
      score: { overall: 50, breakdown: { os: 50, hardening: 50, tools: 50, dependencies: 50, databases: 50, criticalsPenalty: 0 } },
      summary: { totalTechnologies: 0, detectedTechnologies: 0, totalVulnerabilities: vulns.length, criticalVulnerabilities: 0, highVulnerabilities: 0, hardeningPassRate: 100 },
    }
  }

  it('should return true when CRITICAL vuln exists and threshold is CRITICAL', () => {
    const data = makeScanResult([{ severity: 'CRITICAL' }])
    expect(shouldFailOnSeverity(data, 'CRITICAL')).toBe(true)
  })

  it('should return true when CRITICAL vuln exists and threshold is HIGH', () => {
    const data = makeScanResult([{ severity: 'CRITICAL' }])
    expect(shouldFailOnSeverity(data, 'HIGH')).toBe(true)
  })

  it('should return false when only LOW vuln exists and threshold is HIGH', () => {
    const data = makeScanResult([{ severity: 'LOW' }])
    expect(shouldFailOnSeverity(data, 'HIGH')).toBe(false)
  })

  it('should return true when hardening check fails at threshold', () => {
    const data = makeScanResult([], 1)
    expect(shouldFailOnSeverity(data, 'HIGH')).toBe(true)
  })

  it('should return false for invalid severity', () => {
    const data = makeScanResult([{ severity: 'CRITICAL' }])
    expect(shouldFailOnSeverity(data, 'INVALID')).toBe(false)
  })

  it('should return false when no findings', () => {
    const data = makeScanResult([])
    expect(shouldFailOnSeverity(data, 'HIGH')).toBe(false)
  })
})

describe('shouldFailOnSeverityVulns', () => {
  it('should return true when vuln meets threshold', () => {
    const vulns: OutputVulnerability[] = [{
      id: 'CVE-0000-0001',
      source: 'test',
      severity: 'CRITICAL',
      title: 'Test',
      description: 'Test',
      affectedPackage: 'test',
      affectedVersions: '1.0.0',
      references: [],
    }]
    expect(shouldFailOnSeverityVulns(vulns, 'HIGH')).toBe(true)
  })

  it('should return false when vuln below threshold', () => {
    const vulns: OutputVulnerability[] = [{
      id: 'CVE-0000-0001',
      source: 'test',
      severity: 'LOW',
      title: 'Test',
      description: 'Test',
      affectedPackage: 'test',
      affectedVersions: '1.0.0',
      references: [],
    }]
    expect(shouldFailOnSeverityVulns(vulns, 'HIGH')).toBe(false)
  })

  it('should return false for empty array', () => {
    expect(shouldFailOnSeverityVulns([], 'HIGH')).toBe(false)
  })

  it('should handle case-insensitive severity', () => {
    const vulns: OutputVulnerability[] = [{
      id: 'CVE-0000-0001',
      source: 'test',
      severity: 'HIGH',
      title: 'Test',
      description: 'Test',
      affectedPackage: 'test',
      affectedVersions: '1.0.0',
      references: [],
    }]
    expect(shouldFailOnSeverityVulns(vulns, 'high')).toBe(true)
  })
})
