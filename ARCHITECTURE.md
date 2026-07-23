# Architecture — Manel

## Descripción General

Manel es un CLI de seguridad para entornos de desarrollo, escrito en TypeScript. Escanea localmente el software instalado, consulta vulnerabilidades en fuentes públicas y genera un Security Score con recomendaciones accionables.

## Arquitectura CLI

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
│  │  ├── scanner/     (detección de software)            │  │
│  │  ├── security/    (análisis de vulnerabilidades)     │  │
│  │  ├── update-engine/ (consulta de versiones)          │  │
│  │  └── database/    (persistencia SQLite)              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Shared Layer                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  src/shared/types.ts                                 │  │
│  │  (Tipos compartidos entre CLI y Core)                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Flujo de Datos

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
  ├── Parse flags y opciones
  │
  ▼
commands/scan.ts
  │
  ├── 1. detectAll() ──────────────────────► scanner/
  │      (Node.js, npm, Python, etc.)           │
  │                                              ▼
  │                                    execSync() para detectar
  │                                    versiones instaladas
  │
  ├── 2. analyzeAllTechnologies() ────────► security/
  │      (Consultar vulnerabilidades)            │
  │                                              ├── queryOSV()
  │                                              ├── queryNVD()
  │                                              └── queryGitHubAdvisory()
  │
  ├── 3. runHardeningChecks() ────────────► security/hardening.ts
  │      (Linux hardening checks)               │
  │                                              ▼
  │                                    Firewall, SELinux, SSH, etc.
  │
  ├── 4. calculateScoreBreakdown() ───────► security/score-engine.ts
  │      (Calcular Security Score)              │
  │
  └── 5. formatOutput() ─────────────────► output/
         (Table, JSON, SARIF, NDJSON)          │
                                               ▼
                                    stdout / archivo
```

## Módulos

### CLI Layer (`src/cli/`)

Responsable de la interfaz de línea de comandos.

| Módulo | Responsabilidad |
|--------|-----------------|
| `index.ts` | Configuración de Commander.js, registro de comandos |
| `commands/` | Implementación de cada comando (`status`, `scan`, etc.) |
| `output/` | Formateadores de salida (table, json, sarif, ndjson) |
| `flags.ts` | Definición y validación de flags compartidos |
| `errors.ts` | Manejo de errores y códigos de salida |

### Core Layer (`src/core/`)

Lógica de negocio framework-agnostic.

| Módulo | Responsabilidad |
|--------|-----------------|
| `scanner/` | Detección de software instalado via CLI |
| `security/` | Análisis de vulnerabilidades y hardening |
| `update-engine/` | Consulta de últimas versiones desde fuentes externas |
| `database/` | Persistencia de resultados en SQLite |

### Shared Layer (`src/shared/`)

Tipos y utilidades compartidas.

| Módulo | Responsabilidad |
|--------|-----------------|
| `types.ts` | Tipos TypeScript para todo el proyecto |

## Commander.js Structure

```typescript
// src/cli/index.ts
const program = new Command()
  .name('manel')
  .description('Security Health Monitor for development environments')
  .version(version)

// Registro de comandos
registerStatusCommand(program)
registerScanCommand(program)
registerVulnerabilitiesCommand(program)
registerHardeningCommand(program)
registerScoreCommand(program)
registerUpdatesCommand(program)
registerSchemaCommand(program)
```

### Command Pattern

Cada comando sigue el mismo patrón:

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

### Formato Table (default)

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

### Formato JSON

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

### Formato SARIF

```json
{
  "version": "2.1.0",
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
  "runs": [{
    "tool": {
      "driver": {
        "name": "manel",
        "version": "0.1.0",
        "rules": [...]
      }
    },
    "results": [...]
  }]
}
```

### Formato NDJSON

```json
{"type":"technology","name":"node","version":"20.10.0","ecosystem":"npm"}
{"type":"vulnerability","id":"CVE-2024-12345","severity":"HIGH","affectedPackage":"node"}
{"type":"hardening","id":"firewall-active","status":"pass","severity":"MEDIUM"}
{"type":"score","overall":72,"breakdown":{...}}
{"type":"meta","timestamp":"2026-07-22T10:00:00Z","totalTechnologies":15}
```

## Tipos Principales

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

### Ponderación

| Categoría | Peso | Fuente |
|-----------|------|--------|
| Sistema Operativo | 15% | Detección + endoflife.date |
| Hardening | 15% | 7 checks de seguridad Linux |
| Herramientas | 10% | Git, Docker, VS Code |
| Dependencias | 30% | Node.js, Python, Java |
| Bases de Datos | 10% | PostgreSQL, MySQL, MongoDB, Redis |
| Vulnerabilidades críticas | 20% | OSV + NVD + GHSA |

### Cálculo

```
Category Score = promedio(score_individual)
  - green = 100
  - yellow = 60
  - red = 25
  - black = 0

