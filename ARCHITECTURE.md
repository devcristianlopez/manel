# Architecture — Manel

## Overview

Manel is a security CLI for development environments, written in TypeScript. It locally scans installed software, queries vulnerabilities from public sources, and generates a Security Score with actionable recommendations.

## CLI Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI Layer                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  bin/manel-cli.js (Entry Point)                      │  │
│  │  └── src/cli/index.ts (Commander.js setup)           │  │
│  │       ├── commands/status.ts                          │  │
│  │       ├── commands/scan.ts                            │  │
│  │       ├── commands/vulnerabilities.ts                 │  │
│  │       ├── commands/hardening.ts                       │  │
│  │       ├── commands/score.ts                           │  │
│  │       ├── commands/updates.ts                         │  │
│  │       ├── commands/schema.ts                          │  │
│  │       ├── output/ (formatters)                        │  │
│  │       ├── flags.ts                                    │  │
│  │       └── errors.ts                                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Core Layer                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  src/core/                                           │  │
│  │  ├── scanner/     (software detection)               │  │
│  │  ├── security/    (vulnerability analysis)           │  │
│  │  ├── update-engine/ (version checking)               │  │
│  │  └── database/    (SQLite persistence)               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Shared Layer                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  src/shared/types.ts                                 │  │
│  │  (Shared types between CLI and Core)                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

```
Terminal
  │
  manel scan --format json --severity HIGH
  │
  ▼
bin/manel-cli.js
  │
  ▼
src/cli/index.ts (Commander.js)
  │
  ├── Parse flags and options
  │
  ▼
commands/scan.ts
  │
  ├── 1. detectAll() ──────────────────────► scanner/
  │      (Node.js, npm, Python, etc.)           │
  │                                              ▼
  │                                    execSync() to detect
  │                                    installed versions
  │
  ├── 2. analyzeAllTechnologies() ────────► security/
  │      (Query vulnerabilities)                 │
  │                                              ├── queryOSV()
  │                                              ├── queryNVD()
  │                                              └── queryGitHubAdvisory()
  │
  ├── 3. runHardeningChecks() ────────────► security/hardening.ts
  │      (Linux hardening checks)                │
  │                                              ▼
  │                                    Firewall, SELinux, SSH, etc.
  │
  ├── 4. calculateScoreBreakdown() ───────► security/score-engine.ts
  │      (Calculate Security Score)              │
  │
  └── 5. formatOutput() ─────────────────► output/
         (Table, JSON, SARIF, NDJSON)           │
                                                ▼
                                     stdout / file
```

## Modules

### CLI Layer (`src/cli/`)

Responsible for the command-line interface.

| Module | Responsibility |
|--------|----------------|
| `index.ts` | Commander.js setup, command registration |
| `commands/` | Implementation of each command (`status`, `scan`, etc.) |
| `output/` | Output formatters (table, json, sarif, ndjson) |
| `flags.ts` | Shared flags definition and validation |
| `errors.ts` | Error handling and exit codes |

### Core Layer (`src/core/`)

Framework-agnostic business logic.

| Module | Responsibility |
|--------|----------------|
| `scanner/` | Software detection via CLI commands |
| `security/` | Vulnerability analysis and hardening |
| `update-engine/` | Latest version checking from external sources |
| `database/` | SQLite result persistence |

### Shared Layer (`src/shared/`)

Shared types and utilities.

| Module | Responsibility |
|--------|----------------|
| `types.ts` | TypeScript types for the entire project |

## Commander.js Structure

```typescript
// src/cli/index.ts
const program = new Command()
  .name('manel')
  .description('Security Health Monitor for development environments')
  .version(version)

// Command registration
registerStatusCommand(program)
registerScanCommand(program)
registerVulnerabilitiesCommand(program)
registerHardeningCommand(program)
registerScoreCommand(program)
registerUpdatesCommand(program)
registerSchemaCommand(program)
```

### Command Pattern

Each command follows the same pattern:

