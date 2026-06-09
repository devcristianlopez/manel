import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'

const CACHE_TTL_MS = 30 * 60 * 1000
const REQUEST_TIMEOUT_MS = 8000

interface SourceConfig {
  url: string
  parse: (data: unknown) => string | null
}

function sortByCycleDesc(entries: { cycle: string; latest?: string; latestRelease?: string }[]): { cycle: string; latest?: string; latestRelease?: string }[] {
  return [...entries].sort((a, b) => {
    const pa = a.cycle.split('.').map(Number)
    const pb = b.cycle.split('.').map(Number)
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const diff = (pb[i] ?? 0) - (pa[i] ?? 0)
      if (diff !== 0) return diff
    }
    return 0
  })
}

const TECH_SOURCES: Record<string, SourceConfig> = {
  node: {
    url: 'https://nodejs.org/dist/index.json',
    parse: (data: unknown): string | null => {
      if (!Array.isArray(data)) return null
      const lts = data.filter((e: Record<string, unknown>) => e.lts)
      if (lts.length === 0) return null
      lts.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        const va = (a.version as string).replace('v', '').split('.').map(Number)
        const vb = (b.version as string).replace('v', '').split('.').map(Number)
        for (let i = 0; i < 3; i++) {
          const diff = (vb[i] ?? 0) - (va[i] ?? 0)
          if (diff !== 0) return diff
        }
        return 0
      })
      return (lts[0].version as string).replace(/^v/, '')
    }
  },
  npm: {
    url: 'https://registry.npmjs.org/npm/latest',
    parse: (data: unknown): string | null => {
      const d = data as Record<string, unknown>
      return typeof d?.version === 'string' ? d.version : null
    }
  },
  yarn: {
    url: 'https://registry.npmjs.org/yarn/latest',
    parse: (data: unknown): string | null => {
      const d = data as Record<string, unknown>
      return typeof d?.version === 'string' ? d.version : null
    }
  },
  pnpm: {
    url: 'https://registry.npmjs.org/pnpm/latest',
    parse: (data: unknown): string | null => {
      const d = data as Record<string, unknown>
      return typeof d?.version === 'string' ? d.version : null
    }
  },
  git: {
    url: 'https://api.github.com/repos/git/git/releases/latest',
    parse: (data: unknown): string | null => {
      const d = data as Record<string, unknown>
      if (typeof d?.tag_name !== 'string') return null
      return (d.tag_name as string).replace(/^v/, '')
    }
  },
  docker: {
    url: 'https://api.github.com/repos/docker/docker-ce/releases/latest',
    parse: (data: unknown): string | null => {
      const d = data as Record<string, unknown>
      if (typeof d?.tag_name !== 'string') return null
      return (d.tag_name as string).replace(/^v/, '')
    }
  },
  'docker-compose': {
    url: 'https://api.github.com/repos/docker/compose/releases/latest',
    parse: (data: unknown): string | null => {
      const d = data as Record<string, unknown>
      if (typeof d?.tag_name !== 'string') return null
      return (d.tag_name as string).replace(/^v/, '')
    }
  },
  python: {
    url: 'https://endoflife.date/api/python/latest.json',
    parse: (data: unknown): string | null => {
      const d = data as Record<string, unknown>
      return typeof d?.latest === 'string' ? d.latest : null
    }
  },
  pip: {
    url: 'https://pypi.org/pypi/pip/json',
    parse: (data: unknown): string | null => {
      const d = data as Record<string, unknown>
      const info = d?.info as Record<string, unknown> | undefined
      return typeof info?.version === 'string' ? info.version : null
    }
  },
  java: {
    url: 'https://endoflife.date/api/java.json',
    parse: (data: unknown): string | null => {
      if (!Array.isArray(data)) return null
      const lts = data.filter((e: Record<string, unknown>) => e.lts)
      if (lts.length === 0) return null
      const sorted = sortByCycleDesc(lts)
      return (sorted[0]?.latest as string) ?? (sorted[0]?.latestRelease as string) ?? null
    }
  },
  maven: {
    url: 'https://api.github.com/repos/apache/maven/releases/latest',
    parse: (data: unknown): string | null => {
      const d = data as Record<string, unknown>
      if (typeof d?.tag_name !== 'string') return null
      return (d.tag_name as string).replace(/^maven-/, '')
    }
  },
  gradle: {
    url: 'https://services.gradle.org/versions/current',
    parse: (data: unknown): string | null => {
      const d = data as Record<string, unknown>
      return typeof d?.version === 'string' ? d.version : null
    }
  },
  code: {
    url: 'https://api.github.com/repos/microsoft/vscode/releases/latest',
    parse: (data: unknown): string | null => {
      const d = data as Record<string, unknown>
      if (typeof d?.tag_name !== 'string') return null
      return (d.tag_name as string).replace(/^v/, '')
    }
  },
  ubuntu: {
    url: 'https://endoflife.date/api/ubuntu.json',
    parse: (data: unknown): string | null => {
      if (!Array.isArray(data)) return null
      const sorted = sortByCycleDesc(data)
      return (sorted[0]?.latest as string) ?? (sorted[0]?.cycle as string) ?? null
    }
  },
  debian: {
    url: 'https://endoflife.date/api/debian.json',
    parse: (data: unknown): string | null => {
      if (!Array.isArray(data)) return null
      const sorted = sortByCycleDesc(data)
      return (sorted[0]?.latest as string) ?? (sorted[0]?.cycle as string) ?? null
    }
  },
  fedora: {
    url: 'https://endoflife.date/api/fedora.json',
    parse: (data: unknown): string | null => {
      if (!Array.isArray(data)) return null
      const sorted = sortByCycleDesc(data)
      return (sorted[0]?.latest as string) ?? (sorted[0]?.cycle as string) ?? null
    }
  },
  macos: {
    url: 'https://endoflife.date/api/macos.json',
    parse: (data: unknown): string | null => {
      if (!Array.isArray(data)) return null
      const sorted = sortByCycleDesc(data)
      return (sorted[0]?.latest as string) ?? (sorted[0]?.cycle as string) ?? null
    }
  },
  windows: {
    url: 'https://endoflife.date/api/windows.json',
    parse: (data: unknown): string | null => {
      if (!Array.isArray(data)) return null
      const sorted = sortByCycleDesc(data)
      return (sorted[0]?.latest as string) ?? (sorted[0]?.cycle as string) ?? null
    }
  },
  postgresql: {
    url: 'https://endoflife.date/api/postgresql.json',
    parse: (data: unknown): string | null => {
      if (!Array.isArray(data)) return null
      const sorted = sortByCycleDesc(data)
      return (sorted[0]?.latest as string) ?? null
    }
  },
  mysql: {
    url: 'https://endoflife.date/api/mysql.json',
    parse: (data: unknown): string | null => {
      if (!Array.isArray(data)) return null
      const sorted = sortByCycleDesc(data)
      return (sorted[0]?.latest as string) ?? null
    }
  },
  mongodb: {
    url: 'https://api.github.com/repos/mongodb/mongo/releases/latest',
    parse: (data: unknown): string | null => {
      const d = data as Record<string, unknown>
      if (typeof d?.tag_name !== 'string') return null
      return (d.tag_name as string).replace(/^r/, '').replace(/^v/, '')
    }
  },
  redis: {
    url: 'https://api.github.com/repos/redis/redis/releases/latest',
    parse: (data: unknown): string | null => {
      const d = data as Record<string, unknown>
      if (typeof d?.tag_name !== 'string') return null
      return (d.tag_name as string).replace(/^v/, '')
    }
  },
  sqlite: {
    url: 'https://www.sqlite.org/version.html',
    parse: (_data: unknown): string | null => {
      return null
    }
  },
  pgadmin: {
    url: 'https://api.github.com/repos/postgres/pgadmin4/releases/latest',
    parse: (data: unknown): string | null => {
      const d = data as Record<string, unknown>
      if (typeof d?.tag_name !== 'string') return null
      return (d.tag_name as string).replace(/^v/, '').replace(/^REL_/, '')
    }
  }
}

