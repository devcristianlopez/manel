import { execSync } from 'child_process'

export interface DetectorResult {
  name: string
  version: string
  path: string
}

function safeExec(cmd: string): string | null {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim()
  } catch {
    return null
  }
}

function extractVersion(output: string | null, regex: RegExp): string | null {
  if (!output) return null
  const match = output.match(regex)
  return match?.[1] ?? null
}

export function detectOS(): { platform: string; release: string; distro?: string; version?: string } {
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

export function detectNode(): DetectorResult | null {
  const out = safeExec('node -v')
  const version = extractVersion(out, /v?(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'node', version, path: 'node' }
}

export function detectNpm(): DetectorResult | null {
  const out = safeExec('npm -v')
  const version = extractVersion(out, /(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'npm', version, path: 'npm' }
}

export function detectYarn(): DetectorResult | null {
  const out = safeExec('yarn -v')
  const version = extractVersion(out, /(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'yarn', version, path: 'yarn' }
}

export function detectPnpm(): DetectorResult | null {
  const out = safeExec('pnpm -v')
  const version = extractVersion(out, /(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'pnpm', version, path: 'pnpm' }
}

export function detectGit(): DetectorResult | null {
  const out = safeExec('git --version')
  const version = extractVersion(out, /(\d+\.\d+\.\d+(?:\.\d+)?)/)
  if (!version) return null
  return { name: 'git', version, path: 'git' }
}

export function detectDocker(): DetectorResult | null {
  const out = safeExec('docker --version')
  const version = extractVersion(out, /(\d+\.\d+\.\d+(?:[.\w]+)?)/)
  if (!version) return null
  return { name: 'docker', version, path: 'docker' }
}

export function detectDockerCompose(): DetectorResult | null {
  const out = safeExec('docker-compose --version')
  const version = extractVersion(out, /(\d+\.\d+\.\d+(?:[.\w]+)?)/)
  if (!version) return null
  return { name: 'docker-compose', version, path: 'docker-compose' }
}

export function detectPython(): DetectorResult | null {
  const out = safeExec('python --version')
  const version = extractVersion(out, /(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'python', version, path: 'python' }
}

export function detectPython3(): DetectorResult | null {
  const out = safeExec('python3 --version')
  const version = extractVersion(out, /(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'python3', version, path: 'python3' }
}

export function detectPip(): DetectorResult | null {
  const out = safeExec('pip --version')
  const version = extractVersion(out, /(\d+\.\d+(?:\.\d+)?)/)
  if (!version) return null
  return { name: 'pip', version, path: 'pip' }
}

export function detectJava(): DetectorResult | null {
  const out = safeExec('java -version 2>&1')
  const version = extractVersion(out, /(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'java', version, path: 'java' }
}

export function detectMaven(): DetectorResult | null {
  const out = safeExec('mvn --version')
  const version = extractVersion(out, /(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'mvn', version, path: 'mvn' }
}

export function detectGradle(): DetectorResult | null {
  const out = safeExec('gradle --version')
  const version = extractVersion(out, /(\d+(?:\.\d+)+)/)
  if (!version) return null
  return { name: 'gradle', version, path: 'gradle' }
}

export function detectVSCode(): DetectorResult | null {
  const out = safeExec('code --version')
  if (!out) return null
  const lines = out.trim().split('\n')
  const version = extractVersion(lines[0], /(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'code', version, path: 'code' }
}

export function detectPostgreSQL(): DetectorResult | null {
  const out = safeExec('psql --version')
  const version = extractVersion(out, /PostgreSQL\s+(\d+\.\d+(?:\.\d+)?)/)
  if (!version) return null
  return { name: 'postgresql', version, path: 'psql' }
}

export function detectMySQL(): DetectorResult | null {
  const out = safeExec('mysql --version')
  const version = extractVersion(out, /Ver\s+(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'mysql', version, path: 'mysql' }
}

export function detectMariaDB(): DetectorResult | null {
  const out = safeExec('mariadb --version')
  const version = extractVersion(out, /from\s+(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'mariadb', version, path: 'mariadb' }
}

export function detectMongoDB(): DetectorResult | null {
  const out = safeExec('mongod --version')
  const version = extractVersion(out, /db version v?(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'mongodb', version, path: 'mongod' }
}

export function detectRedis(): DetectorResult | null {
  const out = safeExec('redis-cli --version')
  const version = extractVersion(out, /redis-cli\s+(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'redis', version, path: 'redis-cli' }
}

export function detectSQLite(): DetectorResult | null {
  const out = safeExec('sqlite3 --version')
  const version = extractVersion(out, /^(\d+\.\d+\.\d+)/)
  if (!version) return null
  return { name: 'sqlite3', version, path: 'sqlite3' }
}

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