```typescript
// src/cli/commands/scan.ts
export function registerScanCommand(program: Command): void {
  program
    .command('scan')
    .description('Perform a complete security scan')
    .option('-f, --format <format>', 'Output format', 'table')
    .option('-o, --output <file>', 'Write output to file')
    .option('-s, --severity <levels>', 'Filter by severity')
    .option('--fail-on <severity>', 'Exit code 1 if findings >= severity')
    .option('--no-color', 'Disable colors')
    .option('-q, --quiet', 'Suppress non-error output')
    .option('-V, --verbose', 'Enable verbose output')
    .option('--no-interactive', 'Disable prompts (CI/CD)')
    .action(async (options) => {
      await executeScanCommand(options)
    })
}
```

## Output Engine

### Table Format (default)

```
┌─────────────────────────────────────────────────────────┐
│                    SECURITY SCAN                        │
├─────────────────────────────────────────────────────────┤
│  Score: 72/100  │  Vulnerabilities: 3  │  Hardening: 5/7│
└─────────────────────────────────────────────────────────┘

Technology     Version    Status    Ecosystem
─────────────────────────────────────────────────────
node           20.10.0    green     npm
python         3.12.1     yellow    PyPI
postgresql     15.4       red       PostgreSQL
```

### JSON Format

```json
{
  "technologies": [...],
  "vulnerabilities": [...],
  "hardening": [...],
  "score": {
    "overall": 72,
    "breakdown": {
      "os": 85,
      "hardening": 71,
      "tools": 90,
      "dependencies": 65,
      "databases": 80,
      "criticalsPenalty": -10
    }
  },
  "summary": {
    "totalTechnologies": 15,
    "detectedTechnologies": 12,
    "totalVulnerabilities": 3,
    "criticalVulnerabilities": 1,
    "highVulnerabilities": 2,
    "hardeningPassRate": 71
  }
}
```

### SARIF Format

```json
{
  "version": "2.1.0",
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
  "runs": [{
    "tool": {
      "driver": {
        "name": "manel",
        "version": "1.0.0",
        "rules": [...]
      }
    },
    "results": [...]
  }]
}
```

### NDJSON Format

```json
{"type":"technology","name":"node","version":"20.10.0","ecosystem":"npm"}
{"type":"vulnerability","id":"CVE-2024-12345","severity":"HIGH","affectedPackage":"node"}
{"type":"hardening","id":"firewall-active","status":"pass","severity":"MEDIUM"}
{"type":"score","overall":72,"breakdown":{...}}
{"type":"meta","timestamp":"2026-07-22T10:00:00Z","totalTechnologies":15}
```

## Core Types

### ResponseEnvelope

```typescript
interface ResponseEnvelope<T> {
  ok: boolean
  data: T | null
  error: CliError | null
  warnings: string[]
  meta: {
    timestamp: string
    duration: number
    version: string
  }
}
```

### ScanResult

```typescript
interface ScanResult {
  technologies: Technology[]
  vulnerabilities: Vulnerability[]
  hardening: HardeningResult[]
  score: SecurityScore
  summary: ScanSummary
}
```

### Technology

```typescript
interface Technology {
  name: string
  version: string | null
  detected: boolean
  ecosystem: string
  latestVersion?: string
  updateAvailable?: boolean
}
```

### Vulnerability

```typescript
interface Vulnerability {
  id: string
  source: 'OSV' | 'NVD' | 'GHSA'
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'
  title: string
  description: string
  affectedPackage: string
  affectedVersions: string
  fixedVersion?: string
  cvssScore?: number
  cveId?: string
  references: string[]
}
```

## Security Score

### Weighting

| Category | Weight | Source |
|----------|--------|--------|
| Operating System | 15% | Detection + endoflife.date |
| Hardening | 15% | 7 Linux security checks |
| Tools | 10% | Git, Docker, VS Code |
| Dependencies | 30% | Node.js, Python, Java |
| Databases | 10% | PostgreSQL, MySQL, MongoDB, Redis |
| Critical vulnerabilities | 20% | OSV + NVD + GHSA |

### Calculation

