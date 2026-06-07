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

export function categorizeTechnology(name: string): 'os' | 'tools' | 'dependencies' {
  const lower = name.toLowerCase().trim()
  if (osNames.has(lower)) return 'os'
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
