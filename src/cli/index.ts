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

// ============================================================================
// 1. Program Setup
// ============================================================================

/**
 * Create and configure the CLI program.
 *
 * @returns Configured Commander.js program
 */
function createProgram(): Command {
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
// 2. Signal Handling
// ============================================================================

/**
 * Install signal handlers for graceful shutdown.
 * Stops any active spinner and exits with appropriate code.
 */
function installSignalHandlers(): void {
  process.on('SIGINT', () => {
    stopActiveSpinner()
    process.exit(130) // Standard exit code for SIGINT
  })

  process.on('SIGTERM', () => {
    stopActiveSpinner()
    process.exit(143) // Standard exit code for SIGTERM
  })
}

// ============================================================================
// 3. Main Execution
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
// 4. Exports
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
