/**
 * Manel CLI — Updates Command
 *
 * Checks for available updates for installed technologies.
 * Queries external APIs to find the latest versions.
 *
 * @module cli/commands/updates
 */

import type { Command } from 'commander'
import { detectAll } from '../../core/scanner'
import { getLatestVersion, getAllLatestVersions } from '../../core/update-engine'
import { formatOutput } from '../output'
import type { UpdateInfo } from '../../shared/types'
import { detectTTY } from '../output'
import type { CommonFlags } from '../flags'
import { Spinner, setActiveSpinner } from '../spinner'
import { getPackageVersion } from '../version'
import { internalError, formatErrorForStderr } from '../errors'

// ============================================================================
// 1. Command Registration
// ============================================================================

/**
 * Register the updates command with Commander.js.
 *
 * @param program - Commander.js program instance
 */
export function registerUpdatesCommand(program: Command): void {
  program
    .command('updates')
    .description('Check for available updates for installed technologies')
    .option('-f, --format <format>', 'Output format (table, json, sarif, ndjson)', 'table')
    .option('-o, --output <file>', 'Write output to file instead of stdout')
    .option('--no-color', 'Disable ANSI color output')
    .option('-q, --quiet', 'Suppress non-error output')
    .option('-V, --verbose', 'Enable verbose output')
    .addHelpText('after', `
Examples:
  $ manel updates
  $ manel updates --format json
  $ manel updates --format table --output updates.txt`)
    .action(async (options: CommonFlags) => {
      await executeUpdatesCommand(options)
    })
}

// ============================================================================
// 2. Command Execution
// ============================================================================

/**
 * Execute the updates command.
 *
 * Checks for updates and outputs the results.
 *
 * @param options - Parsed CLI options
 * @returns Exit code (0 = success, 2 = error)
 */
export async function executeUpdatesCommand(options: CommonFlags): Promise<number> {
  const startTime = Date.now()
  const ttyInfo = detectTTY()
  const useColor = options.color ?? ttyInfo.useColor
  const format = options.format ?? 'table'
  const version = getPackageVersion()

  const spinner = new Spinner('🔄 Checking for updates...', { enabled: !options.quiet })
  setActiveSpinner(spinner)

  try {
    // Detect technologies
    spinner.step('  Detecting installed technologies...')
    const softwareList = detectAll()

    // Get latest versions
    spinner.step('  Querying version sources...')
    const latestVersions = await getAllLatestVersions()

    // Map to UpdateInfo format
    const updates: UpdateInfo[] = softwareList
      .filter(sw => latestVersions[sw.name] !== undefined)
      .map(sw => {
        const latestVersion = latestVersions[sw.name]
        return {
          technology: sw.name,
          currentVersion: sw.version,
          latestVersion: latestVersion ?? sw.version,
          updateAvailable: latestVersion ? sw.version !== latestVersion : false,
          source: getSourceName(sw.name),
        }
      })

    // Format output
    const formattedOutput = formatOutput(
      { updates } as any,
      format,
      { color: useColor, isTTY: ttyInfo.isTTY, duration: Date.now() - startTime, version }
    )

    // Write output
    if (options.output) {
      const fs = await import('fs/promises')
      await fs.writeFile(options.output, formattedOutput, 'utf-8')
    } else {
      process.stdout.write(formattedOutput)
    }

    spinner.stop('✅ Update check complete')
    return 0
  } catch (err) {
    spinner.stop()
    const duration = Date.now() - startTime
    const error = internalError(
      err instanceof Error ? err.message : 'Unknown error during updates command'
    )

    process.stderr.write(formatErrorForStderr(error, useColor))
    return 2
  }
}

// ============================================================================
// 3. Helper Functions
// ============================================================================

/**
 * Get the source name for a technology.
 */
function getSourceName(name: string): string {
  const sourceMap: Record<string, string> = {
    node: 'nodejs.org',
    npm: 'registry.npmjs.org',
    yarn: 'registry.npmjs.org',
    pnpm: 'registry.npmjs.org',
    git: 'github.com',
    docker: 'github.com',
    'docker-compose': 'github.com',
    python: 'endoflife.date',
    pip: 'pypi.org',
    java: 'endoflife.date',
    maven: 'github.com',
    gradle: 'gradle.org',
    code: 'github.com',
    postgresql: 'endoflife.date',
    mysql: 'endoflife.date',
    mariadb: 'endoflife.date',
    mongodb: 'github.com',
    redis: 'github.com',
    sqlite: 'sqlite.org',
    pgadmin4: 'github.com',
  }

  return sourceMap[name] ?? 'unknown'
}
