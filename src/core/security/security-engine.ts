/**
 * Manel Core — Security Engine
 *
 * Analyzes technologies for vulnerabilities and determines
 * their security status. Pure business logic with no database
 * persistence (results are returned, not saved).
 *
 * @module core/security/security-engine
 */

import type { CoreTechnologyResult, CoreVulnerability, TechnologyStatus } from '../types'
import { queryAllSources, queryOffline } from './vulnerability-sources'
import { SOFTWARE_ECOSYSTEM_MAP } from './ecosystem-map'

// ============================================================================
// 1. Constants
// ============================================================================

/** Timeout for analyzing a single technology (15 seconds) */
const ANALYSIS_TIMEOUT = 15000

/** Keywords indicating known exploits in vulnerability descriptions */
const EXPLOIT_KEYWORDS = [
  'exploit',
  'rce',
  'remote code execution',
  'arbitrary code',
  'code execution',
  'poc',
  'proof of concept',
  'metasploit',
  'zero-day',
  'zeroday',
]

// ============================================================================
// 2. Internal Helpers
// ============================================================================

/**
 * Look up the ecosystem for a technology name.
 *
 * @param softwareName - Technology name
 * @returns Ecosystem identifier, or null if unknown
 */
function getEcosystem(softwareName: string): string | null {
  return SOFTWARE_ECOSYSTEM_MAP[softwareName] ?? null
}

/**
 * Check if a vulnerability description contains exploit keywords.
 *
 * @param vuln - Vulnerability to check
 * @returns True if exploit keywords are present
 */
function hasExploitKeywords(vuln: CoreVulnerability): boolean {
  const desc = (vuln.description ?? '').toLowerCase()
  return EXPLOIT_KEYWORDS.some(kw => desc.includes(kw))
}

/**
 * Compare two semver-style version strings.
 *
 * @param a - Version string A
 * @param b - Version string B
 * @returns Negative if a < b, positive if a > b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * Check if a version is significantly outdated compared to another.
 *
 * @param installed - Currently installed version
 * @param latest - Latest available version
 * @returns True if the installed version is significantly behind
 */
function isSignificantlyOutdated(installed: string, latest: string): boolean {
  if (compareVersions(latest, installed) <= 0) return false
  const installedParts = installed.split('.').map(Number)
  const latestParts = latest.split('.').map(Number)
  if (latestParts[0] > installedParts[0]) return true
  if (
    latestParts[0] === installedParts[0] &&
    latestParts[1] > (installedParts[1] ?? 0) + 2
  ) {
    return true
  }
  return false
}

/**
 * Build a human-readable recommendation based on vulnerability analysis.
 *
 * @param name - Technology name
 * @param installedVersion - Currently installed version
 * @param latestVersion - Latest available version (null if unknown)
 * @param vulnerabilities - Known vulnerabilities
 * @param status - Determined security status
 * @returns Recommendation text in Spanish
 */
function buildRecommendation(
  name: string,
  installedVersion: string,
  latestVersion: string | null,
  vulnerabilities: CoreVulnerability[],
  status: TechnologyStatus
): string {
  if (status === 'black') {
    const count = vulnerabilities.filter(
      v => v.severity === 'CRITICAL' && hasExploitKeywords(v)
    ).length
    const target = latestVersion ?? 'la última versión'
    return `CRÍTICO: ${count} vulnerabilidad(es) con exploit público conocido en ${name} ${installedVersion}. Actualizar a ${target} inmediatamente.`
  }

  if (status === 'red') {
    const crit = vulnerabilities.filter(v => v.severity === 'CRITICAL').length
    const high = vulnerabilities.filter(v => v.severity === 'HIGH').length
    const target = latestVersion ?? 'la última versión'
    return `Se requiere acción: ${crit} crítica(s) y ${high} alta(s) en ${name} ${installedVersion}. Actualizar a ${target}.`
  }

  if (status === 'yellow') {
    if (vulnerabilities.length > 0) {
      const med = vulnerabilities.filter(v => v.severity === 'MEDIUM').length
      const low = vulnerabilities.filter(v => v.severity === 'LOW').length
      const target = latestVersion ?? 'la última versión'
      return `Recomendado: ${med} media(s) y ${low} baja(s) en ${name} ${installedVersion}. Considera actualizar a ${target}.`
    }
    if (latestVersion) {
      return `Actualizar ${name} de ${installedVersion} a ${latestVersion} para obtener las últimas features y parches.`
    }
    return `Sin vulnerabilidades pero versión desactualizada. Considera actualizar ${name}.`
  }

  if (latestVersion && compareVersions(installedVersion, latestVersion) < 0) {
    return `Sin acciones requeridas. ${name} ${installedVersion} está actualizado (último: ${latestVersion}).`
  }
  return `Sin acciones requeridas. ${name} ${installedVersion} está en su última versión.`
}

