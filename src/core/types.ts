/**
 * Manel Core — Type definitions for business logic modules.
 *
 * These types are framework-agnostic and used by all core modules.
 * They do NOT depend on Electron, IPC, or any UI framework.
 *
 * @module core/types
 */

// ============================================================================
// 1. Severity & Status
// ============================================================================

/** Vulnerability severity levels. */
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'

/** Technology health status (traffic light). */
export type TechnologyStatus = 'green' | 'yellow' | 'red' | 'black'

// ============================================================================
// 2. Scanner Types
// ============================================================================

/** Result from a single technology detector. */
export interface DetectorResult {
  /** Technology name (e.g., 'node', 'npm', 'postgresql') */
  name: string
  /** Detected version string */
  version: string
  /** Command or path used for detection */
  path: string
}

/** Operating system information. */
export interface OsInfo {
  /** Platform identifier (e.g., 'linux', 'darwin', 'win32') */
  platform: string
  /** Kernel release string */
  release: string
  /** Distribution name (e.g., 'ubuntu', 'macOS', 'debian') */
  distro?: string
  /** OS version string */
  version?: string
}

// ============================================================================
// 3. Vulnerability Types
// ============================================================================

/** A known vulnerability from any source (OSV, NVD, GHSA). */
export interface CoreVulnerability {
  /** CVE identifier (e.g., 'CVE-2024-12345') */
  cve: string
  /** Severity rating */
  severity: Severity
  /** Vulnerability description */
  description: string
  /** Associated software ID (set by the caller for persistence) */
  softwareId: string
  /** Fixed version (if available) */
  fixedVersion: string
  /** Source database ('OSV', 'NVD', 'GHSA') */
  source: string
}

// ============================================================================
// 4. Technology Analysis Types
// ============================================================================

/** Result of analyzing a technology (security status + recommendations). */
export interface CoreTechnologyResult {
  /** Technology name */
  name: string
  /** Currently installed version */
  installedVersion: string
  /** Latest available version */
  latestVersion: string
  /** Traffic light status */
  status: TechnologyStatus
  /** Known vulnerabilities */
  vulnerabilities: CoreVulnerability[]
  /** Human-readable recommendation */
  recommendation: string
}

// ============================================================================
// 5. Hardening Types
// ============================================================================

/** Result of a single hardening check. */
export interface CoreHardeningCheck {
  /** Check identifier (e.g., 'firewall-active', 'ssh-root-login') */
  checkId: string
  /** Check category */
  category: string
  /** Check title */
  title: string
  /** Check result status */
  status: 'pass' | 'fail' | 'warning' | 'error'
  /** Severity if the check fails */
  severity: string
  /** Detailed output */
  details: string
}

// ============================================================================
// 6. Score Types
// ============================================================================

/** Weighted security score breakdown. */
export interface ScoreBreakdown {
  /** Overall score (0-100) */
  overall: number
  /** Per-category score breakdown */
  breakdown: {
    os: number
    hardening: number
    tools: number
    dependencies: number
    databases: number
    criticalsPenalty: number
  }
}

// ============================================================================
// 7. Update Engine Types
// ============================================================================

/** Configuration for a version source (URL + parser). */
export interface SourceConfig {
  /** URL to fetch version data from */
  url: string
  /** Parser function to extract the version from the response */
  parse: (data: unknown) => string | null
}

// ============================================================================
// 8. Database Types
// ============================================================================

/** Software entry (matches SQLite 'software' table schema). */
export interface CoreSoftware {
  /** Unique identifier */
  id: string
  /** Software name */
  name: string
  /** Installed version */
  version: string
  /** Installation path */
  path: string
  /** Detection timestamp (Unix epoch seconds) */
  detectedAt: number
  /** Scan ID this detection belongs to */
  scanId: string
}

/** Scan record (matches SQLite 'scans' table schema). */
export interface CoreScan {
  /** Unique scan identifier */
  id: string
  /** Scan timestamp (Unix epoch seconds) */
  date: number
  /** Overall security score (null if not yet computed) */
  score: number | null
  /** Critical vulnerability count */
  criticalCount: number
  /** High vulnerability count */
  highCount: number
  /** Medium vulnerability count */
  mediumCount: number
  /** Low vulnerability count */
  lowCount: number
  /** Scan status */
  status: 'pending' | 'scanning' | 'completed' | 'failed'
}

/** Vulnerability entry (matches SQLite 'vulnerabilities' table schema). */
export interface CoreVulnerabilityRecord {
  /** Unique identifier */
  id: string
  /** CVE identifier */
  cve: string
  /** Severity level */
  severity: string
  /** Description */
  description: string
  /** Associated software ID */
  softwareId: string
  /** Fixed version (if available) */
  fixedVersion: string
  /** Source database */
  source: string
}

/** Hardening result entry (matches SQLite 'hardening_results' table schema). */
export interface CoreHardeningRecord {
  /** Unique identifier */
  id: string
  /** Scan ID */
  scanId: string
  /** Check identifier */
  checkId: string
  /** Check category */
  category: string
  /** Check title */
  title: string
  /** Check status */
  status: 'pass' | 'fail' | 'warning' | 'error'
  /** Severity level */
  severity: string
  /** Detailed output */
  details: string
}
