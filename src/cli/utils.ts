/**
 * Manel CLI — Shared Utilities
 *
 * Common utility functions used across multiple commands.
 * Eliminates code duplication between scan, status, and vulnerabilities.
 *
 * @module cli/utils
 */

import type { OutputScanResult, OutputVulnerability } from './output/types'

// ============================================================================
// 1. Ecosystem Mapping
// ============================================================================

/** Map of technology names to their ecosystem identifiers. */
const ECOSYSTEM_MAP: Record<string, string> = {
  node: 'npm',
  npm: 'npm',
  yarn: 'npm',
  pnpm: 'npm',
  git: 'git',
  docker: 'docker',
  'docker-compose': 'docker',
  python: 'PyPI',
  python3: 'PyPI',
  pip: 'PyPI',
  java: 'Maven',
  maven: 'Maven',
  gradle: 'Maven',
  code: 'VSCode',
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  mariadb: 'MySQL',
  mongodb: 'MongoDB',
  redis: 'Redis',
  sqlite3: 'SQLite',
  pgadmin4: 'PostgreSQL',
}

/**
 * Get the ecosystem name for a technology.
 *
 * @param name - Technology name (e.g., 'node', 'python')
 * @returns Ecosystem identifier (e.g., 'npm', 'PyPI')
 */
export function getEcosystemName(name: string): string {
  return ECOSYSTEM_MAP[name] ?? 'unknown'
}

// ============================================================================
// 2. Severity Utilities
// ============================================================================

/** Ordered severity levels from most to least critical. */
const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

/**
 * Check if findings should trigger failure based on severity threshold.
 *
 * @param data - Scan result data with vulnerabilities and hardening checks
 * @param failOnSeverity - Severity threshold (e.g., 'HIGH')
 * @returns True if any finding meets or exceeds the threshold
 */
export function shouldFailOnSeverity(data: OutputScanResult, failOnSeverity: string): boolean {
  const thresholdIndex = SEVERITY_ORDER.indexOf(failOnSeverity.toUpperCase())
  if (thresholdIndex === -1) return false

  // Check vulnerabilities
  const hasVuln = data.vulnerabilities.some(v => {
    const vulnIndex = SEVERITY_ORDER.indexOf(v.severity)
    return vulnIndex !== -1 && vulnIndex <= thresholdIndex
  })

  if (hasVuln) return true

  // Check hardening failures
  return data.hardening.some(h =>
    h.checks.some(c => {
      if (c.status === 'pass') return false
      const checkIndex = SEVERITY_ORDER.indexOf(c.severity)
      return checkIndex !== -1 && checkIndex <= thresholdIndex
    })
  )
}

/**
 * Check if a list of vulnerabilities should trigger failure based on severity threshold.
 *
 * @param vulnerabilities - List of vulnerabilities
 * @param failOnSeverity - Severity threshold (e.g., 'HIGH')
 * @returns True if any vulnerability meets or exceeds the threshold
 */
export function shouldFailOnSeverityVulns(
  vulnerabilities: OutputVulnerability[],
  failOnSeverity: string
): boolean {
  const thresholdIndex = SEVERITY_ORDER.indexOf(failOnSeverity.toUpperCase())
  if (thresholdIndex === -1) return false

  return vulnerabilities.some(v => {
    const vulnIndex = SEVERITY_ORDER.indexOf(v.severity)
    return vulnIndex !== -1 && vulnIndex <= thresholdIndex
  })
}
