/**
 * Manel Core — Hardening Checks
 *
 * System hardening verification for Linux systems.
 * Checks firewall, SELinux/AppArmor, SSH configuration,
 * open ports, security updates, and core dumps.
 * No Electron or IPC dependencies.
 *
 * @module core/security/hardening
 */

import { execSync } from 'child_process'
import type { CoreHardeningCheck } from '../types'

// ============================================================================
// 1. Internal Helpers
// ============================================================================

/**
 * Safely execute a shell command and return trimmed output.
 *
 * @param cmd - Shell command to execute
 * @returns Trimmed stdout string, or null on failure
 */
function safeExec(cmd: string): string | null {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim()
  } catch {
    return null
  }
}

// ============================================================================
// 2. Individual Checks
// ============================================================================

async function checkFirewall(): Promise<CoreHardeningCheck> {
  const checkId = 'firewall-active'
  const category = 'firewall'
  const title = 'Firewall activo'
  const description = 'Verifica que un firewall esté activo en el sistema'

  const ufw = safeExec('ufw status')
  if (ufw && ufw.toLowerCase().includes('active')) {
    return { checkId, category, title, status: 'pass', severity: 'HIGH', details: 'UFW está activo' }
  }

  const firewalld = safeExec('firewall-cmd --state')
  if (firewalld && firewalld.toLowerCase().includes('running')) {
    return { checkId, category, title, status: 'pass', severity: 'HIGH', details: 'firewalld está activo' }
  }

  const iptables = safeExec('iptables -L -n')
  if (iptables && iptables.includes('Chain')) {
    return { checkId, category, title, status: 'pass', severity: 'HIGH', details: 'iptables tiene reglas configuradas' }
  }

  return { checkId, category, title, status: 'fail', severity: 'HIGH', details: 'No se detectó firewall activo' }
}

async function checkSELinux(): Promise<CoreHardeningCheck> {
  const checkId = 'selinux-apparmor'
  const category = 'access_control'
  const title = 'SELinux / AppArmor'
  const description = 'Verifica que un sistema de control de acceso mandatorio esté activo'

  const selinux = safeExec('getenforce')
  if (selinux) {
    const lower = selinux.toLowerCase()
    if (lower === 'enforcing') {
      return { checkId, category, title, status: 'pass', severity: 'HIGH', details: 'SELinux está en modo Enforcing' }
    }
    if (lower === 'permissive') {
      return { checkId, category, title, status: 'warning', severity: 'HIGH', details: 'SELinux está en modo Permissive' }
    }
    if (lower === 'disabled') {
      return { checkId, category, title, status: 'fail', severity: 'HIGH', details: 'SELinux está deshabilitado' }
    }
  }

  const apparmor = safeExec('aa-status --enabled')
  if (apparmor !== null) {
    return { checkId, category, title, status: 'pass', severity: 'HIGH', details: 'AppArmor está habilitado' }
  }

  return { checkId, category, title, status: 'fail', severity: 'HIGH', details: 'No se detectó SELinux ni AppArmor activos' }
}

async function checkSSHRootLogin(): Promise<CoreHardeningCheck> {
  const checkId = 'ssh-root-login'
  const category = 'ssh'
  const title = 'SSH PermitRootLogin'
  const description = 'Verifica que el acceso root por SSH esté restringido'

  const sshd = safeExec('sshd -T 2>/dev/null | grep -i "permitrootlogin"')
  if (sshd === null) {
    return { checkId, category, title, status: 'warning', severity: 'CRITICAL', details: 'sshd no está instalado o no se pudo consultar' }
  }

  const lower = sshd.toLowerCase()
  if (lower.includes('prohibit-password') || lower.includes('without-password')) {
    return { checkId, category, title, status: 'pass', severity: 'CRITICAL', details: 'Root login solo con llaves SSH' }
  }
  if (lower.includes('no')) {
    return { checkId, category, title, status: 'pass', severity: 'CRITICAL', details: 'Root login está deshabilitado' }
  }
  if (lower.includes('yes')) {
    return { checkId, category, title, status: 'fail', severity: 'CRITICAL', details: 'Root login via SSH está habilitado' }
  }

  return { checkId, category, title, status: 'warning', severity: 'CRITICAL', details: 'No se pudo determinar la configuración de PermitRootLogin' }
}

async function checkSSHPasswordAuth(): Promise<CoreHardeningCheck> {
  const checkId = 'ssh-password-auth'
  const category = 'ssh'
  const title = 'SSH PasswordAuthentication'
  const description = 'Verifica que la autenticación por contraseña SSH esté deshabilitada'

  const sshd = safeExec('sshd -T 2>/dev/null | grep -i "passwordauthentication"')
  if (sshd === null) {
    return { checkId, category, title, status: 'warning', severity: 'HIGH', details: 'sshd no está instalado o no se pudo consultar' }
  }

  const lower = sshd.toLowerCase()
  if (lower.includes('no')) {
    return { checkId, category, title, status: 'pass', severity: 'HIGH', details: 'Autenticación por contraseña SSH deshabilitada' }
  }
  if (lower.includes('yes')) {
    return { checkId, category, title, status: 'fail', severity: 'HIGH', details: 'Autenticación por contraseña SSH habilitada' }
  }

  return { checkId, category, title, status: 'warning', severity: 'HIGH', details: 'No se pudo determinar la configuración de PasswordAuthentication' }
}

const COMMON_PORTS = new Set([22, 80, 443, 3000, 4000, 5000, 5173, 8000, 8080, 8443, 9000, 27017, 5432, 3306, 6379])
const DANGEROUS_PORTS = new Set([21, 23, 25, 110, 143])

