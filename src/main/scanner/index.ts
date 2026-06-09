import { ipcMain, BrowserWindow } from 'electron'
import {
  detectOS,
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
  detectPgAdmin
} from './detectors'
import { createScan, updateScan, saveSoftware, getSoftwareByScanId } from '../database'
import { Software, Scan } from '../../shared/types'

export function registerScannerHandlers() {
  ipcMain.handle('start-scan', async (event) => {
    const scan = createScan()
    const win = BrowserWindow.fromWebContents(event.sender)

    const sendUpdate = (data: Record<string, unknown>) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('scan-update', data)
      }
    }

    sendUpdate({ type: 'scan-started', scanId: scan.id, status: 'scanning' })

    try {
      updateScan(scan.id, { status: 'scanning' })
      sendUpdate({ type: 'status', scanId: scan.id, status: 'scanning' })

      const detectors = [
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
        detectPgAdmin
      ]

      const now = Math.floor(Date.now() / 1000)
      const detectedList: Omit<Software, 'id'>[] = []

      for (const detect of detectors) {
        let result: ReturnType<typeof detectNode> = null
        try {
          result = detect()
        } catch {
          // skip detector on error
        }
        if (result) {
          detectedList.push({
            name: result.name,
            version: result.version,
            path: result.path,
            detected_at: now,
            scan_id: scan.id
          })
          sendUpdate({ type: 'software-detected', software: result.name, version: result.version })
        }
      }

      const saved = saveSoftware(detectedList)
      const osInfo = detectOS()

      sendUpdate({ type: 'os-detected', osInfo: osInfo as unknown as Record<string, unknown> })

      updateScan(scan.id, { status: 'completed' })
      sendUpdate({ type: 'scan-completed', scanId: scan.id, status: 'completed', count: saved.length })

      return { scanId: scan.id, status: 'completed' }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      updateScan(scan.id, { status: 'failed' })
      sendUpdate({ type: 'scan-failed', scanId: scan.id, error: message })
      return { scanId: scan.id, status: 'failed' }
    }
  })

  ipcMain.handle('get-software-by-scan-id', async (_event, scanId: string) => {
    return getSoftwareByScanId(scanId)
  })
}
