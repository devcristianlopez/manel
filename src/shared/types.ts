/**
 * Manel Security Health Monitor — Shared Types
 *
 * Central type definitions for the CLI and Electron application.
 * All types are exported and can be imported by any module.
 *
 * @module shared/types
 */

// ============================================================================
// 1. Response Envelope
// ============================================================================

/**
 * Standard response envelope for all CLI commands.
 * Wraps command results with metadata, errors, and warnings.
 */
export interface ResponseEnvelope<T> {
  /** Whether the command succeeded */
  ok: boolean
  /** The command result data (null if error) */
  data: T | null
  /** Error details (null if success) */
  error: CliError | null
  /** Non-fatal warnings that occurred during execution */
  warnings: string[]
  /** Execution metadata */
  meta: {
    /** ISO 8601 timestamp of when the command was executed */
    timestamp: string
    /** Duration in milliseconds */
    duration: number
    /** CLI version that produced this response */
    version: string
  }
}

/**
 * Structured error for CLI commands.
 * Includes error codes, types, and recovery suggestions.
 */
export interface CliError {
  /** Machine-readable error code (e.g., 'SCAN_FAILED', 'NETWORK_TIMEOUT') */
  code: string
  /** Error category for programmatic handling */
  type: 'validation' | 'network' | 'internal' | 'not-found'
  /** Human-readable error message */
  message: string
  /** Whether the operation can be retried */
  recoverable: boolean
  /** Optional suggestions for resolving the error */
  suggestions?: string[]
}

// ============================================================================
// 2. Exit Codes
// ============================================================================

/**
 * Standard exit codes for CLI commands.
 * Follows Unix convention: 0 = success, non-zero = error.
 */
export enum ExitCode {
  /** Command executed successfully, no issues found */
  OK = 0,
  /** Findings detected (vulnerabilities, hardening failures) */
  FINDINGS = 1,
  /** Internal error occurred during execution */
  ERROR = 2,
  /** Invalid input provided to the command */
  INVALID_INPUT = 3,
}

// ============================================================================
// 3. Output Formats
// ============================================================================

/**
 * Supported output formats for CLI commands.
 */
export type OutputFormat = 'table' | 'json' | 'sarif' | 'ndjson'

// ============================================================================
// 4. Severity Levels
// ============================================================================

/**
 * Vulnerability severity levels.
 * Ordered from most to least severe.
 */
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'

// ============================================================================
// 5. Scanner Types
// ============================================================================

/**
 * Complete scan result containing all findings.
 */
export interface ScanResult {
  /** Technologies detected on the system */
  technologies: Technology[]
  /** Vulnerabilities found across all technologies */
  vulnerabilities: Vulnerability[]
  /** System hardening check results */
  hardening: HardeningResult[]
  /** Weighted security score */
  score: SecurityScore
  /** High-level summary statistics */
  summary: ScanSummary
}

/**
 * A detected technology/software package.
 */
export interface Technology {
  /** Display name of the technology (e.g., 'node', 'python', 'postgresql') */
  name: string
  /** Detected version string (null if detection failed) */
  version: string | null
  /** Whether the technology was successfully detected */
  detected: boolean
  /** Package ecosystem (e.g., 'npm', 'PyPI', 'Maven', 'unknown') */
  ecosystem: string
  /** Latest available version (if known) */
  latestVersion?: string
  /** Whether an update is available */
  updateAvailable?: boolean
}

/**
 * A known vulnerability affecting a technology.
 */
export interface Vulnerability {
  /** Unique vulnerability identifier */
  id: string
  /** Source database */
  source: 'OSV' | 'NVD' | 'GHSA'
  /** Severity rating */
  severity: Severity
  /** Vulnerability title/name */
  title: string
  /** Detailed description of the vulnerability */
  description: string
  /** Name of the affected package */
  affectedPackage: string
  /** Affected version range (e.g., '<2.0.0', '>=1.0.0 <1.5.0') */
  affectedVersions: string
  /** Version that contains the fix (if available) */
  fixedVersion?: string
  /** CVSS score (if available) */
  cvssScore?: number
  /** CVE identifier (e.g., 'CVE-2024-12345') */
  cveId?: string
  /** Reference URLs for more information */
  references: string[]
}

/**
 * A single hardening check definition and result.
 */
