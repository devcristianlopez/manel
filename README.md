# Manel — Security Health Monitor CLI

Manel es un CLI de seguridad para entornos de desarrollo que escanea localmente el software instalado (SO, herramientas, lenguajes, bases de datos), consulta vulnerabilidades conocidas en fuentes públicas (OSV, NVD, GitHub Advisories) y genera un Security Score (0-100) con recomendaciones accionables.

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)]()
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)]()

## Quick Start

```bash
# Instalación global
npm install -g manel

# O ejecutar directamente
npx manel scan

# Verificar estado rápido
manel status
```

## Instalación

### Requisitos Previos

- **Node.js 18+** — Descarga desde [nodejs.org](https://nodejs.org/)
- **npm** — Incluido con Node.js
- **Git** — Para instalar desde código fuente

```bash
# Verificar versiones
node --version   # Debe mostrar v18.x.x o superior
npm --version
git --version
```

### Método 1: Desde npm (recomendado)

```bash
npm install -g manel
```

### Método 2: Script de instalación automática

```bash
# Clonar el repositorio
git clone https://github.com/devcristianlopez/manel.git
cd manel

# Ejecutar instalador
bash setup.sh

# O con modo desarrollo (incluye herramientas de test)
bash setup.sh --dev
```

El script de instalación:
- ✅ Detecta tu sistema operativo
- ✅ Verifica/instala Node.js 18+
- ✅ Instala dependencias
- ✅ Compila el CLI
- ✅ Vincula globalmente el comando `manel`
- ✅ Verifica la instalación

### Método 3: Instalación manual

```bash
git clone https://github.com/devcristianlopez/manel.git
cd manel
npm install
npm run build:cli
npm link
```

### Método 4: npx (sin instalar)

```bash
npx manel scan
```

### Scripts npm disponibles

```bash
npm run install:global   # Compilar e instalar globalmente
npm run uninstall:global # Desinstalar globalmente
npm run setup           # Ejecutar bash setup.sh
npm run uninstall       # Ejecutar bash uninstall.sh
```

### Verificar instalación

```bash
manel --version
manel status
```

### Sistema operativo soportado

- ✅ Linux (Ubuntu, Debian, Fedora, Arch)
- ✅ macOS
- ⚠️ Windows (instalación manual)

## Desinstalación

### Método 1: Script de desinstalación (recomendado)

```bash
# Si estás en el directorio del proyecto
bash uninstall.sh

# O con la ruta al proyecto
/path/to/manel/uninstall.sh
```

Opciones del script:
```bash
bash uninstall.sh --help   # Ver ayuda
bash uninstall.sh --yes    # Saltar confirmaciones
bash uninstall.sh --all    # También eliminar directorio de instalación
```

### Método 2: npm

```bash
npm uninstall -g manel
```

### Método 3: Manual

```bash
# Eliminar link global
npm unlink -g manel

# O eliminar el ejecutable directamente
rm -f $(which manel)
```

### Después de desinstalar

```bash
# Refrescar cache del shell
hash -r
```

## Comandos

| Comando | Descripción |
|---------|-------------|
| `manel status` | Estado rápido de tecnologías instaladas |
| `manel scan` | Scan completo: vulnerabilidades + hardening + score |
| `manel vulnerabilities` | Solo vulnerabilidades (alias: `vulns`) |
| `manel hardening` | Solo hardening checks (Linux) |
| `manel score` | Score de seguridad detallado |
| `manel updates` | Verificar versiones disponibles |
| `manel schema` | JSON introspectivo del CLI (IA-friendly) |

### Ejemplos de uso

```bash
# Estado rápido
manel status

# Scan completo con output JSON
manel scan --format json

# Solo vulnerabilidades críticas y altas
manel vulnerabilities --severity CRITICAL,HIGH

# Hardening con output a archivo
manel hardening --output report.txt

# Score detallado sin colores
manel score --no-color

# Verificar actualizaciones disponibles
manel updates --format json
```

## Flags Estándar

Todos los comandos soportan los siguientes flags:

| Flag | Descripción |
|------|-------------|
| `-f, --format <format>` | Formato de output: `table`, `json`, `sarif`, `ndjson` |
| `-o, --output <file>` | Escribir output a archivo en vez de stdout |
| `-s, --severity <levels>` | Filtrar por severidad (separado por comas) |
| `--fail-on <severity>` | Salir con código 1 si hay hallazgos >= severidad |
| `--no-color` | Deshabilitar output con colores ANSI |
| `-q, --quiet` | Suprimir output que no sean errores |
| `-V, --verbose` | Habilitar output detallado |
| `--no-interactive` | Deshabilitar prompts interactivos (para CI/CD) |

### Formatos de Output

| Formato | Descripción | Uso recomendado |
|---------|-------------|-----------------|
| `table` | Tabla formateada con colores (default) | Terminal interactiva |
| `json` | JSON pretty-printed | APIs, scripts, debugging |
| `sarif` | Static Analysis Results Interchange Format | GitHub Code Scanning, herramientas SAST |
| `ndjson` | Newline-delimited JSON | Pipes, streaming, procesamiento en lotes |

## Exit Codes

| Código | Significado |
|--------|-------------|
| `0` | Éxito, sin hallazgos |
| `1` | Hallazgos detectados (vulnerabilidades, hardening failures) |
| `2` | Error interno |
| `3` | Input inválido |

## Ejemplos de CI/CD

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

### Pipeline con fail-on

```yaml
- name: Security gate
  run: manel scan --fail-on high --no-interactive --format json
```

### Scan solo de vulnerabilidades

```yaml
- name: Check vulnerabilities
  run: manel vulns --severity CRITICAL,HIGH --format ndjson | jq '.severity'
```

## Ejemplos de Pipes

```bash
# Extraer vulnerabilidades críticas
manel scan --format json | jq '.vulnerabilities[] | select(.severity == "CRITICAL")'

# Contar vulnerabilidades por severidad
manel scan --format json | jq '[.vulnerabilities[].severity] | group_by(.) | map({(.[0]): length}) | add'

# Filtrar tecnologías desactualizadas
manel scan --format json | jq '.technologies[] | select(.updateAvailable == true)'

# Enviar resultados a un servicio de logging
manel scan --format ndjson | while read line; do echo "$line" | curl -X POST -d @- https://api.example.com/logs; done

# Generar reporte SARIF y subir a GitHub
manel scan --format sarif -o results.sarif

# Verificar solo el score
manel score --format json | jq '.overall'
```

## Security Score

El score se calcula con la siguiente ponderación:

| Categoría | Peso |
|-----------|------|
| Sistema Operativo | 15% |
| Hardening | 15% |
| Herramientas | 10% |
| Dependencias | 30% |
| Bases de Datos | 10% |
| Vulnerabilidades críticas | 20% |

## Tecnologías Detectables

- **Lenguajes y runtimes**: Node.js, Python, Python 3, Java
- **Gestores de paquetes**: npm, Yarn, pnpm, pip, Maven, Gradle
- **Herramientas**: Git, Docker, Docker Compose, VS Code
- **Bases de datos**: PostgreSQL, MySQL, MariaDB, MongoDB, Redis, SQLite, pgAdmin
- **Sistemas operativos**: Ubuntu, Debian, Fedora, macOS, Windows

## Schema Introspectivo

El comando `schema` genera un JSON que describe toda la interfaz del CLI, útil para herramientas de IA y generación de documentación:

```bash
manel schema | jq '.commands[] | .name'
```

## Desarrollo

```bash
# Instalar dependencias
npm install

# Compilar CLI
npm run build:cli

# Ejecutar en desarrollo
node bin/manel-cli.js scan

# Ejecutar tests
npm test

# Type checking
npm run lint
```

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| CLI Framework | Commander.js 15 |
| Lenguaje | TypeScript 5 |
| Runtime | Node.js 18+ |
| Base de datos | SQLite (better-sqlite3) |
| Tests | Vitest |
| APIs externas | OSV, NVD, GitHub Security Advisories, npm registry, PyPI, endoflife.date |

## Estructura del Proyecto

```
manel/
├── bin/
│   └── manel-cli.js           # Entry point del CLI
├── src/
│   ├── cli/                   # CLI framework
│   │   ├── commands/          # Implementación de comandos
│   │   ├── output/            # Formateadores (table, json, sarif, ndjson)
│   │   ├── flags.ts           # Flags compartidos
│   │   ├── errors.ts          # Manejo de errores
│   │   └── index.ts           # Entry point principal
│   ├── core/                  # Lógica de negocio
│   │   ├── scanner/           # Detección de software
│   │   ├── security/          # Motor de seguridad
│   │   ├── update-engine/     # Consulta de versiones
│   │   ├── database/          # Persistencia SQLite
│   │   └── index.ts           # Barrel export
│   └── shared/                # Tipos compartidos
│       └── types.ts
├── package.json
├── tsconfig.cli.json          # Config TypeScript para CLI
└── vitest.config.ts
```

Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para documentación técnica detallada.

## Fuentes de Datos

- [OSV](https://osv.dev) — Open Source Vulnerabilities database
- [NVD](https://nvd.nist.gov) — National Vulnerability Database (USA)
- [GitHub Security Advisories](https://github.com/advisories) — Advisory Database
- [End of Life](https://endoflife.date) — Fechas de soporte de software
- [npm registry](https://registry.npmjs.org) — Últimas versiones de paquetes npm
- [PyPI](https://pypi.org) — Últimas versiones de paquetes Python
- [GitHub Releases](https://api.github.com) — Últimas releases de proyectos GitHub

## Contributing

Ver [CONTRIBUTING.md](./CONTRIBUTING.md) para guías de desarrollo y contribución.

## Licencia

MIT