```
Category Score = average(individual_scores)
  - green = 100
  - yellow = 60
  - red = 25
  - black = 0

Overall = OS(15%) + Hardening(15%) + Tools(10%) + Deps(30%) + DBs(10%) - Criticals(20%)
```

## Technical Decisions

### ADR-001: Pure CLI with Commander.js

- **Context**: Need for a security tool that works in any environment without UI dependencies.
- **Decision**: Use Commander.js as CLI framework, TypeScript as language, CommonJS as module system.
- **Consequences**:
  + Works in any terminal without GUI dependencies
  + Easy to integrate into CI/CD
  + Structured output (JSON, SARIF) for external tools
  - No interactive graphical interface

### ADR-002: Three-layer architecture

- **Context**: Separate concerns between CLI, business logic, and shared types.
- **Decision**: Three-layer architecture: CLI, Core, Shared.
- **Consequences**:
  + Core is framework-agnostic (can be used with any UI)
  + Shared types prevent circular dependencies
  + Easier testing through separation of responsibilities

### ADR-003: CommonJS modules

- **Context**: Need for compatibility with Node.js 18+ and existing tools.
- **Decision**: Use CommonJS (`module: "CommonJS"` in tsconfig).
- **Consequences**:
  + Compatibility with `require()` in Node.js
  + Works with `node bin/manel-cli.js` directly
  - Cannot use standard `import`/`export` without transpilation

### ADR-004: SQLite for persistence

- **Context**: Need to store scan history without external infrastructure.
- **Decision**: better-sqlite3 (synchronous, embedded) with WAL mode.
- **Consequences**:
  + No external dependencies
  + Self-contained database
  + WAL allows concurrent reads

### ADR-005: Output formats

- **Context**: Different users need different output formats.
- **Decision**: Support table, JSON, SARIF and NDJSON.
- **Consequences**:
  + Table for interactive terminal
  + JSON for scripts and APIs
  + SARIF for SAST tools (GitHub Code Scanning)
  + NDJSON for streaming and pipes

## Database

### Schema (SQLite)

The database is stored at `~/.manel/manel.db` with WAL mode and foreign keys enabled.

