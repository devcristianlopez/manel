/**
 * Manel Core — Security Module
 *
 * Barrel export for all security-related business logic.
 * Includes vulnerability analysis, scoring, hardening checks,
 * and vulnerability source queries.
 *
 * @module core/security
 */

// Vulnerability sources
export { queryOSV, queryNVD, queryGitHubAdvisory, queryAllSources } from './vulnerability-sources'

// Offline OSV sync + local query
export { OSV_ECOSYSTEMS, syncEcosystem, getLastSync } from './osv-sync'
export type { OsvEcosystem, SyncResult } from './osv-sync'
export { queryLocalDB, hasLocalData } from './local-query'
export { queryOffline } from './vulnerability-sources'

// Cache
export { VulnerabilityCache } from './cache'

// Ecosystem map
export { SOFTWARE_ECOSYSTEM_MAP } from './ecosystem-map'

// EOL dates
export { EOL_DATES } from './eol'

// Security engine (analysis)
export { analyzeTechnology, analyzeAllTechnologies } from './security-engine'
export type { AnalyzeOptions } from './security-engine'

// Score engine
export {
  calculateScore,
  calculateScoreBreakdown,
  calculateHardeningScore,
  getTrafficLight,
  countBySeverity,
} from './score-engine'

// Score utilities
export {
  categorizeTechnology,
  technologyStatusToScore,
  hardeningStatusToScore,
} from './score-utils'

// Hardening checks
export { runHardeningChecks } from './hardening'
