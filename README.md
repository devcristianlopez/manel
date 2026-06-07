# Manel — Security Health Monitor

Manel es un Security Health Monitor para entornos de desarrollo. Escanea localmente el software instalado (SO, herramientas, lenguajes), consulta vulnerabilidades conocidas en fuentes públicas (OSV, NVD, GitHub Advisories) y genera un Security Score (0-100) con recomendaciones accionables.

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)]()
[![Electron](https://img.shields.io/badge/Electron-33-47848F.svg)]()
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)]()

## Screenshot

*(pending)*

## Características

- **Escaneo local**: Detecta SO, herramientas de desarrollo y lenguajes instalados via CLI.
- **Detección de vulnerabilidades**: Consulta OSV, NVD y GitHub Security Advisories en paralelo.
- **Versiones actuales**: Consulta las últimas versiones estables desde npm, PyPI, GitHub, endoflife.date, etc.
- **Security Score**: Puntuación de 0 a 100 ponderada por categoría (SO, herramientas, dependencias) con penalización por vulnerabilidades críticas.
- **Dashboard visual**: Semáforo con score, conteo de vulnerabilidades por severidad y lista de tecnologías.
- **Vista de detalle**: Información individual por tecnología con CVEs, severidad y recomendaciones.
- **Recomendaciones de actualización**: Acción sugerida para cada tecnología según estado.
- **Almacenamiento local**: Historial de escaneos en SQLite.

## Tecnologías detectables

- **Lenguajes y runtimes**: Node.js, Python, Python 3, Java
- **Gestores de paquetes**: npm, Yarn, pnpm, pip, Maven, Gradle
- **Herramientas**: Git, Docker, Docker Compose, VS Code
- **Sistemas operativos**: Ubuntu, Debian, Fedora, macOS, Windows

## Requisitos

- Node.js 18 o superior
- npm, yarn o pnpm
- Sistema operativo:
  - Windows 10 o 11
  - Ubuntu, Debian, Fedora (o cualquier distribución Linux)
  - macOS

## Instalación

```bash
git clone <repo-url>
cd manel
npm install
npm run dev
```

## Uso

1. Abrir Manel. Se muestra la pantalla de inicio con el botón "Escanear ahora".
2. Hacer clic en "Escanear ahora". El escáner detecta secuencialmente cada tecnología instalada.
3. Al completar el escaneo, Manel consulta vulnerabilidades y últimas versiones para cada tecnología detectada.
4. El dashboard muestra:
   - **Security Score** con barra de progreso y semáforo (verde/amarillo/rojo/negro).
   - **Conteo de vulnerabilidades** por severidad (críticas, altas, medias, bajas).
   - **Lista de tecnologías** con indicador de estado y número de vulnerabilidades.
5. Hacer clic en cualquier tecnología para ver detalle con CVEs, descripciones y acción recomendada.

## Desarrollo

```bash
npm run dev      # Inicia en modo desarrollo con HMR
npm run build    # Build de producción
npm run start    # Vista previa del build
npm run lint     # Type checking (tsc --noEmit)
```

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Desarrollo con recarga en caliente (electron-vite dev) |
| `npm run build` | Compilación para producción (electron-vite build) |
| `npm run start` | Vista previa del build compilado |
| `npm run lint` | Verificación de tipos TypeScript |

## Estructura del proyecto

```
manel/
├── src/
│   ├── main/                  # Proceso principal de Electron
│   │   ├── index.ts           # Punto de entrada, ventana e IPC
│   │   ├── ipc/index.ts       # Registro de handlers IPC
│   │   ├── database/index.ts  # SQLite (scans, software, vulnerabilities)
│   │   ├── scanner/           # Detección de software via CLI
│   │   │   ├── index.ts       # Handler y orquestación del scan
│   │   │   └── detectors.ts   # Detectores individuales
│   │   ├── security/          # Motor de seguridad
│   │   │   ├── index.ts       # Handlers IPC de seguridad
│   │   │   ├── security-engine.ts   # Análisis y estado de tecnologías
│   │   │   ├── score-engine.ts      # Cálculo de Security Score
│   │   │   ├── score-utils.ts       # Categorización y utilidades de score
│   │   │   ├── vulnerability-sources.ts # OSV, NVD, GHSA queries
│   │   │   ├── eol.ts               # Fechas de fin de soporte
│   │   │   ├── ecosystem-map.ts     # Mapeo software -> ecosistema
│   │   │   └── cache.ts             # Caché de vulnerabilidades
│   │   └── update-engine/     # Consulta de últimas versiones
│   │       ├── index.ts       # Fuentes y handlers
│   │       └── __tests__/     # Tests del update engine
│   ├── preload/
│   │   └── index.ts           # Context bridge (API expuesta al renderer)
│   ├── renderer/              # UI React + Tailwind
│   │   ├── main.tsx           # Punto de entrada React
│   │   ├── App.tsx            # Componente principal (dashboard/detalle)
│   │   ├── components/
│   │   │   ├── ScoreCard.tsx       # Tarjeta de Security Score
│   │   │   ├── TechnologyList.tsx  # Grid de tecnologías
│   │   │   ├── TechnologyItem.tsx  # Item individual
│   │   │   ├── TechnologyDetail.tsx # Vista detalle
│   │   │   ├── ScanButton.tsx      # Botón de escaneo
│   │   │   └── ScanProgress.tsx    # Indicador de progreso
│   │   └── assets/index.css        # Estilos Tailwind
│   └── shared/
│       └── types.ts           # Tipos compartidos (Software, Vulnerability, Scan, etc.)
├── electron.vite.config.ts    # Configuración de electron-vite
├── electron-builder.yml       # Configuración de empaquetado
├── tailwind.config.js
├── postcss.config.js
└── tsconfig*.json             # Configuración TypeScript
```

## Arquitectura

```
UI (React) ↔ IPC (preload) ↔ Main Process
                              ├── Scanner → CLI commands
                              ├── Database → SQLite (manel.db)
                              ├── Security Engine → OSV / NVD / GitHub APIs
                              ├── Update Engine → npm / PyPI / GitHub / EoL APIs
                              └── Score Engine → cálculo local
```

Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para documentación técnica detallada.

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Electron 33, React 18, TypeScript 5, Tailwind 3 |
| Backend | Node.js (main process), better-sqlite3 |
| Build | electron-vite 2, electron-builder 25 |
| Tests | Vitest |
| APIs externas | OSV, NVD, GitHub Security Advisories, npm registry, PyPI, endoflife.date |

## Fuentes de datos

- [OSV](https://osv.dev) — Open Source Vulnerabilities database
- [NVD](https://nvd.nist.gov) — National Vulnerability Database (USA)
- [GitHub Security Advisories](https://github.com/advisories) — Advisory Database
- [End of Life](https://endoflife.date) — Fechas de soporte de software
- [npm registry](https://registry.npmjs.org) — Últimas versiones de paquetes npm
- [PyPI](https://pypi.org) — Últimas versiones de paquetes Python
- [GitHub Releases](https://api.github.com) — Últimas releases de proyectos GitHub

## Licencia

MIT
