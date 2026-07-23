/**
 * Manel Core — Barrel Export
 *
 * Re-exports all core business logic modules.
 * This is the main entry point for importing core functionality.
 *
 * @example
 * ```ts
 * import { detectAll, analyzeTechnology, calculateScore } from './core'
 * ```
 *
 * @module core
 */

// Types
export type {
  Severity,
  TechnologyStatus,
  DetectorResult,
  OsInfo,
  CoreVulnerability,
  CoreTechnologyResult,
  CoreHardeningCheck,
  ScoreBreakdown,
  SourceConfig,
  CoreSoftware,
  CoreScan,
  CoreVulnerabilityRecord,
  CoreHardeningRecord,
} from './types'

// Scanner
export {
  detectOS,
  detectNode,
  detectNpm,
  detectYarn,
  detectPnpm,
  detectGit,
  detectDocker,
  detectDockerCompose,
  detectPython,
  detectPython3,
  detectPip,
  detectJava,
  detectMaven,
  detectGradle,
  detectVSCode,
  detectPostgreSQL,
  detectMySQL,
  detectMariaDB,
  detectMongoDB,
  detectRedis,
  detectSQLite,
  detectPgAdmin,
  DETECTORS,
  detectAll,
  detectSingle,
  getOS,
} from './scanner'

// Security
export {
  queryOSV,
  queryNVD,
  queryGitHubAdvisory,
  queryAllSources,
  VulnerabilityCache,
  SOFTWARE_ECOSYSTEM_MAP,
  EOL_DATES,
  analyzeTechnology,
  analyzeAllTechnologies,
  calculateScore,
  calculateScoreBreakdown,
  calculateHardeningScore,
  getTrafficLight,
  countBySeverity,
  categorizeTechnology,
  technologyStatusToScore,
  hardeningStatusToScore,
  runHardeningChecks,
} from './security'
export type { AnalyzeOptions } from './security'

// Update Engine
export {
  getLatestVersion,
  getAllLatestVersions,
  VersionCache,
  TECH_SOURCES,
  getCache,
} from './update-engine'

// Database
export {
  initDatabase,
  getDatabase,
  closeDatabase,
  createScan,
  updateScan,
  getLatestScan,
  saveSoftware,
  getAllSoftware,
  getSoftwareByScanId,
  saveVulnerabilities,
  getVulnerabilitiesForSoftware,
  saveHardeningResults,
  getHardeningResultsByScanId,
} from './database'

// Database Cache
export {
  getCachedVersion,
  setCachedVersion,
  clearExpiredVersions,
  getCachedVulnerabilities,
  setCachedVulnerabilities,
  clearExpiredVulnerabilities,
} from './database/cache'
