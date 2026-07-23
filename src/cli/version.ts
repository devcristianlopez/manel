/**
 * Manel CLI — Version
 *
 * Centralized version reading from package.json.
 * Walks up the directory tree to find the project package.json,
 * so it works both from source (src/cli/) and compiled (out/cli/src/cli/).
 *
 * @module cli/version
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'

let cachedVersion: string | null = null

/**
 * Find the project package.json by walking up the directory tree.
 *
 * @param startDir - Directory to start searching from
 * @returns Absolute path to package.json, or null if not found
 */
function findPackageJson(startDir: string): string | null {
  let dir = startDir
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'package.json')
    if (existsSync(candidate)) {
      try {
        const pkg = JSON.parse(readFileSync(candidate, 'utf-8'))
        if (pkg.name === 'manel') return candidate
      } catch {
        // Not a valid package.json, keep walking up
      }
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

/**
 * Read the package version from package.json.
 * Caches the result after first read.
 *
 * @returns Package version string (e.g., '1.0.0')
 */
export function getPackageVersion(): string {
  if (cachedVersion) return cachedVersion

  try {
    const packageJsonPath = findPackageJson(__dirname)
    if (packageJsonPath) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      cachedVersion = packageJson.version || '0.0.0'
    } else {
      cachedVersion = '0.0.0'
    }
  } catch {
    cachedVersion = '0.0.0'
  }

  return cachedVersion
}