```sql
-- Executed scans
CREATE TABLE scans (
  id            TEXT PRIMARY KEY,
  date          INTEGER NOT NULL,          -- Unix timestamp
  score         INTEGER,                   -- Security Score (0-100)
  critical_count INTEGER DEFAULT 0,
  high_count    INTEGER DEFAULT 0,
  medium_count  INTEGER DEFAULT 0,
  low_count     INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'pending'     -- pending | scanning | completed | failed
);

-- Software detected in each scan
CREATE TABLE software (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,               -- Normalized name (node, npm, git, etc.)
  version     TEXT NOT NULL,
  path        TEXT,                        -- Detected binary path
  detected_at INTEGER NOT NULL,            -- Unix timestamp
  scan_id     TEXT,                        -- FK -> scans(id)
  FOREIGN KEY (scan_id) REFERENCES scans(id)
);

-- Vulnerabilities found per software
CREATE TABLE vulnerabilities (
  id           TEXT PRIMARY KEY,
  cve          TEXT,                       -- CVE identifier or alias
  severity     TEXT NOT NULL,              -- CRITICAL | HIGH | MEDIUM | LOW | NONE
  description  TEXT,
  software_id  TEXT NOT NULL,              -- FK -> software(id)
  fixed_version TEXT,                      -- Version where it was fixed
  source       TEXT,                       -- OSV | NVD | GHSA
  FOREIGN KEY (software_id) REFERENCES software(id)
);

-- Hardening results
CREATE TABLE hardening_results (
  id          TEXT PRIMARY KEY,
  scan_id     TEXT,                        -- FK -> scans(id)
  check_id    TEXT NOT NULL,               -- Check identifier
  category    TEXT NOT NULL,               -- Check category
  title       TEXT NOT NULL,               -- Check title
  status      TEXT NOT NULL,               -- pass | fail | warning | error
  severity    TEXT NOT NULL,               -- CRITICAL | HIGH | MEDIUM | LOW
  details     TEXT,                        -- Result details
  FOREIGN KEY (scan_id) REFERENCES scans(id)
);

-- Latest-version cache (avoids re-hitting version APIs)
CREATE TABLE version_cache (
  tech_name      TEXT PRIMARY KEY,         -- Technology name (node, npm, git, ...)
  latest_version TEXT NOT NULL,
  fetched_at     INTEGER NOT NULL          -- Unix ms; entries expire after 24h
);

-- Vulnerability query cache (avoids re-hitting OSV/NVD/GHSA)
CREATE TABLE vulnerability_cache (
  cache_key  TEXT PRIMARY KEY,             -- ecosystem:package:version
  data       TEXT NOT NULL,                -- JSON array of CoreVulnerability
  fetched_at INTEGER NOT NULL              -- Unix ms; entries expire after 24h
);

-- Offline vulnerability database (synced from OSV data dumps)
CREATE TABLE vuln_db (
  id           TEXT NOT NULL,              -- GHSA-xxxx / CVE-xxxx
  ecosystem    TEXT NOT NULL,              -- npm | PyPI | Maven
  package_name TEXT NOT NULL,              -- lowercase
  aliases      TEXT,                       -- JSON array (CVE ids)
  severity     TEXT NOT NULL,              -- CRITICAL | HIGH | MEDIUM | LOW | NONE
  summary      TEXT,
  events       TEXT,                       -- JSON: [{introduced, fixed, last_affected}, ...]
  versions     TEXT,                       -- JSON array of explicit versions
  PRIMARY KEY (id, ecosystem, package_name)
);
CREATE INDEX idx_vuln_db_pkg ON vuln_db(ecosystem, package_name);

-- Offline sync state per ecosystem
CREATE TABLE sync_metadata (
  ecosystem   TEXT PRIMARY KEY,
  synced_at   INTEGER NOT NULL,            -- Unix ms
  entry_count INTEGER NOT NULL
);

-- Negative cache for failing APIs (rate limits, outages)
CREATE TABLE api_failures (
  api_key   TEXT PRIMARY KEY,              -- e.g. 'version:node'
  failed_at INTEGER NOT NULL               -- Unix ms; retried after 15 min
);
```

### Caching Strategy

The CLI uses a **two-tier cache** for external API data:

1. **In-memory** (fast path): versions 30 min, vulnerabilities 1 h
2. **SQLite** (persistent): both 24 h, survives process restarts

On a memory miss, caches fall back to SQLite and warm the memory entry on a
hit. Results are only cached on successful queries; empty vulnerability
results *are* cached (a clean package is a valid answer).

The database path defaults to `~/.manel/manel.db` and can be overridden with
the `MANEL_DB_PATH` environment variable (useful for tests). Initialization
happens in `createProgram()`; failures are non-fatal — the CLI keeps working
without persistence.

### Offline Mode (OSV sync)

`manel sync` downloads OSV per-ecosystem data dumps
(`https://osv-vulnerabilities.storage.googleapis.com/{ecosystem}/all.zip`)
and indexes them into `vuln_db`. Query resolution order in
`queryAllSources`:

1. **Local DB** — if `sync_metadata` shows a sync fresher than 7 days, the
   query is answered locally (zero network).
2. **Response cache** — `vulnerability_cache` (24 h).
3. **Live APIs** — OSV + NVD + GHSA in parallel; results cached only if at
   least one source succeeded (API failures never cached as "clean").

`--offline` on `scan`/`vulnerabilities` forces path 1 and also skips version
lookups entirely. `getLatestVersion` consults `api_failures` before fetching
and records failures there (15 min negative TTL).

### Relationships

```
scans (1) ──── (N) software (1) ──── (N) vulnerabilities
   │
   └──── (N) hardening_results
```

## Full Scan Flow

### 1. Argument Parsing

Commander.js parses command-line arguments and extracts flags.

### 2. Detection

The scanner executes system commands via `execSync()`:

```typescript
// Example: detect Node.js
const result = execSync('node -v', { encoding: 'utf-8' })
// Result: "v20.10.0"
```

### 3. Vulnerability Analysis

For each detected software, the security engine:

1. Determines the ecosystem (npm, PyPI, Maven)
2. Queries vulnerabilities in parallel from OSV, NVD and GHSA
3. Deduplicates results by CVE
4. Determines the status (green/yellow/red/black)

### 4. Hardening Checks (Linux)

Executes 7 security checks:

- Active firewall
- SELinux enabled
- SSH root login disabled
- Unnecessary ports closed
- Pending updates
- Sensitive file permissions
- Unnecessary services disabled

### 5. Score Calculation

Calculates the weighted score based on:

- OS status
- Hardening results
- Tools status
- Dependencies status
- Databases status
- Critical vulnerabilities penalty

### 6. Output Formatting

Selects the formatter based on the `--format` flag:

- **table**: `src/cli/output/table-formatter.ts`
- **json**: `src/cli/output/json-formatter.ts`
- **sarif**: `src/cli/output/sarif-formatter.ts`
- **ndjson**: `src/cli/output/ndjson-formatter.ts`

### 7. Writing

Writes the result to stdout or file based on `--output`.

## Update Engine Sources

| Technology | Source | Parse |
|-----------|--------|-------|
| Node.js | `nodejs.org/dist/index.json` | Latest LTS version |
| npm | `registry.npmjs.org/npm/latest` | `version` field |
| Yarn | `registry.npmjs.org/yarn/latest` | `version` field |
| pnpm | `registry.npmjs.org/pnpm/latest` | `version` field |
| Git | `api.github.com/repos/git/git/releases/latest` | `tag_name` |
| Docker | `api.github.com/repos/docker/docker-ce/releases/latest` | `tag_name` |
| Docker Compose | `api.github.com/repos/docker/compose/releases/latest` | `tag_name` |
| Python | `endoflife.date/api/python/latest.json` | `latest` field |
| pip | `pypi.org/pypi/pip/json` | `info.version` |
| Java | `endoflife.date/api/java.json` | Latest LTS version |
| Maven | `api.github.com/repos/apache/maven/releases/latest` | `tag_name` (strip `maven-`) |
| Gradle | `services.gradle.org/versions/current` | `version` field |
| VS Code | `api.github.com/repos/microsoft/vscode/releases/latest` | `tag_name` |
| Ubuntu, Debian, Fedora, macOS, Windows | `endoflife.date/api/<os>.json` | Latest available cycle |

## Detectable Technologies

| Detector | Command | Ecosystem | Version Source |
|----------|---------|-----------|----------------|
| OS | `process.platform` + `/etc/os-release` | — | endoflife.date |
| Node | `node -v` | npm | nodejs.org |
| npm | `npm -v` | npm | npm registry |
| Yarn | `yarn -v` | npm | npm registry |
| pnpm | `pnpm -v` | npm | npm registry |
| Git | `git --version` | — | GitHub Releases |
| Docker | `docker --version` | — | GitHub Releases |
| Docker Compose | `docker-compose --version` | — | GitHub Releases |
| Python | `python --version` | PyPI | endoflife.date |
| Python3 | `python3 --version` | PyPI | endoflife.date |
| pip | `pip --version` | PyPI | PyPI |
| Java | `java -version` | Maven | endoflife.date |
| Maven | `mvn --version` | Maven | GitHub Releases |
| Gradle | `gradle --version` | Maven | Gradle Services |
| VS Code | `code --version` | — | GitHub Releases |
| PostgreSQL | `psql --version` | PostgreSQL | PostgreSQL |
| MySQL | `mysql --version` | MySQL | MySQL |
| MariaDB | `mariadb --version` | MySQL | MariaDB |
| MongoDB | `mongod --version` | MongoDB | MongoDB |
| Redis | `redis-cli --version` | Redis | Redis |
| SQLite | `sqlite3 --version` | SQLite | SQLite |
| PgAdmin | `pgadmin4 --version` | PostgreSQL | PostgreSQL