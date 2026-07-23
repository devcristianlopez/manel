/**
 * Manel CLI — Entry Point
 *
 * Main entry point for the Manel CLI application.
 * Configures commander.js, parses arguments, and executes commands.
 *
 * @module cli
 */

import { Command } from 'commander'

// Command imports
import { registerStatusCommand } from './commands/status'
import { registerScanCommand } from './commands/scan'
import { registerVulnerabilitiesCommand } from './commands/vulnerabilities'
import { registerHardeningCommand } from './commands/hardening'
import { registerScoreCommand } from './commands/score'
import { registerUpdatesCommand } from './commands/updates'
import { registerSchemaCommand } from './commands/schema'

// Utilities
import { getPackageVersion } from './version'
import { stopActiveSpinner } from './spinner'

// Database
import { initDatabase, closeDatabase } from '../core/database'
import { mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

// ============================================================================
// 1. Database Setup
// ============================================================================

/** Whether the database has been initialized in this process */
let dbInitialized = false

/**
 * Initialize the SQLite database (idempotent).
 *
 * Path resolution order:
 * 1. MANEL_DB_PATH environment variable (useful for tests)
 * 2. ~/.manel/manel.db (default)
 *
 * Initialization failures are non-fatal: the CLI continues to work
 * without persistence (caches degrade to in-memory only).
 */
function ensureDatabase(): void {
  if (dbInitialized) return
  dbInitialized = true

  try {
    const envPath = process.env.MANEL_DB_PATH
    const dbPath = envPath ?? join(homedir(), '.manel', 'manel.db')
    if (!envPath) {
      mkdirSync(join(homedir(), '.manel'), { recursive: true })
    }
    initDatabase(dbPath)
  } catch (err) {
    console.error('[manel] Database initialization failed, persistence disabled:', err instanceof Error ? err.message : err)
  }
}

// ============================================================================
// 2. Program Setup
// ============================================================================

/**
 * Create and configure the CLI program.
 *
 * @returns Configured Commander.js program
 */
function createProgram(): Command {
  ensureDatabase()

  const program = new Command()
  const version = getPackageVersion()

  program
    .name('manel')
    .description('Security Health Monitor for development environments')
    .version(version, '-v, --version', 'Output the version number')

  // Register all commands
  registerStatusCommand(program)
  registerScanCommand(program)
  registerVulnerabilitiesCommand(program)
  registerHardeningCommand(program)
  registerScoreCommand(program)
  registerUpdatesCommand(program)
  registerSchemaCommand(program)

  return program
}

// ============================================================================
// 3. Signal Handling
// ============================================================================

/**
 * Install signal handlers for graceful shutdown.
 * Stops any active spinner and exits with appropriate code.
 */
function installSignalHandlers(): void {
  process.on('SIGINT', () => {
    stopActiveSpinner()
    closeDatabase()
    process.exit(130) // Standard exit code for SIGINT
  })

  process.on('SIGTERM', () => {
    stopActiveSpinner()
    closeDatabase()
    process.exit(143) // Standard exit code for SIGTERM
  })
}

// ============================================================================
// 4. Main Execution
// ============================================================================

/**
 * Main CLI entry point.
 *
 * Creates the program, parses arguments, and executes the appropriate command.
 * Handles top-level errors and sets exit codes.
 */
async function main(): Promise<void> {
  installSignalHandlers()

  const program = createProgram()

  try {
    await program.parseAsync(process.argv)
  } catch (err) {
    // Commander.js throws on --help, --version, or parse errors
    // These are expected and should not produce error output
    if (err instanceof Error && err.message.includes('outputHelp')) {
      process.exit(0)
    }

    // Unexpected error
    console.error('Fatal error:', err)
    process.exit(2)
  }
}

// ============================================================================
// 5. Exports
// ============================================================================

// Export for programmatic use
export { createProgram }
export { getPackageVersion }
export { registerStatusCommand }
export { registerScanCommand }
export { registerVulnerabilitiesCommand }
export { registerHardeningCommand }
export { registerScoreCommand }
export { registerUpdatesCommand }
export { registerSchemaCommand }

// Run if executed directly
if (require.main === module) {
  main()
}
