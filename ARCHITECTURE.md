# Architecture — Manel

## Descripción general

Manel es un Security Health Monitor para entornos de desarrollo. Tiene dos modos de operación:

### Modo CLI (standalone)
El CLI (`bin/manel-cli.js`) funciona sin Electron. Ejecuta detectores directamente con `child_process.execSync()` y muestra resultados en la terminal con colores ANSI. Comandos: `status`, `scan`, `hardening`, `run`, `help`, `version`.

### Modo Electron (dashboard)
Aplicación de escritorio con React + Tailwind. Sigue una arquitectura de tres capas:

1. **Renderer (React)**: Interfaz de usuario con dashboard y vista de detalle.
2. **Preload (contextBridge)**: Puente seguro entre renderer y main process.
3. **Main Process (Node.js)**: Lógica principal: escaneo, base de datos, consultas de seguridad y versiones.

La comunicación entre renderer y main se realiza exclusivamente a través de IPC mediante `contextBridge` e `ipcMain.handle`, con `contextIsolation: true` y `nodeIntegration: false` por seguridad.

## Flujo de datos

### Modo CLI

```
Terminal
  |
manel status / scan / hardening / help
  |
  v
bin/manel-cli.js (Node.js standalone)
  |
  +-- execSync() -> node -v, git --version, psql --version, etc.
  +-- ANSI colors -> tabla coloreada en terminal
  +-- NO requiere Electron ni SQLite
```

### Modo Electron

```
+----------+     IPC invoke     +---------------+
|          |  --------------->  |               |
| Renderer |  <---------------> |   Preload     |
|  (React) |  scan-update event |  (bridge)     |
+----------+                    +-------+-------+
                                        |
                              ipcRenderer.invoke
                                        |
                               +--------v--------+
                               |   Main Process   |
                               |                  |
                               |  +------------+  |
                               |  |  Scanner    |  |  exec() CLI
                               |  |  (detect)   | ----------> node -v, psql --version, etc.
                               |  +-----+------+  |
                               |        |          |
                               |  +-----v------+  |
                               |  |  Database   |  |  better-sqlite3
                               |  |  (SQLite)   |  |
                               |  +-----+------+  |
                               |        |          |
                               |  +-----v------+  |
                               |  |  Security   |  |  fetch() OSV / NVD / GHSA
                               |  |  Engine     |  |
                               |  +-----+------+  |
                               |        |          |
                               |  +-----v------+  |
                               |  |  Hardening  |  |  checks de seguridad del SO
                               |  |  (Linux)    |  |
                               |  +-----+------+  |
                               |        |          |
                               |  +-----v------+  |
                               |  |  Update     |  |  fetch() npm / PyPI / GitHub / EoL
                               |  |  Engine     |  |
                               |  +-----+------+  |
                               |        |          |
                               |  +-----v------+  |
                               |  |  Score      |  |  cálculo local
                               |  |  Engine     |  |  (OS + Hardening + Tools + Deps + DBs)
                               |  +------------+  |
                               +-------------------+
```

## Flujo de escaneo completo

### 1. Trigger

El usuario hace clic en "Escanear ahora". El renderer invoca `window.manel.startScan()`.

### 2. Detectar

El handler `start-scan` en main process:

- Crea un registro `Scan` en SQLite con estado `pending`.
- Lo actualiza a `scanning`.
- Ejecuta detectores en serie (Node, npm, Yarn, pnpm, Git, Docker, Docker Compose, Python, Python3, pip, Java, Maven, Gradle, VS Code).
- Cada detector ejecuta un comando CLI (`execSync`) para obtener versión y ruta.
- Los resultados se emiten como eventos `scan-update` al renderer en tiempo real.
- Los software detectados se persisten en la tabla `software`.

### 3. Analizar

Al completar el escaneo, el renderer invoca `window.manel.analyzeSecurity({ softwareList, scanId })`.

Por cada software detectado, el Security Engine:

1. Determina el ecosistema (npm, PyPI, Maven) mediante `ecosystem-map.ts`.
2. Consulta vulnerabilidades en paralelo desde tres fuentes: OSV, NVD, GitHub Security Advisories.
3. Deduplica resultados por CVE (priorizando la entrada con más información disponible).
4. Persiste las vulnerabilidades en la tabla `vulnerabilities`.
5. Consulta la última versión estable mediante el Update Engine.
6. Determina el estado (`green`, `yellow`, `red`, `black`) según:
   - Vulnerabilidades críticas con keywords de exploit público → `black`.
   - Vulnerabilidades críticas o altas → `red`.
   - Vulnerabilidades medias o bajas → `yellow`.
   - Versión significativamente desactualizada → `yellow`.
   - Sin incidencias → `green`.
7. Genera una recomendación en texto.

### 4. Puntuar

El renderer invoca `window.manel.calculateScore(technologies)`.

El Score Engine calcula:

```
OS Score (20%) + Tools Score (20%) + Dependencies Score (40%) + Criticals Penalty (20%)
```

