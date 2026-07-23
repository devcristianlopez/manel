/**
 * Manel Core — Technology Scanner
 *
 * Pure detection logic for development tools and databases.
 * Runs shell commands to detect installed software and extract version info.
 * No Electron or IPC dependencies.
 *
 * @module core/scanner
 */

import { execSync } from 'child_process'
import { randomUUID } from 'crypto'
import type { DetectorResult, OsInfo, CoreSoftware } from '../types'

// ============================================================================
// 1. Internal Helpers
// ============================================================================

/**
 * Safely execute a shell command and return trimmed output.
 * Returns null if the command fails (tool not installed, timeout, etc.).
 *
 * @param cmd - Shell command to execute
 * @returns Trimmed stdout string, or null on failure
 */
function safeExec(cmd: string): string | null {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim()
  } catch {
    return null
  }
}

/**
 * Extract a version string from command output using a regex.
 *
 * @param output - Raw command output
 * @param regex - Regular expression with a capture group for the version
 * @returns Extracted version string, or null if no match
 */
function extractVersion(output: string | null, regex: RegExp): string | null {
  if (!output) return null
  const match = output.match(regex)
  return match?.[1] ?? null
}

// ============================================================================
// 2. OS Detection
// ============================================================================

/**
 * Detect the operating system information.
 *
 * Reads /etc/os-release on Linux, runs sw_vers on macOS,
 * and wmic on Windows to gather platform, distro, and version.
 *
 * @returns Operating system information
 */
