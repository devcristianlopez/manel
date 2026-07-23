/**
 * Manel CLI — Entry Point
 *
 * Main entry point for the Manel CLI application.
 * Configures commander.js, parses arguments, and executes commands.
 *
 * @module cli
 */

import { Command } from 'commander'
import { readFileSync } from 'fs'
import { join } from 'path'

// Command imports
import { registerStatusCommand } from './commands/status'
import { registerScanCommand } from './commands/scan'
import { registerVulnerabilitiesCommand } from './commands/vulnerabilities'
import { registerHardeningCommand } from './commands/hardening'
import { registerScoreCommand } from './commands/score'
import { registerUpdatesCommand } from './commands/updates'
import { registerSchemaCommand } from './commands/schema'

// ============================================================================
// 1. Program Setup
// ============================================================================

/**
 * Read package.json to get version.
 *
 * @returns Package version string
 */
function getPackageVersion(): string {
  try {
    const packageJsonPath = join(__dirname, '..', '..', 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
    return packageJson.version || '0.1.0'
  } catch {
    return '0.1.0'
  }
}

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
// 2. Main Execution
// ============================================================================

/**
 * Main CLI entry point.
 *
 * Creates the program, parses arguments, and executes the appropriate command.
 * Handles top-level errors and sets exit codes.
 */
async function main(): Promise<void> {
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
// 3. Exports
// ============================================================================

// Export for programmatic use
export { createProgram }
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