- **Category Score**: promedio del score individual de cada tecnología (green=100, yellow=60, red=25, black=0).
- **Criticals Penalty**: penalización según vulnerabilidades críticas sin fix conocido.
- El resultado final se recorta al rango [0, 100].

### 5. Visualizar

El renderer invoca `window.manel.getScanSummary({ scanId, technologies })` que persiste el resultado y retorna:

- `scan`: metadatos del escaneo con puntuación y conteos.
- `technologies`: array con resultados individuales.
- `overallScore`: puntuación general.

El dashboard renderiza el ScoreCard, el grid de conteos y la TechnologyList.

## Base de datos

### Esquema (SQLite)

La base de datos se almacena en `app.getPath('userData')/manel.db` con modo WAL y foreign keys activadas.

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
```

### Relaciones

```
scans (1) ──── (N) software (1) ──── (N) vulnerabilities
```

## IPC Handlers

### Canales invocados desde el renderer

| Channel | Parámetros | Retorno | Descripción |
|---------|-----------|---------|-------------|
| `get-app-info` | — | `{ name, version, platform }` | Información de la app |
| `start-scan` | — | `{ scanId, status }` | Inicia escaneo (emite eventos `scan-update`) |
| `get-software-by-scan-id` | `scanId: string` | `Software[]` | Software de un escaneo |
| `analyze-security` | `{ softwareList, scanId }` | `TechnologyResult[]` | Analiza vulnerabilidades y versiones |
| `calculate-score` | `technologies: TechnologyResult[]` | `number` | Calcula Security Score |
| `get-scan-summary` | `{ scanId, technologies }` | `ScanSummary` | Genera y persiste resumen |
| `get-latest-version` | `techName: string` | `{ techName, latestVersion } \| null` | Última versión de una tecnología |
| `get-all-latest-versions` | — | `Record<string, string \| null>` | Últimas versiones de todas las tecnologías |
| `check-vulnerabilities` | `{ ecosystem, packageName, version, softwareId }` | `Vulnerability[]` | Consulta vulnerabilidades con caché |

### Eventos emitidos al renderer

| Evento | Datos | Descripción |
|--------|-------|-------------|
| `scan-update` | `{ type: 'scan-started', scanId, status }` | Escaneo iniciado |
| `scan-update` | `{ type: 'software-detected', software, version }` | Software detectado |
| `scan-update` | `{ type: 'os-detected', osInfo }` | SO detectado |
| `scan-update` | `{ type: 'scan-completed', scanId, count }` | Escaneo completado |
| `scan-update` | `{ type: 'scan-failed', scanId, error }` | Escaneo fallido |

## Decisiones técnicas (ADR resumido)

### ADR-001: Electron con contextIsolation

- **Contexto**: La UI necesita comunicarse con el sistema (CLI, base de datos) y debe hacerlo de forma segura.
- **Decisión**: Usar `contextIsolation: true`, `nodeIntegration: false`, y exponer una API tipada via `contextBridge`.
- **Consecuencias**: El renderer no tiene acceso a Node.js. Toda la comunicación es explícita via IPC. Mayor seguridad.

### ADR-002: SQLite como almacenamiento local

- **Contexto**: Necesidad de persistir escaneos, software detectado y vulnerabilidades sin infraestructura externa.
- **Decisión**: better-sqlite3 (síncrono, embebido) con WAL mode.
- **Consecuencias**: Sin dependencias externas. Base de datos autocontenida en userData. WAL permite lecturas concurrentes.

### ADR-003: Consultas paralelas a fuentes de vulnerabilidades

- **Contexto**: OSV, NVD y GitHub Advisories tienen diferentes formatos, cobertura y rate limits.
- **Decisión**: Consultar las tres fuentes en paralelo con `Promise.allSettled` y deduplicar por CVE.
- **Consecuencias**: Mayor cobertura y resiliencia (una fuente caída no bloquea todo). Mayor latencia pero paralelizable.

### ADR-004: Score ponderado por categoría

- **Contexto**: No todas las tecnologías tienen el mismo impacto en la seguridad del entorno.
- **Decisión**: Ponderar SO (20%), herramientas (20%), dependencias/runtimes (40%), penalización por críticas (20%).
- **Consecuencias**: Las dependencias (Node.js, Python, Java) tienen mayor peso que herramientas auxiliares.

### ADR-005: Caché de vulnerabilidades con TTL

- **Contexto**: Las mismas consultas (misma tecnología + versión) pueden repetirse entre escaneos.
- **Decisión**: Caché en memoria con TTL de 60 minutos en `VulnerabilityCache`.
- **Consecuencias**: Reduce llamadas API repetitivas. La caché se invalida automáticamente por tiempo o al reiniciar la app.

### ADR-006: Detectores secuenciales con eventos en vivo

- **Contexto**: El escaneo ejecuta múltiples comandos CLI que pueden tomar tiempo.
- **Decisión**: Ejecutar detectores en serie (uno tras otro) y emitir eventos `scan-update` por cada detección.
- **Consecuencias**: El usuario ve progreso en tiempo real. No hay sobrecarga de procesos paralelos.

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

## Tecnologías detectables y su estado

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
