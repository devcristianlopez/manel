import { ipcMain } from 'electron'
import { registerScannerHandlers } from '../scanner'
import { registerUpdateEngineHandlers } from '../update-engine'
import { registerSecurityHandlers } from '../security'

export function registerIpcHandlers() {
  ipcMain.handle('get-app-info', () => ({
    name: 'Manel',
    version: '0.1.0',
    platform: process.platform
  }))
  registerScannerHandlers()
  registerUpdateEngineHandlers()
  registerSecurityHandlers()
}