export class VersionCache {
  private cache = new Map<string, { version: string; timestamp: number }>()
  private ttl: number

  constructor(ttl: number = CACHE_TTL_MS) {
    this.ttl = ttl
  }

  get(key: string): string | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return null
    }
    return entry.version
  }

  set(key: string, version: string): void {
    this.cache.set(key, { version, timestamp: Date.now() })
  }

  clear(): void {
    this.cache.clear()
  }
}

const versionCache = new VersionCache()

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return await response.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function getLatestVersion(techName: string): Promise<string | null> {
  const cached = versionCache.get(techName)
  if (cached !== null) return cached

  const source = TECH_SOURCES[techName]
  if (!source) {
    console.warn(`[update-engine] Unknown technology: ${techName}`)
    return null
  }

  try {
    const data = await fetchJson(source.url)
    const version = source.parse(data)
    if (version) {
      versionCache.set(techName, version)
    }
    return version
  } catch (err) {
    console.error(`[update-engine] Error fetching latest version for ${techName}:`, err)
    return null
  }
}

export async function getAllLatestVersions(): Promise<Record<string, string | null>> {
  const names = Object.keys(TECH_SOURCES)
  const results = await Promise.allSettled(
    names.map(async (name) => {
      const version = await getLatestVersion(name)
      return { name, version }
    })
  )
  const map: Record<string, string | null> = {}
  for (const result of results) {
    if (result.status === 'fulfilled') {
      map[result.value.name] = result.value.version
    }
  }
  return map
}

export function registerUpdateEngineHandlers(): void {
  ipcMain.handle('get-latest-version', async (_event: IpcMainInvokeEvent, techName: string) => {
    const latestVersion = await getLatestVersion(techName)
    if (latestVersion === null) return null
    return { techName, latestVersion }
  })

  ipcMain.handle('get-all-latest-versions', async () => {
    return await getAllLatestVersions()
  })
}

export { versionCache as cache, TECH_SOURCES }