function parsePorts(ssOutput: string): number[] {
  const ports: number[] = []
  const lines = ssOutput.split('\n')
  for (const line of lines) {
    const match = line.match(/:(\d+)\s/)
    if (match) {
      ports.push(parseInt(match[1], 10))
    }
  }
  return ports
}

async function checkOpenPorts(): Promise<CoreHardeningCheck> {
  const checkId = 'open-ports'
  const category = 'network'
  const title = 'Puertos expuestos'
  const description = 'Verifica que no haya puertos innecesarios expuestos'

  const ss = safeExec('ss -tlnp')
  if (!ss) {
    return { checkId, category, title, status: 'error', severity: 'MEDIUM', details: 'No se pudo ejecutar ss' }
  }

  const ports = parsePorts(ss)
  const extraPorts = ports.filter(p => !COMMON_PORTS.has(p) && !DANGEROUS_PORTS.has(p))
  const dangerousOpen = ports.filter(p => DANGEROUS_PORTS.has(p))

  const allKnown = ports.filter(p => COMMON_PORTS.has(p) || DANGEROUS_PORTS.has(p))
  const suspicious: string[] = []
  if (dangerousOpen.length > 0) {
    suspicious.push(...dangerousOpen.map(p => `Puerto peligroso ${p} abierto`))
  }
  if (extraPorts.length > 0) {
    suspicious.push(...extraPorts.map(p => `Puerto desconocido ${p} abierto`))
  }

  if (suspicious.length > 0) {
    return { checkId, category, title, status: 'fail', severity: 'MEDIUM', details: suspicious.join('; ') }
  }

  return { checkId, category, title, status: 'pass', severity: 'MEDIUM', details: `Solo puertos conocidos: ${allKnown.join(', ') || 'ninguno'}` }
}

async function checkUpdates(): Promise<CoreHardeningCheck> {
  const checkId = 'security-updates'
  const category = 'updates'
  const title = 'Actualizaciones de seguridad'
  const description = 'Verifica que no haya actualizaciones de seguridad pendientes'

  const apt = safeExec('apt list --upgradable 2>/dev/null | grep -i security')
  if (apt !== null) {
    const lines = apt.split('\n').filter(l => l.trim().length > 0)
    if (lines.length > 0) {
      return { checkId, category, title, status: 'fail', severity: 'HIGH', details: `${lines.length} actualizaciones de seguridad pendientes` }
    }
    return { checkId, category, title, status: 'pass', severity: 'HIGH', details: 'No hay actualizaciones de seguridad pendientes' }
  }

  const dnf = safeExec('dnf check-update --security 2>/dev/null')
  if (dnf !== null) {
    const lines = dnf.split('\n').filter(l => l.trim().length > 0 && !l.startsWith('Last metadata'))
    if (lines.length > 0) {
      return { checkId, category, title, status: 'fail', severity: 'HIGH', details: `${lines.length} actualizaciones de seguridad pendientes` }
    }
    return { checkId, category, title, status: 'pass', severity: 'HIGH', details: 'No hay actualizaciones de seguridad pendientes' }
  }

  return { checkId, category, title, status: 'warning', severity: 'HIGH', details: 'No se pudo determinar el gestor de paquetes' }
}

async function checkCoreDumps(): Promise<CoreHardeningCheck> {
  const checkId = 'core-dumps'
  const category = 'system'
  const title = 'Core dumps'
  const description = 'Verifica que los core dumps con suid estén deshabilitados'

  const sysctl = safeExec('sysctl fs.suid_dumpable 2>/dev/null')
  if (!sysctl) {
    return { checkId, category, title, status: 'error', severity: 'MEDIUM', details: 'No se pudo consultar fs.suid_dumpable' }
  }

  const match = sysctl.match(/fs\.suid_dumpable\s*=\s*(\d)/)
  if (!match) {
    return { checkId, category, title, status: 'error', severity: 'MEDIUM', details: 'No se pudo interpretar la salida de sysctl' }
  }

  const value = match[1]
  if (value === '0') {
    return { checkId, category, title, status: 'pass', severity: 'MEDIUM', details: 'Core dumps suid deshabilitados' }
  }
  if (value === '1') {
    return { checkId, category, title, status: 'fail', severity: 'MEDIUM', details: 'Core dumps suid habilitados' }
  }
  if (value === '2') {
    return { checkId, category, title, status: 'warning', severity: 'MEDIUM', details: 'Core dumps suid en modo parcial' }
  }

  return { checkId, category, title, status: 'warning', severity: 'MEDIUM', details: `Valor inesperado fs.suid_dumpable = ${value}` }
}

// ============================================================================
// 3. Main Export
// ============================================================================

/**
 * Run all system hardening checks.
 *
 * Only runs on Linux. Returns an empty array on other platforms.
 * Each check runs independently; failures in one check do not
 * affect others.
 *
 * @returns Array of hardening check results (7 checks on Linux)
 */
export async function runHardeningChecks(): Promise<CoreHardeningCheck[]> {
  if (process.platform !== 'linux') {
    return []
  }

  const checks = [
    checkFirewall(),
    checkSELinux(),
    checkSSHRootLogin(),
    checkSSHPasswordAuth(),
    checkOpenPorts(),
    checkUpdates(),
    checkCoreDumps(),
  ]

  const results = await Promise.allSettled(checks)

  return results.map((result, i) => {
    const checkIds = [
      'firewall-active',
      'selinux-apparmor',
      'ssh-root-login',
      'ssh-password-auth',
      'open-ports',
      'security-updates',
      'core-dumps',
    ]
    if (result.status === 'rejected') {
      return {
        checkId: checkIds[i],
        category: 'system',
        title: '',
        status: 'error' as const,
        severity: 'MEDIUM',
        details: result.reason instanceof Error ? result.reason.message : String(result.reason),
      }
    }
    return result.value
  })
}
