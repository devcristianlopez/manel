/**
 * Manel CLI — Status Command
 *
 * Detects all installed technologies and displays their status.
 * Provides a quick overview of the development environment.
 *
 * @module cli/commands/status
 */

import type { Command } from 'commander'
import type { Technology } from '../../shared/types'
import { detectAll, detectOS } from '../../core/scanner'
import { getLatestVersion } from '../../core/update-engine'
import { formatOutput } from '../output'
import type { OutputTechnology } from '../output/types'
import { detectTTY } from '../output'
import type { CommonFlags } from '../flags'
import { successEnvelope, errorEnvelope } from '../errors'
import { internalError, formatErrorForStderr } from '../errors'

// ============================================================================
// 1. Command Registration
// ============================================================================

/**
 * Register the status command with Commander.js.
 *
 * @param program - Commander.js program instance
 */
export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Detect all installed technologies and show their status')
    .option('-f, --format <format>', 'Output format (table, json, sarif, ndjson)', 'table')
    .option('-o, --output <file>', 'Write output to file instead of stdout')
    .option('--no-color', 'Disable ANSI color output')
    .option('-q, --quiet', 'Suppress non-error output')
    .option('-V, --verbose', 'Enable verbose output')
    .option('--no-interactive', 'Disable interactive prompts (for CI/CD)')
    .action(async (options: CommonFlags) => {
      await executeStatusCommand(options)
    })
}

// ============================================================================
// 2. Command Execution
// ============================================================================

/**
 * Execute the status command.
 *
 * Detects all technologies, enriches with latest version info,
 * and outputs in the requested format.
 *
 * @param options - Parsed CLI options
 * @returns Exit code (0 = success)
 */
export async function executeStatusCommand(options: CommonFlags): Promise<number> {
  const startTime = Date.now()
  const ttyInfo = detectTTY()
  const useColor = options.color ?? ttyInfo.useColor
  const format = options.format ?? 'table'

  try {
    // Detect all technologies
    const softwareList = detectAll()
    const osInfo = detectOS()

    // Enrich with latest version info
    const enrichedTechnologies: OutputTechnology[] = await Promise.all(
      softwareList.map(async (sw) => {
        let latestVersion: string | null = null
        try {
          latestVersion = await getLatestVersion(sw.name)
        } catch {
          // Ignore errors for individual technologies
        }

        return {
          name: sw.name,
          version: sw.version,
          detected: true,
          ecosystem: getEcosystemName(sw.name),
          latestVersion: latestVersion ?? undefined,
          updateAvailable: latestVersion ? sw.version !== latestVersion : undefined,
        }
      })
    )

    // Add OS info as first technology
    const osTechnology: OutputTechnology = {
      name: osInfo.distro ?? osInfo.platform,
      version: osInfo.version ?? osInfo.release,
      detected: true,
      ecosystem: 'os',
      latestVersion: undefined,
      updateAvailable: undefined,
    }

    const allTechnologies = [osTechnology, ...enrichedTechnologies]

    // Create response envelope
    const duration = Date.now() - startTime
    const envelope = successEnvelope({ technologies: allTechnologies }, duration)

    // Format output
    const formattedOutput = formatOutput(
      { technologies: allTechnologies } as any,
      format,
      { color: useColor, isTTY: ttyInfo.isTTY, duration, version: '0.1.0' }
    )

    // Write output
    if (options.output) {
      const fs = await import('fs/promises')
      await fs.writeFile(options.output, formattedOutput, 'utf-8')
    } else {
      process.stdout.write(formattedOutput)
    }

    return 0
  } catch (err) {
    const duration = Date.now() - startTime
    const error = internalError(
      err instanceof Error ? err.message : 'Unknown error during status command'
    )
    const envelope = errorEnvelope(error, duration)

    process.stderr.write(formatErrorForStderr(error, useColor))
    return 2
  }
}

// ============================================================================
// 3. Helper Functions
// ============================================================================

/**
 * Get ecosystem name for a technology.
 *
 * @param name - Technology name
 * @returns Ecosystem identifier
 */
function getEcosystemName(name: string): string {
  const ecosystemMap: Record<string, string> = {
    node: 'npm',
    npm: 'npm',
    yarn: 'npm',
    pnpm: 'npm',
    git: 'git',
    docker: 'docker',
    'docker-compose': 'docker',
    python: 'PyPI',
    python3: 'PyPI',
    pip: 'PyPI',
    java: 'Maven',
    maven: 'Maven',
    gradle: 'Maven',
    code: 'VSCode',
    postgresql: 'PostgreSQL',
    mysql: 'MySQL',
    mariadb: 'MySQL',
    mongodb: 'MongoDB',
    redis: 'Redis',
    sqlite3: 'SQLite',
    pgadmin4: 'PostgreSQL',
  }

  return ecosystemMap[name] ?? 'unknown'
}
