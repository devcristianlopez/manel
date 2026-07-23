#!/usr/bin/env node
/**
 * Manel CLI — Entry Point
 *
 * Thin wrapper that loads the compiled CLI framework.
 * The actual CLI logic is in src/cli/index.ts (compiled to out/cli/).
 */

const path = require('path')
const fs = require('fs')

// Find the compiled CLI entry point
const cliPath = path.join(__dirname, '..', 'out', 'cli', 'src', 'cli', 'index.js')

// Check if compiled CLI exists
if (fs.existsSync(cliPath)) {
  // Load the CLI and create/run the program
  const { createProgram } = require(cliPath)
  const program = createProgram()
  program.parseAsync(process.argv).catch((err) => {
    if (err instanceof Error && err.message.includes('outputHelp')) {
      process.exit(0)
    }
    console.error('Fatal error:', err)
    process.exit(2)
  })
} else {
  // Fallback: show error message
  console.error('\x1b[31mError: CLI not built.\x1b[0m')
  console.error('\x1b[2mRun "npm run build:cli" first to compile the CLI.\x1b[0m')
  process.exit(2)
}
