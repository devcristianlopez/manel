# Manel — Security Health Monitor CLI

Manel is a security CLI for development environments that locally scans installed software (OS, tools, languages, databases), queries known vulnerabilities from public sources (OSV, NVD, GitHub Advisories), and generates a Security Score (0-100) with actionable recommendations.

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)]()
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)]()

## Quick Start

```bash
# Global installation
npm install -g manel

# Or run directly
npx manel scan

# Quick status check
manel status
```

## Installation

### Prerequisites

- **Node.js 18+** — Download from [nodejs.org](https://nodejs.org/)
- **npm** — Included with Node.js
- **Git** — For installing from source

```bash
# Check versions
node --version   # Should show v18.x.x or higher
npm --version
git --version
```

### Method 1: From npm (recommended)

```bash
npm install -g manel
```

### Method 2: Automatic installation script

```bash
# Clone the repository
git clone https://github.com/devcristianlopez/manel.git
cd manel

# Run installer
bash setup.sh

# Or with development mode (includes test tools)
bash setup.sh --dev
```

The installation script:
- ✅ Detects your operating system
- ✅ Verifies/installs Node.js 18+
- ✅ Installs dependencies
- ✅ Compiles the CLI
- ✅ Links the `manel` command globally
- ✅ Verifies the installation

### Method 3: Manual installation

```bash
git clone https://github.com/devcristianlopez/manel.git
cd manel
npm install
npm run build:cli
npm link
```

### Method 4: npx (without installing)

```bash
npx manel scan
```

### Available npm scripts

```bash
npm run install:global   # Compile and install globally
npm run uninstall:global # Uninstall globally
npm run setup           # Run bash setup.sh
npm run uninstall       # Run bash uninstall.sh
```

### Verify installation

```bash
manel --version
manel status
```

### Supported operating systems

- ✅ Linux (Ubuntu, Debian, Fedora, Arch)
- ✅ macOS
- ⚠️ Windows (manual installation)

## Uninstallation

### Method 1: Uninstallation script (recommended)

```bash
# If you are in the project directory
bash uninstall.sh

# Or with the path to the project
/path/to/manel/uninstall.sh
```

Script options:
```bash
bash uninstall.sh --help   # Show help
bash uninstall.sh --yes    # Skip confirmations
bash uninstall.sh --all    # Also remove installation directory
```

### Method 2: npm

```bash
npm uninstall -g manel
```

### Method 3: Manual

```bash
# Remove global link
npm unlink -g manel

# Or remove the executable directly
rm -f $(which manel)
```

### After uninstalling

```bash
# Refresh shell cache
hash -r
```

## Commands

| Command | Description |
|---------|-------------|
| `manel status` | Quick status of installed technologies |
| `manel scan` | Full scan: vulnerabilities + hardening + score |
| `manel vulnerabilities` | Vulnerabilities only (alias: `vulns`) |
| `manel hardening` | Hardening checks only (Linux) |
| `manel score` | Detailed security score |
| `manel updates` | Check for available updates |
| `manel schema` | CLI introspective JSON (AI-friendly) |

### Usage examples

```bash
# Quick status
manel status

# Full scan with JSON output
manel scan --format json

# Critical and high vulnerabilities only
manel vulnerabilities --severity CRITICAL,HIGH

# Hardening with output to file
manel hardening --output report.txt

# Detailed score without colors
manel score --no-color

# Check for available updates
manel updates --format json
```

## Standard Flags

All commands support the following flags:

| Flag | Description |
|------|-------------|
| `-f, --format <format>` | Output format: `table`, `json`, `sarif`, `ndjson` |
| `-o, --output <file>` | Write output to file instead of stdout |
| `-s, --severity <levels>` | Filter by severity (comma-separated) |
| `--fail-on <severity>` | Exit with code 1 if findings >= severity |
| `--no-color` | Disable ANSI color output |
| `-q, --quiet` | Suppress non-error output |
| `-V, --verbose` | Enable verbose output |
| `--no-interactive` | Disable interactive prompts (for CI/CD) |

### Output Formats

| Format | Description | Recommended use |
|--------|-------------|-----------------|
| `table` | Formatted table with colors (default) | Interactive terminal |
| `json` | Pretty-printed JSON | APIs, scripts, debugging |
| `sarif` | Static Analysis Results Interchange Format | GitHub Code Scanning, SAST tools |
| `ndjson` | Newline-delimited JSON | Pipes, streaming, batch processing |

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success, no findings |
| `1` | Findings detected (vulnerabilities, hardening failures) |
| `2` | Internal error |
| `3` | Invalid input |

## CI/CD Examples

### GitHub Actions

```yaml
name: Security Scan
on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g manel
      - name: Run security scan
        run: manel scan --format sarif --output scan-results.sarif --no-interactive
      - name: Upload SARIF to GitHub
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: scan-results.sarif
```

### Pipeline with fail-on

```yaml
- name: Security gate
  run: manel scan --fail-on high --no-interactive --format json
```

### Vulnerabilities-only scan

```yaml
- name: Check vulnerabilities
  run: manel vulns --severity CRITICAL,HIGH --format ndjson | jq '.severity'
```

## Pipe Examples

```bash
# Extract critical vulnerabilities
manel scan --format json | jq '.vulnerabilities[] | select(.severity == "CRITICAL")'

# Count vulnerabilities by severity
manel scan --format json | jq '[.vulnerabilities[].severity] | group_by(.) | map({(.[0]): length}) | add'

# Filter outdated technologies
manel scan --format json | jq '.technologies[] | select(.updateAvailable == true)'

# Send results to a logging service
manel scan --format ndjson | while read line; do echo "$line" | curl -X POST -d @- https://api.example.com/logs; done

# Generate SARIF report and upload to GitHub
manel scan --format sarif -o results.sarif

# Check score only
manel score --format json | jq '.overall'
```

## Security Score

The score is calculated with the following weighting:

| Category | Weight |
|----------|--------|
| Operating System | 15% |
| Hardening | 15% |
| Tools | 10% |
| Dependencies | 30% |
| Databases | 10% |
| Critical vulnerabilities | 20% |

## Detectable Technologies

- **Languages and runtimes**: Node.js, Python, Python 3, Java
- **Package managers**: npm, Yarn, pnpm, pip, Maven, Gradle
- **Tools**: Git, Docker, Docker Compose, VS Code
- **Databases**: PostgreSQL, MySQL, MariaDB, MongoDB, Redis, SQLite, pgAdmin
- **Operating systems**: Ubuntu, Debian, Fedora, macOS, Windows

## Introspective Schema

The `schema` command generates a JSON describing the entire CLI interface, useful for AI tools and documentation generation:

```bash
manel schema | jq '.commands[] | .name'
```

## Development

```bash
# Install dependencies
npm install

# Build CLI
npm run build:cli

# Run in development
node bin/manel-cli.js scan

# Run tests
npm test

# Type checking
npm run lint
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| CLI Framework | Commander.js 15 |
| Language | TypeScript 5 |
| Runtime | Node.js 18+ |
| Database | SQLite (better-sqlite3) |
| Tests | Vitest |
| External APIs | OSV, NVD, GitHub Security Advisories, npm registry, PyPI, endoflife.date |

## Project Structure

```
manel/
├── bin/
│   └── manel-cli.js           # CLI entry point
├── src/
│   ├── cli/                   # CLI framework
│   │   ├── commands/          # Command implementations
│   │   ├── output/            # Formatters (table, json, sarif, ndjson)
│   │   ├── flags.ts           # Shared flags
│   │   ├── errors.ts          # Error handling
│   │   └── index.ts           # Main entry point
│   ├── core/                  # Business logic
│   │   ├── scanner/           # Software detection
│   │   ├── security/          # Security engine
│   │   ├── update-engine/     # Version checking
│   │   ├── database/          # SQLite persistence
│   │   └── index.ts           # Barrel export
│   └── shared/                # Shared types
│       └── types.ts
├── package.json
├── tsconfig.cli.json          # TypeScript config for CLI
└── vitest.config.ts
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed technical documentation.

## Data Sources

- [OSV](https://osv.dev) — Open Source Vulnerabilities database
- [NVD](https://nvd.nist.gov) — National Vulnerability Database (USA)
- [GitHub Security Advisories](https://github.com/advisories) — Advisory Database
- [End of Life](https://endoflife.date) — Software support dates
- [npm registry](https://registry.npmjs.org) — Latest npm package versions
- [PyPI](https://pypi.org) — Latest Python package versions
- [GitHub Releases](https://api.github.com) — Latest GitHub project releases

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development and contribution guidelines.

## License

MIT