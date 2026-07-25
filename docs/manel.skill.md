---
name: manel
description: >-
  Use when you need to assess the security posture of a development machine:
  detect installed technologies, scan for CVEs, run hardening checks,
  calculate a security score, check for updates, sync the offline vulnerability
  database, or review scan history. Works for both humans and AI agents
  (structured JSON output, machine-readable schema, predictable exit codes).
---

# Manel — Security Health Monitor CLI

Manel is a TypeScript CLI that gives a **system-wide security snapshot** of a
development machine in a single command. It detects 21 technologies, queries
CVE databases (OSV / NVD / GitHub Advisory), runs Linux hardening checks, and
produces a composite security score — all with structured output usable by
humans, CI pipelines, and AI agents.

Current version: **v1.2.x** (semantic-release, auto-versioned)
Repository: `git@github.com:devcristianlopez/manel.git`
Platforms: **Linux and macOS only** (no Windows support)
Landing: https://devcristianlopez.github.io/manel/

---

## 1. What Manel does

| Capability | Command | Details |
|---|---|---|
| Detect installed technologies | `manel status` | 21 detectors: node, npm, python, java, docker, git, postgres, mysql, mongo, redis, etc. |
| Full security scan | `manel scan` | Detection + CVEs + hardening + score, persisted to local DB |
| Vulnerability analysis | `manel vulns` | CVEs from OSV, NVD, GitHub Advisory (multi-source) |
| Hardening checks | `manel hardening` | Linux-only: kernel, SSH, firewall, permissions, auditd, etc. |
| Security score | `manel score` | Weighted composite score with traffic light (green/yellow/red) |
| Update check | `manel updates` | Latest versions for installed tech (LTS detection for Node) |
| Scan history | `manel history` | Past scans stored in local SQLite |
| Offline DB sync | `manel sync` | Downloads OSV dumps for fully-offline CVE queries |
| AI/agent schema | `manel schema` | Machine-readable JSON describing all commands, flags, outputs |

### What Manel is NOT

- Not a container/IaC/Kubernetes scanner (use Trivy for that)
- Not a hardening *enforcer* — it checks but does not apply changes
- Not a fix-PR bot (use Dependabot/Renovate for that)
- Not a SAST/DAST tool — it finds CVEs in dependencies, not bugs in your code

---

## 2. Installation

```bash
git clone git@github.com:devcristianlopez/manel.git
cd manel
npm install
npm run build:cli      # compiles TS -> out/cli/
npm run install:global # npm link — makes `manel` available system-wide
```

Binary entry point: `bin/manel-cli.js` -> `out/cli/index.js` (CommonJS, Node 22+).

Verify:

```bash
manel --version        # e.g. 1.2.1
manel status           # quick smoke test
```

---

## 3. Command reference

### Global flags (all commands)

| Flag | Short | Description |
|---|---|---|
| `--format <fmt>` | `-f` | `table` (default) \| `json` \| `sarif` \| `ndjson` |
| `--output <file>` | `-o` | Write output to file instead of stdout |
| `--no-color` | | Disable ANSI colors (also respects `NO_COLOR` env) |
| `--quiet` | `-q` | Suppress non-error output |
| `--verbose` | | Enable verbose/diagnostic output |

### `manel status`

Detect all installed technologies and show versions + update availability.

```bash
manel status
manel status --format json | jq '.data.technologies[] | {name, version}'
```

### `manel scan` — the main command

Full pipeline: detect -> query CVEs -> hardening checks -> compute score -> persist to history.

```bash
manel scan                                    # human table
manel scan --format json                      # structured JSON
manel scan --format sarif -o results.sarif    # GitHub Code Scanning
manel scan --fail-on HIGH                     # exit 1 if HIGH+ findings (CI gate)
manel scan --severity HIGH,CRITICAL           # only show these severities
manel scan --offline                          # zero network, local DB only
```

Extra flags: `--offline`, `--fail-on <LEVEL>`, `--severity <CSV>`.

### `manel vulnerabilities` (alias: `manel vulns`)

CVE analysis only (no hardening, no score).

```bash
manel vulns --format json | jq '.data.vulnerabilities[] | select(.severity=="CRITICAL")'
manel vulns --offline --format ndjson
```

### `manel hardening`

Linux-only system hardening checks (SSH config, kernel params, firewall, etc.).

```bash
manel hardening                     # all checks
manel hardening --fail-on HIGH      # gate on failing checks
```

On non-Linux: exits gracefully with a platform notice (not an error).

### `manel score`

Composite score 0-100 with breakdown (os / tools / databases / dependencies)
and traffic light: green >=80, yellow 50-79, red <50.

```bash
manel score --format json | jq '.data.score, .data.trafficLight'
```