Overall = OS(15%) + Hardening(15%) + Tools(10%) + Deps(30%) + DBs(10%) - Criticals(20%)
```

## Decisiones Técnicas

### ADR-001: CLI puro con Commander.js

- **Contexto**: Necesidad de una herramienta de seguridad que funcione en cualquier entorno sin dependencias de UI.
- **Decisión**: Usar Commander.js como framework CLI, TypeScript como lenguaje, CommonJS como módulo.
- **Consecuencias**:
  + Funciona en cualquier terminal sin dependencias de GUI
  + Fácil de integrar en CI/CD
  + Output estructurado (JSON, SARIF) para herramientas externas
  - Sin interfaz gráfica interactiva

### ADR-002: Three-layer architecture

- **Contexto**: Separar concerns entre CLI, lógica de negocio y tipos compartidos.
- **Decisión**: Arquitectura en tres capas: CLI, Core, Shared.
- **Consecuencias**:
  + Core es framework-agnostic (puede usarse con cualquier UI)
  + Shared types evitan dependencias circulares
  + Testing más fácil por separación de responsabilidades

### ADR-003: CommonJS modules

- **Contexto**: Necesidad de compatibilidad con Node.js 18+ y herramientas existentes.
- **Decisión**: Usar CommonJS (`module: "CommonJS"` en tsconfig).
- **Consecuencias**:
  + Compatibilidad con `require()` en Node.js
  + Funciona con `node bin/manel-cli.js` directamente
  - No puede usar `import`/`export` estándar sin transpilación

### ADR-004: SQLite para persistencia

- **Contexto**: Necesidad de almacenar historial de escaneos sin infraestructura externa.
- **Decisión**: better-sqlite3 (síncrono, embebido) con WAL mode.
- **Consecuencias**:
  + Sin dependencias externas
  + Base de datos autocontenida
  + WAL permite lecturas concurrentes

### ADR-005: Output formats

- **Contexto**: Diferentes usuarios necesitan diferentes formatos de salida.
- **Decisión**: Soportar table, JSON, SARIF y NDJSON.
- **Consecuencias**:
  + Table para terminal interactiva
  + JSON para scripts y APIs
  + SARIF para herramientas SAST (GitHub Code Scanning)
  + NDJSON para streaming y pipes

## Base de Datos

### Esquema (SQLite)

La base de datos se almacena en `~/.manel/manel.db` con modo WAL y foreign keys activadas.

```sql
-- Escaneos ejecutados
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

-- Software detectado en cada escaneo
CREATE TABLE software (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,               -- Nombre normalizado (node, npm, git, etc.)
  version     TEXT NOT NULL,
  path        TEXT,                        -- Ruta del binario detectado
  detected_at INTEGER NOT NULL,            -- Unix timestamp
  scan_id     TEXT,                        -- FK -> scans(id)
  FOREIGN KEY (scan_id) REFERENCES scans(id)
);

-- Vulnerabilidades encontradas por software
CREATE TABLE vulnerabilities (
  id           TEXT PRIMARY KEY,
  cve          TEXT,                       -- CVE identifier o alias
  severity     TEXT NOT NULL,              -- CRITICAL | HIGH | MEDIUM | LOW | NONE
  description  TEXT,
  software_id  TEXT NOT NULL,              -- FK -> software(id)
  fixed_version TEXT,                      -- Versión donde se corrigió
  source       TEXT,                       -- OSV | NVD | GHSA
  FOREIGN KEY (software_id) REFERENCES software(id)
);

