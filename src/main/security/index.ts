import { ipcMain } from 'electron'
import { queryAllSources } from './vulnerability-sources'
import { VulnerabilityCache } from './cache'
import { saveVulnerabilities } from '../database'
import { analyzeAllTechnologies } from './security-engine'
import type { Vulnerability, Software, TechnologyResult, ScanSummary } from '../../shared/types'
import { calculateScore, countBySeverity, generateScanSummary } from './score-engine'

const cache = new VulnerabilityCache()

export function registerSecurityHandlers(): void {
  ipcMain.handle(
    'check-vulnerabilities',
    async (
      _event,
      params: {
        ecosystem: string
        packageName: string
        version: string
        softwareId: string
      }
    ): Promise<Vulnerability[]> => {
      const { ecosystem, packageName, version, softwareId } = params
      if (!ecosystem || !packageName || !version || !softwareId) {
        return []
      }

      const cacheKey = `${ecosystem}:${packageName}:${version}`

      const cached = cache.get(cacheKey)
      if (cached) {
        return cached.map(v => ({ ...v, software_id: softwareId }))
      }

      const rawVulns = await queryAllSources(ecosystem, packageName, version)
      const vulnsWithSoftwareId = rawVulns.map(v => ({
        ...v,
        software_id: softwareId
      }))

      const saved = saveVulnerabilities(vulnsWithSoftwareId)
      cache.set(cacheKey, saved)

      return saved
    }
  )

  ipcMain.handle(
    'calculate-score',
    async (_event, technologies: TechnologyResult[]): Promise<number> => {
      return calculateScore(technologies)
    }
  )

  ipcMain.handle(
    'get-scan-summary',
    async (_event, params: { scanId: string; technologies: TechnologyResult[] }): Promise<ScanSummary> => {
      const { scanId, technologies } = params
      return generateScanSummary(scanId, technologies)
    }
  )

  ipcMain.handle(
    'analyze-security',
    async (
      _event,
      params: { softwareList: Software[]; scanId: string }
    ): Promise<TechnologyResult[]> => {
      const { softwareList, scanId } = params
      if (!softwareList || !scanId) {
        return []
      }
      return await analyzeAllTechnologies(softwareList, scanId)
    }
  )
}
