import { TechnologyStatus } from '../../shared/types'

const osNames = new Set([
  'os', 'platform', 'ubuntu', 'debian', 'fedora', 'macos', 'windows',
  'arch', 'manjaro', 'centos', 'rhel', 'suse', 'linuxmint'
])

const toolNames = new Set([
  'npm', 'yarn', 'pnpm', 'git', 'docker', 'docker-compose', 'code', 'pip'
])

const dependencyNames = new Set([
  'node', 'python', 'python3', 'java', 'maven', 'gradle'
])

const databaseNames = new Set([
  'postgresql', 'mysql', 'mariadb', 'mongodb', 'redis', 'sqlite', 'pgadmin'
])

export function categorizeTechnology(name: string): 'os' | 'tools' | 'dependencies' | 'databases' {
  const lower = name.toLowerCase().trim()
  if (osNames.has(lower)) return 'os'
  if (databaseNames.has(lower)) return 'databases'
  if (toolNames.has(lower)) return 'tools'
  if (dependencyNames.has(lower)) return 'dependencies'
  return 'dependencies'
}

export function technologyStatusToScore(status: TechnologyStatus): number {
  switch (status) {
    case 'green': return 100
    case 'yellow': return 60
    case 'red': return 25
    case 'black': return 0
  }
}

export function hardeningStatusToScore(status: string): number {
  switch (status) {
    case 'pass': return 100
    case 'warning': return 50
    case 'fail': return 0
    case 'error': return 25
    default: return 50
  }
}