/**
 * Execute a promise with a timeout.
 *
 * @param promise - Promise to race
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise result or throws on timeout
 */
async function analyzeWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`Analysis timed out after ${timeoutMs}ms`)), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timeoutHandle!)
  }
}

// ============================================================================
// 3. Analysis Functions
// ============================================================================

/** Options for technology analysis. */
export interface AnalyzeOptions {
  /** Function to get the latest version for a technology */
  getLatestVersion?: (name: string) => Promise<string | null>
  /** Function to save vulnerabilities to the database */
  saveVulnerabilities?: (vulns: Array<Omit<CoreVulnerability, 'softwareId'>>) => CoreVulnerability[]
  /** If true, use only the local synced vulnerability DB and skip all network access */
  offline?: boolean
}

/**
 * Analyze a single technology for vulnerabilities and security status.
 *
 * Queries vulnerability databases, determines the security status,
 * and builds a recommendation. The analysis has a 15-second timeout.
 *
 * @param name - Technology name
 * @param version - Installed version
 * @param softwareId - Software ID for database association
 * @param options - Optional analysis options (version lookup, persistence)
 * @returns Technology analysis result
 */
export async function analyzeTechnology(
  name: string,
  version: string,
  softwareId: string,
  options: AnalyzeOptions = {}
): Promise<CoreTechnologyResult> {
  return analyzeWithTimeout(
    doAnalyzeTechnology(name, version, softwareId, options),
    ANALYSIS_TIMEOUT
  )
}

async function doAnalyzeTechnology(
  name: string,
  version: string,
  softwareId: string,
  options: AnalyzeOptions
): Promise<CoreTechnologyResult> {
  const ecosystem = getEcosystem(name)

  let vulnerabilities: CoreVulnerability[] = []
  if (ecosystem) {
    try {
      const rawVulns = options.offline === true
        ? queryOffline(ecosystem, name, version)
        : await queryAllSources(ecosystem, name, version)
      const vulnsWithSoftwareId = rawVulns.map(v => ({
        ...v,
        softwareId,
      }))
      if (vulnsWithSoftwareId.length > 0 && options.saveVulnerabilities) {
        vulnerabilities = options.saveVulnerabilities(vulnsWithSoftwareId)
      } else {
        vulnerabilities = vulnsWithSoftwareId
      }
    } catch (err) {
      console.error(`[security-engine] Error querying vulnerabilities for ${name}:`, err)
    }
  }

  // Offline mode skips version checks entirely: latest-version lookups may hit
  // the network, and even cached values could be stale, so latestVersion stays null.
  let latestVersion: string | null = null
  if (options.offline !== true && options.getLatestVersion) {
    try {
      latestVersion = await options.getLatestVersion(name)
    } catch (err) {
      console.error(`[security-engine] Error getting latest version for ${name}:`, err)
    }
  }

  const criticalVulns = vulnerabilities.filter(v => v.severity === 'CRITICAL')
  const highVulns = vulnerabilities.filter(v => v.severity === 'HIGH')
  const mediumVulns = vulnerabilities.filter(v => v.severity === 'MEDIUM')
  const lowVulns = vulnerabilities.filter(v => v.severity === 'LOW')

  let status: TechnologyStatus
  const hasCriticalWithExploit = criticalVulns.some(v => hasExploitKeywords(v))
  const hasCriticalOrHigh = criticalVulns.length > 0 || highVulns.length > 0
  const hasMediumOrLow = mediumVulns.length > 0 || lowVulns.length > 0

  if (hasCriticalWithExploit) {
    status = 'black'
  } else if (hasCriticalOrHigh) {
    status = 'red'
  } else if (hasMediumOrLow) {
    status = 'yellow'
  } else if (latestVersion && isSignificantlyOutdated(version, latestVersion)) {
    status = 'yellow'
  } else {
    status = 'green'
  }

  const recommendation = buildRecommendation(name, version, latestVersion, vulnerabilities, status)

  return {
    name,
    installedVersion: version,
    latestVersion: latestVersion ?? version,
    status,
    vulnerabilities,
    recommendation,
  }
}

/**
 * Analyze all technologies in parallel.
 *
 * @param softwareList - Array of {name, version, id} entries
 * @param options - Optional analysis options
 * @returns Array of technology analysis results (failures are skipped)
 */
export async function analyzeAllTechnologies(
  softwareList: Array<{ name: string; version: string; id: string }>,
  options: AnalyzeOptions = {}
): Promise<CoreTechnologyResult[]> {
  const results = await Promise.allSettled(
    softwareList.map(software =>
      analyzeTechnology(software.name, software.version, software.id, options)
    )
  )

  const techResults: CoreTechnologyResult[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      techResults.push(result.value)
    } else {
      console.error('[security-engine] Technology analysis failed:', result.reason)
    }
  }

  return techResults
}
