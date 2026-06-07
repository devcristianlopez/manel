import type { Software, Vulnerability, TechnologyResult, TechnologyStatus } from '../../shared/types'
import { queryAllSources } from './vulnerability-sources'
import { getLatestVersion } from '../update-engine'
import { saveVulnerabilities } from '../database'
import { SOFTWARE_ECOSYSTEM_MAP } from './ecosystem-map'

const ANALYSIS_TIMEOUT = 15000

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

function getEcosystem(softwareName: string): string | null {
  return SOFTWARE_ECOSYSTEM_MAP[softwareName] ?? null
}

function hasExploitKeywords(vuln: Vulnerability): boolean {
  const desc = (vuln.description ?? '').toLowerCase()
  return EXPLOIT_KEYWORDS.some(kw => desc.includes(kw))
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

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

function buildRecommendation(
  software: Software,
  latestVersion: string | null,
  vulnerabilities: Vulnerability[],
  status: TechnologyStatus
): string {
  if (status === 'black') {
    const count = vulnerabilities.filter(
      v => v.severity === 'CRITICAL' && hasExploitKeywords(v)
    ).length
    const target = latestVersion ?? 'la última versión'
    return `CRÍTICO: ${count} vulnerabilidad(es) con exploit público conocido en ${software.name} ${software.version}. Actualizar a ${target} inmediatamente.`
  }

  if (status === 'red') {
    const crit = vulnerabilities.filter(v => v.severity === 'CRITICAL').length
    const high = vulnerabilities.filter(v => v.severity === 'HIGH').length
    const target = latestVersion ?? 'la última versión'
    return `Se requiere acción: ${crit} crítica(s) y ${high} alta(s) en ${software.name} ${software.version}. Actualizar a ${target}.`
  }

  if (status === 'yellow') {
    if (vulnerabilities.length > 0) {
      const med = vulnerabilities.filter(v => v.severity === 'MEDIUM').length
      const low = vulnerabilities.filter(v => v.severity === 'LOW').length
      const target = latestVersion ?? 'la última versión'
      return `Recomendado: ${med} media(s) y ${low} baja(s) en ${software.name} ${software.version}. Considera actualizar a ${target}.`
    }
    if (latestVersion) {
      return `Actualizar ${software.name} de ${software.version} a ${latestVersion} para obtener las últimas features y parches.`
    }
    return `Sin vulnerabilidades pero versión desactualizada. Considera actualizar ${software.name}.`
  }

  if (latestVersion && compareVersions(software.version, latestVersion) < 0) {
    return `Sin acciones requeridas. ${software.name} ${software.version} está actualizado (último: ${latestVersion}).`
  }
  return `Sin acciones requeridas. ${software.name} ${software.version} está en su última versión.`
}

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

export async function analyzeTechnology(
  software: Software,
  scanId: string
): Promise<TechnologyResult> {
  return analyzeWithTimeout(doAnalyzeTechnology(software, scanId), ANALYSIS_TIMEOUT)
}

async function doAnalyzeTechnology(
  software: Software,
  _scanId: string
): Promise<TechnologyResult> {
  const ecosystem = getEcosystem(software.name)

  let vulnerabilities: Vulnerability[] = []
  if (ecosystem) {
    try {
      const rawVulns = await queryAllSources(ecosystem, software.name, software.version)
      const vulnsWithSoftwareId: Omit<Vulnerability, 'id'>[] = rawVulns.map(v => ({
        cve: v.cve,
        severity: v.severity,
        description: v.description,
        software_id: software.id,
        fixed_version: v.fixed_version,
        source: v.source,
      }))
      if (vulnsWithSoftwareId.length > 0) {
        vulnerabilities = saveVulnerabilities(vulnsWithSoftwareId)
      }
    } catch (err) {
      console.error(`[security-engine] Error querying vulnerabilities for ${software.name}:`, err)
    }
  }

  let latestVersion: string | null = null
  try {
    latestVersion = await getLatestVersion(software.name)
  } catch (err) {
    console.error(`[security-engine] Error getting latest version for ${software.name}:`, err)
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
  } else if (latestVersion && isSignificantlyOutdated(software.version, latestVersion)) {
    status = 'yellow'
  } else {
    status = 'green'
  }

  const recommendation = buildRecommendation(software, latestVersion, vulnerabilities, status)

  return {
    name: software.name,
    installedVersion: software.version,
    latestVersion: latestVersion ?? software.version,
    status,
    vulnerabilities,
    recommendation,
  }
}

export async function analyzeAllTechnologies(
  softwareList: Software[],
  scanId: string
): Promise<TechnologyResult[]> {
  const results = await Promise.allSettled(
    softwareList.map(software => analyzeTechnology(software, scanId))
  )

  const techResults: TechnologyResult[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      techResults.push(result.value)
    } else {
      console.error('[security-engine] Technology analysis failed:', result.reason)
    }
  }

  return techResults
}