### `manel updates`

Check latest versions (LTS for Node.js). Results cached 24h in SQLite.

```bash
manel updates --format table
```

### `manel sync` — CVE database updates

Downloads public **OSV.dev** dumps from Google's servers
(`osv-vulnerabilities.storage.googleapis.com`) and indexes them into
`~/.manel/manel.db` (table `vuln_db`). **This is how CVE data gets updated.**

```bash
manel sync                            # auto-detect ecosystems from installed software
manel sync --ecosystem npm,PyPI       # specific ecosystems
manel sync --ecosystem Maven --force  # re-sync even if fresh (<24h)
```

Dump sizes: **npm ~200 MB**, PyPI ~31 MB, Maven ~9 MB. First sync takes a few
minutes. Re-run **weekly** — Manel trusts local data for 7 days, then falls
back to live APIs.

### `manel history`

List past scans (persisted by `scan` and `vulns` commands).

```bash
manel history                       # recent scans, table
manel history --last 20 --format json
```

### `manel schema`

Machine-readable description of the whole CLI — commands, flags, output
shapes, examples. **The entry point for AI agents.**

```bash
manel schema --format json   # full schema
```

Use this first when integrating Manel into an agentic workflow.

---

## 4. Exit codes

| Code | Meaning | Use in CI |
|---|---|---|
| `0` | OK — no findings at/above threshold | Pass |
| `1` | FINDINGS — vulns/hardening failures at/above `--fail-on` severity | Fail the pipeline |
| `2` | ERROR — internal failure (network, DB, unexpected) | Fail with investigation |
| `3` | INVALID_INPUT — bad flags/arguments | Fix invocation |

CI gate pattern:

```bash
manel scan --fail-on HIGH --format json -o scan.json || {
  code=$?
  [ $code -eq 1 ] && echo "Security findings!" && exit 1
  [ $code -ge 2 ] && echo "Manel itself failed" && exit $code
}
```

---

## 5. Output formats

- **table** — human, Unicode borders in TTY, ASCII in pipes (auto-detected)
- **json** — envelope `{ ok, data, error?, warnings?, meta }` with ISO timestamps; compact when piped, pretty in TTY
- **sarif** — SARIF 2.1.0 for GitHub Code Scanning / IDEs (severity mapped to error/warning/note, fix suggestions, fingerprints)
- **ndjson** — one JSON object per line: `meta` first, then `technology` / `vulnerability` / `hardening` lines, `score` last. Stream-friendly:

```bash
manel scan -f ndjson | grep '"type":"vulnerability"'
```

Cross-format consistency is guaranteed: same scan produces the same
tech/vuln/score counts in JSON, SARIF and NDJSON.

---

## 6. How CVE data works (critical to understand)

Resolution order inside the vulnerability engine (`queryAllSources`):

1. **Local OSV DB** (`vuln_db` table) — if synced within 7 days, used directly. Zero network.
2. **Response cache** (`vulnerability_cache` table, 24h TTL) — previous API answers.
3. **Live APIs** — OSV -> NVD -> GitHub Advisory, in order. Results are persisted to the cache.

Important guarantees:

- **Errors are never cached as "clean"**: if all API sources fail, the error propagates and nothing is cached — the next run retries.
- **Empty results ARE cached**: a package with no vulnerabilities is a valid answer (24h), preventing repeated API hits.
- **`--offline` forces step 1 only**: pure local DB, zero network. If no sync exists, results will be empty/incomplete — always sync before relying on offline mode.
- **Version matching is semantic**: OSV lists `4.2` where pip reports `4.2.0`; Manel compares numeric segments (missing = 0), so both match. Prerelease tags fall back to string equality.

Ecosystem mapping (relevant subset): node/npm/yarn/pnpm -> `npm`, python/pip -> `PyPI`, java/mvn/gradle -> `Maven`. Databases (postgres, mysql, mongo, redis) are queried under the `npm` ecosystem namespace.

---

## 7. Caching architecture (two-tier + negative)

| Layer | Store | TTL | Purpose |
|---|---|---|---|
| In-memory | JS Map | 30 min (versions) / 1h (vulns) | Speed within a session |
| SQLite | `version_cache` / `vulnerability_cache` | 24h | Persistence across runs |
| Negative | `api_failures` | 15 min | Skip recently-failed APIs (rate-limit recovery) |

Location: `~/.manel/manel.db` (override with `MANEL_DB_PATH` env var).

DB init failures are **non-fatal** — Manel degrades to in-memory-only caching
and continues. History persistence is skipped in that case.

---

## 8. Troubleshooting guide

### "vulnerabilities shows 0 for a package I know is vulnerable"

