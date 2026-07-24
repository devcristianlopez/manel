## [1.2.0](https://github.com/devcristianlopez/manel/compare/v1.1.0...v1.2.0) (2026-07-24)

## [1.1.0](https://github.com/devcristianlopez/manel/compare/v1.0.0...v1.1.0) (2026-07-23)

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-23

### Added
- CLI framework with 7 commands (status, scan, vulnerabilities, hardening, score, updates, schema)
- Multi-format output engine (table, JSON, SARIF 2.1.0, NDJSON)
- Automatic installation scripts (setup.sh, uninstall.sh)
- 198 new tests (e2e, edge-cases, performance, compatibility, schema)
- Documentation (README, ARCHITECTURE, CONTRIBUTING)
- Landing page in English and Spanish
- GitHub Actions workflows (CI, Release, Pages)
- Semantic-release for automated versioning

### Changed
- Migrated from Electron to CLI-only architecture
- Renamed default branch from master to main
- Translated all documentation to English

### Removed
- Electron, React, and related dependencies
- Tailwind CSS, PostCSS configuration
- Electron-specific build tools
