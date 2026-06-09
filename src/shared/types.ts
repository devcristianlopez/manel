export interface Software {
  id: string
  name: string
  version: string
  path: string
  detected_at: number
  scan_id: string
}

export interface Vulnerability {
  id: string
  cve: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
  description: string
  software_id: string
  fixed_version: string
  source: string
}

export interface HardeningResult {
  id: string
  scan_id: string
  check_id: string
  category: string
  title: string
  status: 'pass' | 'fail' | 'warning' | 'error'
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  details: string
}

export interface Scan {
  id: string
  date: number
  score: number | null
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  status: 'pending' | 'scanning' | 'completed' | 'failed'
}

export type TechnologyStatus = 'green' | 'yellow' | 'red' | 'black'

export interface TechnologyResult {
  name: string
  installedVersion: string
  latestVersion: string
  status: TechnologyStatus
  vulnerabilities: Vulnerability[]
  recommendation: string
}

export interface ScanSummary {
  scan: Scan
  technologies: TechnologyResult[]
  hardeningResults?: HardeningResult[]
  overallScore: number
}

export interface ManelApi {
  getAppInfo: () => Promise<{ name: string; version: string; platform: string }>
  startScan: () => Promise<{ scanId: string; status: string }>
  onScanUpdate: (callback: (data: unknown) => void) => () => void
  getAllLatestVersions: () => Promise<Record<string, string | null>>
  getLatestVersion: (techName: string) => Promise<{ techName: string; latestVersion: string } | null>
  analyzeSecurity: (params: { softwareList: Software[]; scanId: string }) => Promise<TechnologyResult[]>
  calculateScore: (technologies: TechnologyResult[]) => Promise<number>
  getScanSummary: (params: { scanId: string; technologies: TechnologyResult[]; hardeningResults?: HardeningResult[] }) => Promise<ScanSummary>
  getSoftwareByScanId: (scanId: string) => Promise<Software[]>
  runHardeningChecks: (scanId: string) => Promise<HardeningResult[]>
  getHardeningResults: (scanId: string) => Promise<HardeningResult[]>
}

declare global {
  interface Window {
    manel: ManelApi
  }
}