-- Resultados de hardening
CREATE TABLE hardening_results (
  id          TEXT PRIMARY KEY,
  scan_id     TEXT,                        -- FK -> scans(id)
  check_id    TEXT NOT NULL,               -- Identificador del check
  category    TEXT NOT NULL,               -- Categoría del check
  title       TEXT NOT NULL,               -- Título del check
  status      TEXT NOT NULL,               -- pass | fail | warning | error
  severity    TEXT NOT NULL,               -- CRITICAL | HIGH | MEDIUM | LOW
  details     TEXT,                        -- Detalles del resultado
  FOREIGN KEY (scan_id) REFERENCES scans(id)
);
```

### Relaciones

```
scans (1) ──── (N) software (1) ──── (N) vulnerabilities
   │
   └──── (N) hardening_results
```

## Flujo de Escaneo Completo

### 1. Parse de Argumentos

Commander.js parsea los argumentos de la línea de comandos y extrae flags.

### 2. Detección

El scanner ejecuta comandos del sistema via `execSync()`:

```typescript
// Ejemplo: detectar Node.js
const result = execSync('node -v', { encoding: 'utf-8' })
// Resultado: "v20.10.0"
```

### 3. Análisis de Vulnerabilidades

Por cada software detectado, el security engine:

1. Determina el ecosistema (npm, PyPI, Maven)
2. Consulta vulnerabilidades en paralelo desde OSV, NVD y GHSA
3. Deduplica resultados por CVE
4. Determina el estado (green/yellow/red/black)

### 4. Hardening Checks (Linux)

Ejecuta 7 checks de seguridad:

- Firewall activo
- SELinux habilitado
- SSH root login deshabilitado
- Puertos innecesarios cerrados
- Actualizaciones pendientes
- Permisos de archivos sensibles
- Servicios innecesarios deshabilitados

### 5. Cálculo de Score

Calcula el score ponderado basado en:

- Estado del SO
- Resultados de hardening
- Estado de herramientas
- Estado de dependencias
- Estado de bases de datos
- Penalización por vulnerabilidades críticas

### 6. Formateo de Output

Selecciona el formateador según el flag `--format`:

- **table**: `src/cli/output/table-formatter.ts`
- **json**: `src/cli/output/json-formatter.ts`
- **sarif**: `src/cli/output/sarif-formatter.ts`
- **ndjson**: `src/cli/output/ndjson-formatter.ts`

### 7. Escritura

Escribe el resultado a stdout o archivo según `--output`.

## Fuentes del Update Engine

| Tecnología | Fuente | Parse |
|-----------|--------|-------|
| Node.js | `nodejs.org/dist/index.json` | Última versión LTS |
| npm | `registry.npmjs.org/npm/latest` | `version` field |
| Yarn | `registry.npmjs.org/yarn/latest` | `version` field |
| pnpm | `registry.npmjs.org/pnpm/latest` | `version` field |
| Git | `api.github.com/repos/git/git/releases/latest` | `tag_name` |
| Docker | `api.github.com/repos/docker/docker-ce/releases/latest` | `tag_name` |
| Docker Compose | `api.github.com/repos/docker/compose/releases/latest` | `tag_name` |
| Python | `endoflife.date/api/python/latest.json` | `latest` field |
| pip | `pypi.org/pypi/pip/json` | `info.version` |
| Java | `endoflife.date/api/java.json` | Última versión LTS |
| Maven | `api.github.com/repos/apache/maven/releases/latest` | `tag_name` (strip `maven-`) |
| Gradle | `services.gradle.org/versions/current` | `version` field |
| VS Code | `api.github.com/repos/microsoft/vscode/releases/latest` | `tag_name` |
| Ubuntu, Debian, Fedora, macOS, Windows | `endoflife.date/api/<os>.json` | Último ciclo disponible |

## Tecnologías Detectables

| Detector | Comando | Ecosistema | Fuente versión |
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
| PgAdmin | `pgadmin4 --version` | PostgreSQL | PostgreSQL |
