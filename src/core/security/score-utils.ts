/**
 * Manel Core — Score Utilities
 *
 * Pure utility functions for categorizing technologies and
 * converting statuses to numeric scores.
 *
 * @module core/security/score-utils
 */

import type { TechnologyStatus } from '../types'

// ============================================================================
// 1. Technology Categories
// ============================================================================

const osNames = new Set([
  'os', 'platform', 'ubuntu', 'debian', 'fedora', 'macos', 'windows',
  'arch', 'manjaro', 'centos', 'rhel', 'suse', 'linuxmint',
])

const toolNames = new Set([
  'npm', 'yarn', 'pnpm', 'git', 'docker', 'docker-compose', 'code', 'pip',
])

const dependencyNames = new Set([
  'node', 'python', 'python3', 'java', 'maven', 'gradle',
])

const databaseNames = new Set([
  'postgresql', 'mysql', 'mariadb', 'mongodb', 'redis', 'sqlite', 'pgadmin',
])

/**
 * Categorize a technology name into a scoring category.
 *
 * Categories determine the weight in the overall score:
 * - os: 15%
 * - hardening: 15%
 * - tools: 10%
 * - dependencies: 30%
 * - databases: 10%
 *
 * @param name - Technology name (case-insensitive)
 * @returns Category identifier
 */
export function categorizeTechnology(name: string): 'os' | 'tools' | 'dependencies' | 'databases' {
  const lower = name.toLowerCase().trim()
  if (osNames.has(lower)) return 'os'
  if (databaseNames.has(lower)) return 'databases'
  if (toolNames.has(lower)) return 'tools'
  if (dependencyNames.has(lower)) return 'dependencies'
  return 'dependencies'
}

// ============================================================================
// 2. Status-to-Score Conversions
// ============================================================================

/**
 * Convert a technology status to a numeric score.
 *
 * @param status - Technology health status
 * @returns Score (0-100)
 */
export function technologyStatusToScore(status: TechnologyStatus): number {
  switch (status) {
    case 'green': return 100
    case 'yellow': return 60
    case 'red': return 25
    case 'black': return 0
  }
}

/**
 * Convert a hardening check status to a numeric score.
 *
 * @param status - Hardening check status
 * @returns Score (0-100)
 */
export function hardeningStatusToScore(status: string): number {
  switch (status) {
    case 'pass': return 100
    case 'warning': return 50
    case 'fail': return 0
    case 'error': return 25
    default: return 50
  }
}
