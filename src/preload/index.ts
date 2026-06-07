import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  startScan: () => ipcRenderer.invoke('start-scan'),
  onScanUpdate: (callback: (data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on('scan-update', handler)
    return () => { ipcRenderer.removeListener('scan-update', handler) }
  },
  getAllLatestVersions: () => ipcRenderer.invoke('get-all-latest-versions'),
  getLatestVersion: (techName: string) => ipcRenderer.invoke('get-latest-version', techName),
  analyzeSecurity: (params: { softwareList: any[]; scanId: string }) => ipcRenderer.invoke('analyze-security', params),
  calculateScore: (technologies: any[]) => ipcRenderer.invoke('calculate-score', technologies),
  getScanSummary: (params: { scanId: string; technologies: any[] }) => ipcRenderer.invoke('get-scan-summary', params),
  getSoftwareByScanId: (scanId: string) => ipcRenderer.invoke('get-software-by-scan-id', scanId)
}

contextBridge.exposeInMainWorld('manel', api)