export interface HardeningCheck {
  /** Unique check identifier */
  id: string
  /** Check title */
  title: string
  /** Check result status */
  status: 'pass' | 'fail' | 'warning' | 'error'
  /** Severity if the check fails */
  severity: Severity
  /** Optional description of what the check verifies */
  description?: string
  /** Optional recommendation for remediation */
  recommendation?: string
}

/**
 * Collection of hardening check results with summary.
 */
export interface HardeningResult {
  /** Individual check results */
  checks: HardeningCheck[]
  /** Aggregate counts by status */
  summary: {
    /** Number of passing checks */
    pass: number
    /** Number of failing checks */
    fail: number
    /** Number of warnings */
    warning: number
  }
}

/**
 * Weighted security score breakdown.
 */
export interface SecurityScore {
  /** Overall score (0-100) */
  overall: number
  /** Per-category score breakdown */
  breakdown: {
    /** Operating system security score */
    os: number
    /** Hardening check score */
    hardening: number
    /** Development tools score */
    tools: number
    /** Dependencies score */
    dependencies: number
    /** Databases score */
    databases: number
    /** Penalty for critical vulnerabilities */
    criticalsPenalty: number
  }
}

/**
 * High-level scan statistics.
 */
export interface ScanSummary {
  /** Total technologies on the system */
  totalTechnologies: number
  /** Technologies that were successfully detected */
  detectedTechnologies: number
  /** Total vulnerabilities found */
  totalVulnerabilities: number
  /** Critical severity vulnerabilities */
  criticalVulnerabilities: number
  /** High severity vulnerabilities */
  highVulnerabilities: number
  /** Hardening pass rate (0-100) */
  hardeningPassRate: number
}

// ============================================================================
// 6. SARIF Types (Static Analysis Results Interchange Format)
// ============================================================================

/**
 * SARIF 2.1.0 report structure.
 * Used for exporting scan results in a standardized format.
 * @see https://docs.oasis-open.org/sarif/sarif/v2.1.0/
 */
export interface SarifReport {
  /** SARIF version */
  version: '2.1.0'
  /** JSON schema URI */
  $schema: string
  /** Tool execution runs */
  runs: SarifRun[]
}

/**
 * A single SARIF run (one scan execution).
 */
export interface SarifRun {
  /** Tool information */
  tool: {
    /** Tool driver details */
    driver: {
      /** Tool name */
      name: string
      /** Tool version */
      version: string
      /** Semantic version string */
      semanticVersion: string
      /** Analysis rules */
      rules: SarifRule[]
    }
  }
  /** Analysis results */
  results: SarifResult[]
  /** Execution invocations */
  invocations: SarifInvocation[]
}

/**
 * A SARIF rule definition.
 */
export interface SarifRule {
  /** Rule identifier */
  id: string
  /** Rule display name */
  name: string
  /** Short description */
  shortDescription: { text: string }
  /** Full description */
  fullDescription: { text: string }
  /** Default severity level */
  defaultConfiguration: { level: string }
  /** Documentation URL */
  helpUri: string
}

/**
 * A SARIF result (individual finding).
 */
export interface SarifResult {
  /** Rule that produced this result */
  ruleId: string
  /** Severity level ('error', 'warning', 'note') */
  level: string
  /** Result message */
  message: { text: string }
  /** Location of the finding */
  locations: SarifLocation[]
  /** Fingerprint for deduplication */
  fingerprints: Record<string, string>
  /** Optional fix suggestions */
  fixes?: SarifFix[]
}

/**
 * A SARIF location (where the finding occurred).
 */
export interface SarifLocation {
  physicalLocation: {
    /** File or resource URI */
    artifactLocation: { uri: string }
    /** Optional line number */
    region?: { startLine: number }
  }
}

/**
 * A SARIF fix (suggested remediation).
 */
export interface SarifFix {
  /** Fix description */
  description: { text: string }
  /** Changes to apply */
  artifactChanges: Array<{
    /** Target file */
    artifactLocation: { uri: string }
    /** Replacement operations */
    replacements: Array<{
      /** Region to delete */
      deletedRegion: { charOffset: number; charLength: number }
      /** Content to insert */
      insertedContent: { text: string }
    }>
  }>
}