export function detectOS(): OsInfo {
  const platform = process.platform
  const release = require('os').release()
  let distro: string | undefined
  let version: string | undefined

  if (platform === 'linux') {
    try {
      const osRelease = require('fs').readFileSync('/etc/os-release', 'utf-8')
      const idMatch = osRelease.match(/^ID=["']?(\w+)["']?$/m)
      const versionMatch = osRelease.match(/^VERSION_ID=["']?([\w.]+)["']?$/m)
      if (idMatch) distro = idMatch[1]
      if (versionMatch) version = versionMatch[1]
    } catch {
      // /etc/os-release not available
    }
  } else if (platform === 'darwin') {
    const out = safeExec('sw_vers -productVersion')
    if (out) version = out
    distro = 'macOS'
  } else if (platform === 'win32') {
    const out = safeExec('wmic os get Caption,Version')
    if (out) {
      const lines = out.trim().split('\n')
      if (lines.length > 1) {
        const parts = lines[1].trim().split(/\s+/)
        distro = parts.slice(0, -1).join(' ')
        version = parts[parts.length - 1]
      }
    }
  }

  return { platform, release, distro, version }
}

// ============================================================================
// 3. Individual Detectors
// ============================================================================

/** Detect Node.js runtime */
export function detectNode(): DetectorResult | null {
  const out = safeExec('node -v')
  const version = extractVersion(out, /v?(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'node', version, path: 'node' }
}

/** Detect npm package manager */
export function detectNpm(): DetectorResult | null {
  const out = safeExec('npm -v')
  const version = extractVersion(out, /(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'npm', version, path: 'npm' }
}

/** Detect yarn package manager */
export function detectYarn(): DetectorResult | null {
  const out = safeExec('yarn -v')
  const version = extractVersion(out, /(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'yarn', version, path: 'yarn' }
}

/** Detect pnpm package manager */
export function detectPnpm(): DetectorResult | null {
  const out = safeExec('pnpm -v')
  const version = extractVersion(out, /(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'pnpm', version, path: 'pnpm' }
}

/** Detect git version control */
export function detectGit(): DetectorResult | null {
  const out = safeExec('git --version')
  const version = extractVersion(out, /(\d+\.\d+\.\d+(?:\.\d+)?)/)
  if (!version) return null
  return { name: 'git', version, path: 'git' }
}

/** Detect Docker runtime */
export function detectDocker(): DetectorResult | null {
  const out = safeExec('docker --version')
  const version = extractVersion(out, /(\d+\.\d+\.\d+(?:[.\w]+)?)/)
  if (!version) return null
  return { name: 'docker', version, path: 'docker' }
}

/** Detect Docker Compose */
export function detectDockerCompose(): DetectorResult | null {
  const out = safeExec('docker-compose --version')
  const version = extractVersion(out, /(\d+\.\d+\.\d+(?:[.\w]+)?)/)
  if (!version) return null
  return { name: 'docker-compose', version, path: 'docker-compose' }
}

/** Detect Python runtime */
export function detectPython(): DetectorResult | null {
  const out = safeExec('python --version')
  const version = extractVersion(out, /(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'python', version, path: 'python' }
}

/** Detect Python 3 runtime */
export function detectPython3(): DetectorResult | null {
  const out = safeExec('python3 --version')
  const version = extractVersion(out, /(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'python3', version, path: 'python3' }
}

/** Detect pip package manager */
export function detectPip(): DetectorResult | null {
  const out = safeExec('pip --version')
  const version = extractVersion(out, /(\d+\.\d+(?:\.\d+)?)/)
  if (!version) return null
  return { name: 'pip', version, path: 'pip' }
}

/** Detect Java runtime */
export function detectJava(): DetectorResult | null {
  const out = safeExec('java -version 2>&1')
  const version = extractVersion(out, /(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'java', version, path: 'java' }
}

/** Detect Apache Maven */
export function detectMaven(): DetectorResult | null {
  const out = safeExec('mvn --version')
  const version = extractVersion(out, /(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'mvn', version, path: 'mvn' }
}

/** Detect Gradle build tool */
export function detectGradle(): DetectorResult | null {
  const out = safeExec('gradle --version')
  const version = extractVersion(out, /(\d+(?:\.\d+)+)/)
  if (!version) return null
  return { name: 'gradle', version, path: 'gradle' }
}

/** Detect Visual Studio Code */
export function detectVSCode(): DetectorResult | null {
  const out = safeExec('code --version')
  if (!out) return null
  const lines = out.trim().split('\n')
  const version = extractVersion(lines[0], /(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'code', version, path: 'code' }
}

/** Detect PostgreSQL */
export function detectPostgreSQL(): DetectorResult | null {
  const out = safeExec('psql --version')
  const version = extractVersion(out, /PostgreSQL\s+(\d+\.\d+(?:\.\d+)?)/)
  if (!version) return null
  return { name: 'postgresql', version, path: 'psql' }
}

/** Detect MySQL */
export function detectMySQL(): DetectorResult | null {
  const out = safeExec('mysql --version')
  const version = extractVersion(out, /Ver\s+(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'mysql', version, path: 'mysql' }
}

/** Detect MariaDB */
export function detectMariaDB(): DetectorResult | null {
  const out = safeExec('mariadb --version')
  const version = extractVersion(out, /from\s+(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'mariadb', version, path: 'mariadb' }
}

/** Detect MongoDB */
export function detectMongoDB(): DetectorResult | null {
  const out = safeExec('mongod --version')
  const version = extractVersion(out, /db version v?(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'mongodb', version, path: 'mongod' }
}

/** Detect Redis */
export function detectRedis(): DetectorResult | null {
  const out = safeExec('redis-cli --version')
  const version = extractVersion(out, /redis-cli\s+(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'redis', version, path: 'redis-cli' }
}

/** Detect SQLite */
export function detectSQLite(): DetectorResult | null {
  const out = safeExec('sqlite3 --version')
  const version = extractVersion(out, /^(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'sqlite3', version, path: 'sqlite3' }
}

/** Detect pgAdmin4 */
export function detectPgAdmin(): DetectorResult | null {
  const out = safeExec('pgadmin4 --version 2>/dev/null')
  let version = extractVersion(out, /pgAdmin\s+\d+\s+v?(\d+\.\d+(?:\.\d+)?)/i)
  if (version) return { name: 'pgadmin4', version, path: 'pgadmin4' }

  const pipOut = safeExec('pip show pgadmin4 2>/dev/null')
  version = extractVersion(pipOut, /Version:\s*(\d+\.\d+(?:\.\d+)?)/i)
  if (version) return { name: 'pgadmin4', version, path: 'pgadmin4' }

  const dpkgOut = safeExec('dpkg -l pgadmin4 2>/dev/null')
  version = extractVersion(dpkgOut, /pgadmin4\s+(\d+\.\d+(?:\.\d+)?)/)
  if (version) return { name: 'pgadmin4', version, path: 'pgadmin4' }

  return null
}

// ============================================================================
// 4. Batch Detection
// ============================================================================

/**
 * All available detector functions in execution order.
 */
export const DETECTORS: Array<() => DetectorResult | null> = [
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
]

/**
 * Detect all installed technologies on the system.
 *
 * Runs every detector function and returns results for
 * successfully detected technologies.
 *
 * @param scanId - Optional scan ID to associate with detected software
 * @returns Array of detected software entries
 */
export function detectAll(scanId?: string): CoreSoftware[] {
  const now = Math.floor(Date.now() / 1000)
  const results: CoreSoftware[] = []

  for (const detect of DETECTORS) {
    try {
      const result = detect()
      if (result) {
        results.push({
          id: randomUUID(),
          name: result.name,
          version: result.version,
          path: result.path,
          detectedAt: now,
          scanId: scanId ?? '',
        })
      }
    } catch {
      // Skip detector on error
    }
  }

  return results
}

/**
 * Detect a single technology by name.
 *
 * @param name - Technology name (e.g., 'node', 'npm', 'postgresql')
 * @returns Detection result, or null if not found
 */
export function detectSingle(name: string): DetectorResult | null {
  const detectorMap: Record<string, () => DetectorResult | null> = {
    node: detectNode,
    npm: detectNpm,
    yarn: detectYarn,
    pnpm: detectPnpm,
    git: detectGit,
    docker: detectDocker,
    'docker-compose': detectDockerCompose,
    python: detectPython,
    python3: detectPython3,
    pip: detectPip,
    java: detectJava,
    maven: detectMaven,
    mvn: detectMaven,
    gradle: detectGradle,
    code: detectVSCode,
    postgresql: detectPostgreSQL,
    mysql: detectMySQL,
    mariadb: detectMariaDB,
    mongodb: detectMongoDB,
    redis: detectRedis,
    sqlite: detectSQLite,
    sqlite3: detectSQLite,
    pgadmin: detectPgAdmin,
    pgadmin4: detectPgAdmin,
  }

  const detector = detectorMap[name.toLowerCase()]
  if (!detector) return null

  try {
    return detector()
  } catch {
    return null
  }
}

/**
 * Get OS information (alias for detectOS).
 *
 * @returns Operating system information
 */
export function getOS(): OsInfo {
  return detectOS()
}
