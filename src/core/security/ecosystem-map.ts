/**
 * Manel Core — Software Ecosystem Map
 *
 * Maps technology names to their package ecosystem identifiers.
 * Used to determine which vulnerability database to query.
 *
 * @module core/security/ecosystem-map
 */

/**
 * Maps technology name to its ecosystem identifier.
 * Ecosystems are used by vulnerability sources (OSV, NVD, GHSA).
 */
export const SOFTWARE_ECOSYSTEM_MAP: Record<string, string> = {
  node: 'npm',
  npm: 'npm',
  yarn: 'npm',
  pnpm: 'npm',
  python: 'PyPI',
  python3: 'PyPI',
  pip: 'PyPI',
  java: 'Maven',
  mvn: 'Maven',
  gradle: 'Maven',
  postgresql: 'npm',
  mysql: 'npm',
  mariadb: 'npm',
  mongodb: 'npm',
  redis: 'npm',
  sqlite: 'npm',
  pgadmin: 'npm',
}
