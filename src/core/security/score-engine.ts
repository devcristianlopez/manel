/**
 * Manel Core — Score Engine
 *
 * Calculates weighted security scores from technology results
 * and hardening check results. Pure calculation logic with no
 * database persistence.
 *
 * @module core/security/score-engine
 */

import type { CoreTechnologyResult, CoreHardeningCheck, TechnologyStatus, ScoreBreakdown } from '../types'
import { categorizeTechnology, technologyStatusToScore, hardeningStatusToScore } from './score-utils'

// ============================================================================
// 1. Category Score Calculation
// ============================================================================

/**
 * Calculate the average score for technologies in a specific category.
 *
 * @param technologies - All technology results
 * @param category - Category to filter by
 * @returns Average score (0-100), or 0 if no technologies in category
 */
function calculateCategoryScore(
  technologies: CoreTechnologyResult[],
  category: 'os' | 'tools' | 'dependencies' | 'databases'
): number {
  const filtered = technologies.filter(t => categorizeTechnology(t.name) === category)
  if (filtered.length === 0) return 0

  const total = filtered.reduce((sum, t) => sum + technologyStatusToScore(t.status), 0)
  return Math.round(total / filtered.length)
}

/**
 * Calculate penalty score based on critical vulnerabilities.
 *
 * - No critical vulns: 100
 * - All critical vulns have fixes: 50
 * - Active critical vulns: 0 - (10 * count), clamped to 0
 *
 * @param technologies - All technology results
 * @returns Penalty score (0-100)
 */
function calculateCriticalsPenalty(technologies: CoreTechnologyResult[]): number {
  const criticalVulns = technologies.flatMap(t =>
    t.vulnerabilities.filter(v => v.severity === 'CRITICAL')
  )

  if (criticalVulns.length === 0) return 100

  const activeCriticalVulns = criticalVulns.filter(v => !v.fixedVersion)

  if (activeCriticalVulns.length === 0) return 50

  return Math.max(0, 0 - 10 * activeCriticalVulns.length)
}

// ============================================================================
// 2. Hardening Score
// ============================================================================

/**
 * Calculate average hardening score from check results.
 *
 * @param checks - Hardening check results
 * @returns Average score (0-100), defaults to 100 for empty results
 */
export function calculateHardeningScore(checks: CoreHardeningCheck[]): number {
  if (checks.length === 0) return 100
  const total = checks.reduce((sum, r) => sum + hardeningStatusToScore(r.status), 0)
  return Math.round(total / checks.length)
}

// ============================================================================
// 3. Overall Score
// ============================================================================

/**
 * Calculate the overall weighted security score.
 *
 * Weights:
 * - OS: 15%
 * - Hardening: 15%
 * - Tools: 10%
 * - Dependencies: 30%
 * - Databases: 10%
 * - Criticals Penalty: 20%
 *
 * @param technologies - Technology analysis results
 * @param hardeningChecks - Hardening check results (optional)
 * @returns Score (0-100)
 */
export function calculateScore(
  technologies: CoreTechnologyResult[],
  hardeningChecks?: CoreHardeningCheck[]
): number {
  if (technologies.length === 0 && (!hardeningChecks || hardeningChecks.length === 0)) return 0

  const osScore = calculateCategoryScore(technologies, 'os')
  const toolsScore = calculateCategoryScore(technologies, 'tools')
  const depsScore = calculateCategoryScore(technologies, 'dependencies')
  const dbsScore = calculateCategoryScore(technologies, 'databases')
  const criticalsPenalty = calculateCriticalsPenalty(technologies)
  const hardeningScore = hardeningChecks ? calculateHardeningScore(hardeningChecks) : 100

  const finalScore =
    osScore * 0.15 +
    hardeningScore * 0.15 +
    toolsScore * 0.10 +
    depsScore * 0.30 +
    dbsScore * 0.10 +
    criticalsPenalty * 0.20

  return Math.round(Math.max(0, Math.min(100, finalScore)))
}

/**
 * Calculate the full score breakdown with per-category details.
 *
 * @param technologies - Technology analysis results
 * @param hardeningChecks - Hardening check results (optional)
 * @returns Complete score breakdown
 */
export function calculateScoreBreakdown(
  technologies: CoreTechnologyResult[],
  hardeningChecks?: CoreHardeningCheck[]
): ScoreBreakdown {
  const os = calculateCategoryScore(technologies, 'os')
  const tools = calculateCategoryScore(technologies, 'tools')
  const dependencies = calculateCategoryScore(technologies, 'dependencies')
  const databases = calculateCategoryScore(technologies, 'databases')
  const criticalsPenalty = calculateCriticalsPenalty(technologies)
  const hardening = hardeningChecks ? calculateHardeningScore(hardeningChecks) : 100

  const overall = Math.round(Math.max(0, Math.min(100,
    os * 0.15 +
    hardening * 0.15 +
    tools * 0.10 +
    dependencies * 0.30 +
    databases * 0.10 +
    criticalsPenalty * 0.20
  )))

  return {
    overall,
    breakdown: { os, hardening, tools, dependencies, databases, criticalsPenalty },
  }
}

// ============================================================================
// 4. Traffic Light
// ============================================================================

/**
 * Convert a numeric score to a traffic light status.
 *
 * @param score - Score (0-100)
 * @returns Traffic light status
 */
export function getTrafficLight(score: number): TechnologyStatus {
  if (score >= 80) return 'green'
  if (score >= 60) return 'yellow'
  if (score >= 40) return 'red'
  return 'black'
}

// ============================================================================
// 5. Severity Counts
// ============================================================================

/**
 * Count vulnerabilities by severity across all technologies.
 *
 * @param technologies - Technology analysis results
 * @returns Count by severity level
 */
export function countBySeverity(technologies: CoreTechnologyResult[]): {
  critical: number
  high: number
  medium: number
  low: number
} {
  const allVulns = technologies.flatMap(t => t.vulnerabilities)

  return {
    critical: allVulns.filter(v => v.severity === 'CRITICAL').length,
    high: allVulns.filter(v => v.severity === 'HIGH').length,
    medium: allVulns.filter(v => v.severity === 'MEDIUM').length,
    low: allVulns.filter(v => v.severity === 'LOW' || v.severity === 'NONE').length,
  }
}
