/**
 * Manel CLI — Version
 *
 * Centralized version reading from package.json.
 * Avoids hardcoding '0.1.0' across multiple files.
 *
 * @module cli/version
 */

import { readFileSync } from 'fs'
import { join } from 'path'

let cachedVersion: string | null = null

/**
 * Read the package version from package.json.
 * Caches the result after first read.
 *
 * @returns Package version string (e.g., '1.0.0')
 */
export function getPackageVersion(): string {
  if (cachedVersion) return cachedVersion

  try {
    const packageJsonPath = join(__dirname, '..', '..', 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
    cachedVersion = packageJson.version || '0.0.0'
  } catch {
    cachedVersion = '0.0.0'
  }

  return cachedVersion
}