/**
 * A SARIF invocation (one execution of the tool).
 */
export interface SarifInvocation {
  /** Whether execution completed without error */
  executionSuccessful: boolean
  /** Exit code (if available) */
  exitCode?: number
  /** Human-readable exit code description */
  exitCodeDescription?: string
}

// ============================================================================
// 7. Schema Types (CLI Introspection)
// ============================================================================

/**
 * Top-level CLI tool schema for introspection and documentation.
 */
export interface ToolSchema {
  /** Tool name */
  name: string
  /** Tool version */
  version: string
  /** Tool description */
  description: string
  /** Available commands */
  commands: CommandSchema[]
  /** Global flags that apply to all commands */
  globalFlags: FlagSchema[]
}

/**
 * Schema for a single CLI command.
 */
export interface CommandSchema {
  /** Command name (e.g., 'scan', 'check', 'update') */
  name: string
  /** Command description */
  description: string
  /** Command-specific flags */
  flags: FlagSchema[]
  /** Usage examples */
  examples: string[]
}

/**
 * Schema for a CLI flag/option.
 */
export interface FlagSchema {
  /** Long flag name (e.g., '--format') */
  name: string
  /** Short flag alias (e.g., '-f') */
  short?: string
  /** Flag description */
  description: string
  /** Expected value type */
  type: 'string' | 'boolean' | 'enum'
  /** Whether the flag is required */
  required: boolean
  /** Default value (if any) */
  default?: unknown
  /** Allowed values for enum types */
  enum?: string[]
}

// ============================================================================
// 8. Update Engine Types
// ============================================================================

/**
 * Version update information for a technology.
 */
export interface UpdateInfo {
  /** Technology name */
  technology: string
  /** Currently installed version */
  currentVersion: string
  /** Latest available version */
  latestVersion: string
  /** Whether an update is available */
  updateAvailable: boolean
  /** Source where the version info was fetched */
  source: string
  /** Release date of the latest version (ISO 8601) */
  releaseDate?: string
}

// ============================================================================
// 9. Database Types (Legacy Compatibility)
// ============================================================================

/**
 * Software entry in the database (legacy Electron format).
 * Kept for backward compatibility with existing SQLite schema.
 */
export interface Software {
  /** Unique identifier */
  id: string
  /** Software name */
  name: string
  /** Installed version */
  version: string
  /** Installation path */
  path: string
  /** Detection timestamp (Unix epoch seconds) */
  detected_at: number
  /** Scan ID this detection belongs to */
  scan_id: string
}

/**
 * Vulnerability entry in the database (legacy Electron format).
 * Kept for backward compatibility with existing SQLite schema.
 */
export interface VulnerabilityLegacy {
  /** Unique identifier */
  id: string
  /** CVE identifier */
  cve: string
  /** Severity level */
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
  /** Description */
  description: string
  /** Associated software ID */
  software_id: string
  /** Fixed version (if available) */
  fixed_version: string
  /** Source database */
  source: string
}

/**
 * @deprecated Use VulnerabilityLegacy for database format or the Vulnerability interface for CLI format.
 * Type alias removed to avoid duplicate identifier conflicts.
 * Import VulnerabilityLegacy directly for database compatibility.
 */

/**
 * Hardening result entry in the database (legacy Electron format).
 * Kept for backward compatibility with existing SQLite schema.
 */
export interface HardeningResultLegacy {
  /** Unique identifier */
  id: string
  /** Scan ID */
  scan_id: string
  /** Check identifier */
  check_id: string
  /** Check category */
  category: string
  /** Check title */
  title: string
  /** Check status */
  status: 'pass' | 'fail' | 'warning' | 'error'
  /** Severity level */
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  /** Detailed output */
  details: string
}

/**
 * @deprecated Use HardeningResultLegacy for database format or the HardeningResult interface for CLI format.
 * Type alias removed to avoid duplicate identifier conflicts.
 * Import HardeningResultLegacy directly for database compatibility.
 */

/**
 * Scan record in the database (legacy Electron format).
 * Kept for backward compatibility with existing SQLite schema.
 */