1. Check version matching: OSV may list `4.2` while the installed version is `4.2.0`. This was a real bug (fixed in v1.2.1 via semantic equality). Upgrade Manel if below 1.2.1.
2. Check ecosystem mapping: `manel schema` shows which ecosystem each technology maps to. A wrong mapping = wrong query = empty results.
3. Check if local sync is stale: `manel sync --force` and re-run.
4. Verify against OSV directly: https://osv.dev/list?q=<package>&ecosystem=<ecosystem>

### "sync fails / is very slow"

- npm dump is ~200 MB — first sync legitimately takes minutes.
- Sync requires system `unzip` binary (guaranteed on Linux/macOS).
- Partial failures are isolated per ecosystem: if npm fails, PyPI results are still usable. Check `--verbose` output for the specific ecosystem error.
- Re-run with `manel sync --ecosystem npm --force` to retry just the failed one.

### "API rate limits (NVD / GitHub Advisory)"

- NVD: 1 request per 6 seconds without API key. Manel's negative cache (15 min) prevents hammering after a failure.
- GitHub Advisory: aggressive 429s. Negative caching skips it temporarily; the other two sources still answer.
- Solution: rely on `manel sync` + `--offline` for bulk/repeated scans. Local DB never rate-limits.

### "manel scan hangs on a slow network"

- Use `--offline` after a sync.
- In-memory + SQLite caches mean the second run is fast even without `--offline`.
- Version lookups (updates command) have independent negative caching — one failing API won't block others.

### "hardening shows nothing / platform notice"

- Hardening checks are Linux-only by design. On macOS the command exits cleanly with a notice. This is expected, not a bug.

### "history is empty"

- History is written by `scan` and `vulns` only (not `status`, `score`, `updates`).
- If DB init failed at startup, persistence was skipped silently. Check `MANEL_DB_PATH` permissions and `~/.manel/` directory writability.

### "version shows 0.0.0"

- Was a real bug: `getPackageVersion()` didn't walk up directories when run from `out/cli/`. Fixed via tree-walking lookup for `package.json` with `name === 'manel'`. Upgrade if seen.

### "DB locked / permission denied"

- Another process may hold the SQLite file, or `~/.manel/` isn't writable.
- Override location: `MANEL_DB_PATH=/tmp/manel.db manel scan`.

---

## 9. Agent integration patterns

### Pattern A — Agent reads schema first

```bash
manel schema --format json   # discover capabilities
manel scan --format json     # execute
```

The schema includes per-command examples, flags, and output shapes. Trust it
over hardcoded assumptions — it is generated from the actual commander program
at runtime, so it never drifts from the implementation.

### Pattern B — CI security gate

```yaml
- run: manel scan --fail-on HIGH --format sarif -o results.sarif
- uses: github/codeql-action/upload-sarif@v3
  if: always()
  with:
    sarif_file: results.sarif
```

### Pattern C — Agent parses structured findings

```bash
manel scan --format json | jq '{
  score: .data.score,
  critical: [.data.vulnerabilities[] | select(.severity=="CRITICAL")],
  failed_checks: [.data.hardening[] | select(.status=="fail")]
}'
```

### Pattern D — Fully offline audit (air-gapped / rate-limited envs)

```bash
manel sync                    # once, with network (weekly)
manel scan --offline --format json -o audit.json
```

### Pattern E — Trend tracking over time

```bash
manel scan                    # persists automatically
manel history --last 10 --format json | jq '.data[] | {date, score, vulnerabilities}'
```

---

## 10. Key design decisions (why things are the way they are)

- **TypeScript + commander.js**: reused ~2000 lines of existing logic from the original Electron app; commander is dependency-light.
- **CommonJS output**: runs directly on Node without a build step for the consumer.
- **OSV as the offline data source**: aggregates GHSA + NVD with ecosystem-native version ranges (exact matching, fewer false positives than CPE-based tools).
- **System `unzip` over a JS zip library**: zero new runtime dependencies.
- **Errors throw, empty caches**: a failed API is never recorded as "package is clean" — prevents masking rate-limit failures.
- **Cache key includes version**: `ecosystem:package:version` — upgrading a package auto-invalidates its cached results.
- **semantic-release**: every `feat:`/`fix:` commit to `main` auto-publishes a version bump. Never hardcode version expectations; query `manel --version` or the GitHub releases API.

---

## 11. Quick reference card

```bash
# Daily driver
manel scan

# CI gate
manel scan --fail-on HIGH --format sarif -o results.sarif

# Weekly maintenance
manel sync

# Air-gapped audit
manel sync && manel scan --offline

# Agent discovery
manel schema --format json

# Just the criticals
manel vulns --format json | jq '[.data.vulnerabilities[] | select(.severity=="CRITICAL")]'

# History trend
manel history --last 10
```
