import { TechnologyResult, TechnologyStatus, Scan, ScanSummary } from '../../shared/types'
import { updateScan } from '../database'
import { categorizeTechnology, technologyStatusToScore } from './score-utils'

function calculateCategoryScore(technologies: TechnologyResult[], category: 'os' | 'tools' | 'dependencies'): number {
  const filtered = technologies.filter(t => categorizeTechnology(t.name) === category)
  if (filtered.length === 0) return 0

  const total = filtered.reduce((sum, t) => sum + technologyStatusToScore(t.status), 0)
  return Math.round(total / filtered.length)
}

function calculateCriticalsPenalty(technologies: TechnologyResult[]): number {
  const criticalVulns = technologies.flatMap(t =>
    t.vulnerabilities.filter(v => v.severity === 'CRITICAL')
  )

  if (criticalVulns.length === 0) return 100

  const activeCriticalVulns = criticalVulns.filter(v => !v.fixed_version)

  if (activeCriticalVulns.length === 0) return 50

  return Math.max(0, 0 - 10 * activeCriticalVulns.length)
}

export function calculateScore(technologies: TechnologyResult[]): number {
  if (technologies.length === 0) return 0

  const osScore = calculateCategoryScore(technologies, 'os')
  const toolsScore = calculateCategoryScore(technologies, 'tools')
  const depsScore = calculateCategoryScore(technologies, 'dependencies')
  const criticalsPenalty = calculateCriticalsPenalty(technologies)

  const finalScore =
    osScore * 0.20 +
    toolsScore * 0.20 +
    depsScore * 0.40 +
    criticalsPenalty * 0.20

  return Math.round(Math.max(0, Math.min(100, finalScore)))
}

export function getTrafficLight(score: number): TechnologyStatus {
  if (score >= 80) return 'green'
  if (score >= 60) return 'yellow'
  if (score >= 40) return 'red'
  return 'black'
}

export function countBySeverity(technologies: TechnologyResult[]): {
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
    low: allVulns.filter(v => v.severity === 'LOW' || v.severity === 'NONE').length
  }
}

export async function generateScanSummary(
  scanId: string,
  technologies: TechnologyResult[]
): Promise<ScanSummary> {
  const overallScore = calculateScore(technologies)
  const counts = countBySeverity(technologies)

  const scan: Scan = {
    id: scanId,
    date: Math.floor(Date.now() / 1000),
    score: overallScore,
    critical_count: counts.critical,
    high_count: counts.high,
    medium_count: counts.medium,
    low_count: counts.low,
    status: 'completed'
  }

  updateScan(scanId, {
    score: overallScore,
    critical_count: counts.critical,
    high_count: counts.high,
    medium_count: counts.medium,
    low_count: counts.low,
    status: 'completed'
  })

  return {
    scan,
    technologies,
    overallScore
  }
}