export interface Scan {
  /** Unique scan identifier */
  id: string
  /** Scan timestamp (Unix epoch seconds) */
  date: number
  /** Overall security score (null if not yet computed) */
  score: number | null
  /** Critical vulnerability count */
  critical_count: number
  /** High vulnerability count */
  high_count: number
  /** Medium vulnerability count */
  medium_count: number
  /** Low vulnerability count */
  low_count: number
  /** Scan status */
  status: 'pending' | 'scanning' | 'completed' | 'failed'
}

/**
 * Technology status indicator.
 */
export type TechnologyStatus = 'green' | 'yellow' | 'red' | 'black'

/**
 * Technology analysis result (legacy Electron format).
 * Kept for backward compatibility with existing code.
 */
export interface TechnologyResult {
  /** Technology name */
  name: string
  /** Installed version */
  installedVersion: string
  /** Latest available version */
  latestVersion: string
  /** Traffic light status */
  status: TechnologyStatus
  /** Known vulnerabilities */
  vulnerabilities: VulnerabilityLegacy[]
  /** Human-readable recommendation */
  recommendation: string
}

/**
 * Complete scan summary (legacy Electron format).
 * Kept for backward compatibility with existing code.
 */
export interface ScanSummaryLegacy {
  /** Scan record */
  scan: Scan
  /** Technology results */
  technologies: TechnologyResult[]
  /** Hardening results (optional) */
  hardeningResults?: HardeningResultLegacy[]
  /** Overall security score */
  overallScore: number
}

/**
 * @deprecated Use ScanSummaryLegacy for database format or the ScanSummary interface for CLI format.
 * Type alias removed to avoid duplicate identifier conflicts.
 * Import ScanSummaryLegacy directly for database compatibility.
 */

// ============================================================================
// 10. Electron IPC Types (Legacy)
// ============================================================================

/**
 * Electron IPC API interface.
 * Kept for backward compatibility with existing Electron code.
 */
export interface ManelApi {
  getAppInfo: () => Promise<{ name: string; version: string; platform: string }>
  startScan: () => Promise<{ scanId: string; status: string }>
  onScanUpdate: (callback: (data: unknown) => void) => () => void
  getAllLatestVersions: () => Promise<Record<string, string | null>>
  getLatestVersion: (techName: string) => Promise<{ techName: string; latestVersion: string } | null>
  analyzeSecurity: (params: { softwareList: Software[]; scanId: string }) => Promise<TechnologyResult[]>
  calculateScore: (technologies: TechnologyResult[]) => Promise<number>
  getScanSummary: (params: { scanId: string; technologies: TechnologyResult[]; hardeningResults?: HardeningResultLegacy[] }) => Promise<ScanSummaryLegacy>
  getSoftwareByScanId: (scanId: string) => Promise<Software[]>
  runHardeningChecks: (scanId: string) => Promise<HardeningResultLegacy[]>
  getHardeningResults: (scanId: string) => Promise<HardeningResultLegacy[]>
}

declare global {
  interface Window {
    manel: ManelApi
  }
}

// ============================================================================
// 11. Utility Types
// ============================================================================

/**
 * Type guard for checking if a value is a valid Severity.
 */
export function isSeverity(value: unknown): value is Severity {
  return typeof value === 'string' && ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'].includes(value)
}

/**
 * Type guard for checking if a value is a valid OutputFormat.
 */
export function isOutputFormat(value: unknown): value is OutputFormat {
  return typeof value === 'string' && ['table', 'json', 'sarif', 'ndjson'].includes(value)
}

/**
 * Type guard for checking if a value is a valid ExitCode.
 */
export function isExitCode(value: unknown): value is ExitCode {
  return typeof value === 'number' && Object.values(ExitCode).includes(value)
}

/**
 * Helper to create a successful ResponseEnvelope.
 */
export function okResponse<T>(data: T, duration: number, version: string): ResponseEnvelope<T> {
  return {
    ok: true,
    data,
    error: null,
    warnings: [],
    meta: {
      timestamp: new Date().toISOString(),
      duration,
      version,
    },
  }
}

/**
 * Helper to create an error ResponseEnvelope.
 */
export function errorResponse(
  error: CliError,
  duration: number,
  version: string,
  warnings: string[] = []
): ResponseEnvelope<null> {
  return {
    ok: false,
    data: null,
    error,
    warnings,
    meta: {
      timestamp: new Date().toISOString(),
      duration,
      version,
    },
  }
}
