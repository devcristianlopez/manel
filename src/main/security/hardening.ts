import { execSync } from 'child_process'

export interface HardeningCheck {
  id: string
  category: 'firewall' | 'access_control' | 'ssh' | 'updates' | 'network' | 'system'
  title: string
  description: string
  status: 'pass' | 'fail' | 'warning' | 'error'
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  details: string
}

function safeExec(cmd: string): string | null {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim()
  } catch {
    return null
  }
}

async function checkFirewall(): Promise<HardeningCheck> {
  const id = 'firewall-active'
  const category = 'firewall' as const
  const title = 'Firewall activo'
  const description = 'Verifica que un firewall esté activo en el sistema'

  const ufw = safeExec('ufw status')
  if (ufw && ufw.toLowerCase().includes('active')) {
    return { id, category, title, description, status: 'pass', severity: 'HIGH', details: 'UFW está activo' }
  }

  const firewalld = safeExec('firewall-cmd --state')
  if (firewalld && firewalld.toLowerCase().includes('running')) {
    return { id, category, title, description, status: 'pass', severity: 'HIGH', details: 'firewalld está activo' }
  }

  const iptables = safeExec('iptables -L -n')
  if (iptables && iptables.includes('Chain')) {
    return { id, category, title, description, status: 'pass', severity: 'HIGH', details: 'iptables tiene reglas configuradas' }
  }

  return { id, category, title, description, status: 'fail', severity: 'HIGH', details: 'No se detectó firewall activo' }
}

async function checkSELinux(): Promise<HardeningCheck> {
  const id = 'selinux-apparmor'
  const category = 'access_control' as const
  const title = 'SELinux / AppArmor'
  const description = 'Verifica que un sistema de control de acceso mandatorio esté activo'

  const selinux = safeExec('getenforce')
  if (selinux) {
    const lower = selinux.toLowerCase()
    if (lower === 'enforcing') {
      return { id, category, title, description, status: 'pass', severity: 'HIGH', details: 'SELinux está en modo Enforcing' }
    }
    if (lower === 'permissive') {
      return { id, category, title, description, status: 'warning', severity: 'HIGH', details: 'SELinux está en modo Permissive' }
    }
    if (lower === 'disabled') {
      return { id, category, title, description, status: 'fail', severity: 'HIGH', details: 'SELinux está deshabilitado' }
    }
  }

  const apparmor = safeExec('aa-status --enabled')
  if (apparmor !== null) {
    return { id, category, title, description, status: 'pass', severity: 'HIGH', details: 'AppArmor está habilitado' }
  }

  return { id, category, title, description, status: 'fail', severity: 'HIGH', details: 'No se detectó SELinux ni AppArmor activos' }
}

async function checkSSHRootLogin(): Promise<HardeningCheck> {
  const id = 'ssh-root-login'
  const category = 'ssh' as const
  const title = 'SSH PermitRootLogin'
  const description = 'Verifica que el acceso root por SSH esté restringido'

  const sshd = safeExec('sshd -T 2>/dev/null | grep -i "permitrootlogin"')
  if (sshd === null) {
    return { id, category, title, description, status: 'warning', severity: 'CRITICAL', details: 'sshd no está instalado o no se pudo consultar' }
  }

  const lower = sshd.toLowerCase()
  if (lower.includes('prohibit-password') || lower.includes('without-password')) {
    return { id, category, title, description, status: 'pass', severity: 'CRITICAL', details: 'Root login solo con llaves SSH' }
  }
  if (lower.includes('no')) {
    return { id, category, title, description, status: 'pass', severity: 'CRITICAL', details: 'Root login está deshabilitado' }
  }
  if (lower.includes('yes')) {
    return { id, category, title, description, status: 'fail', severity: 'CRITICAL', details: 'Root login via SSH está habilitado' }
  }

  return { id, category, title, description, status: 'warning', severity: 'CRITICAL', details: 'No se pudo determinar la configuración de PermitRootLogin' }
}

async function checkSSHPasswordAuth(): Promise<HardeningCheck> {
  const id = 'ssh-password-auth'
  const category = 'ssh' as const
  const title = 'SSH PasswordAuthentication'
  const description = 'Verifica que la autenticación por contraseña SSH esté deshabilitada'

  const sshd = safeExec('sshd -T 2>/dev/null | grep -i "passwordauthentication"')
  if (sshd === null) {
    return { id, category, title, description, status: 'warning', severity: 'HIGH', details: 'sshd no está instalado o no se pudo consultar' }
  }

  const lower = sshd.toLowerCase()
  if (lower.includes('no')) {
    return { id, category, title, description, status: 'pass', severity: 'HIGH', details: 'Autenticación por contraseña SSH deshabilitada' }
  }
  if (lower.includes('yes')) {
    return { id, category, title, description, status: 'fail', severity: 'HIGH', details: 'Autenticación por contraseña SSH habilitada' }
  }

  return { id, category, title, description, status: 'warning', severity: 'HIGH', details: 'No se pudo determinar la configuración de PasswordAuthentication' }
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

async function checkOpenPorts(): Promise<HardeningCheck> {
  const id = 'open-ports'
  const category = 'network' as const
  const title = 'Puertos expuestos'
  const description = 'Verifica que no haya puertos innecesarios expuestos'

  const ss = safeExec('ss -tlnp')
  if (!ss) {
    return { id, category, title, description, status: 'error', severity: 'MEDIUM', details: 'No se pudo ejecutar ss' }
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
    return { id, category, title, description, status: 'fail', severity: 'MEDIUM', details: suspicious.join('; ') }
  }

  return { id, category, title, description, status: 'pass', severity: 'MEDIUM', details: `Solo puertos conocidos: ${allKnown.join(', ') || 'ninguno'}` }
}

async function checkUpdates(): Promise<HardeningCheck> {
  const id = 'security-updates'
  const category = 'updates' as const
  const title = 'Actualizaciones de seguridad'
  const description = 'Verifica que no haya actualizaciones de seguridad pendientes'

  const apt = safeExec('apt list --upgradable 2>/dev/null | grep -i security')
  if (apt !== null) {
    const lines = apt.split('\n').filter(l => l.trim().length > 0)
    if (lines.length > 0) {
      return { id, category, title, description, status: 'fail', severity: 'HIGH', details: `${lines.length} actualizaciones de seguridad pendientes` }
    }
    return { id, category, title, description, status: 'pass', severity: 'HIGH', details: 'No hay actualizaciones de seguridad pendientes' }
  }

  const dnf = safeExec('dnf check-update --security 2>/dev/null')
  if (dnf !== null) {
    const lines = dnf.split('\n').filter(l => l.trim().length > 0 && !l.startsWith('Last metadata'))
    if (lines.length > 0) {
      return { id, category, title, description, status: 'fail', severity: 'HIGH', details: `${lines.length} actualizaciones de seguridad pendientes` }
    }
    return { id, category, title, description, status: 'pass', severity: 'HIGH', details: 'No hay actualizaciones de seguridad pendientes' }
  }

  return { id, category, title, description, status: 'warning', severity: 'HIGH', details: 'No se pudo determinar el gestor de paquetes' }
}

async function checkCoreDumps(): Promise<HardeningCheck> {
  const id = 'core-dumps'
  const category = 'system' as const
  const title = 'Core dumps'
  const description = 'Verifica que los core dumps con suid estén deshabilitados'

  const sysctl = safeExec('sysctl fs.suid_dumpable 2>/dev/null')
  if (!sysctl) {
    return { id, category, title, description, status: 'error', severity: 'MEDIUM', details: 'No se pudo consultar fs.suid_dumpable' }
  }

  const match = sysctl.match(/fs\.suid_dumpable\s*=\s*(\d)/)
  if (!match) {
    return { id, category, title, description, status: 'error', severity: 'MEDIUM', details: 'No se pudo interpretar la salida de sysctl' }
  }

  const value = match[1]
  if (value === '0') {
    return { id, category, title, description, status: 'pass', severity: 'MEDIUM', details: 'Core dumps suid deshabilitados' }
  }
  if (value === '1') {
    return { id, category, title, description, status: 'fail', severity: 'MEDIUM', details: 'Core dumps suid habilitados' }
  }
  if (value === '2') {
    return { id, category, title, description, status: 'warning', severity: 'MEDIUM', details: 'Core dumps suid en modo parcial' }
  }

  return { id, category, title, description, status: 'warning', severity: 'MEDIUM', details: `Valor inesperado fs.suid_dumpable = ${value}` }
}

export async function runHardeningChecks(): Promise<HardeningCheck[]> {
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
    const checkNames = [
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
        id: checkNames[i],
        category: 'system' as const,
        title: '',
        description: '',
        status: 'error' as const,
        severity: 'MEDIUM' as const,
        details: result.reason instanceof Error ? result.reason.message : String(result.reason),
      }
    }
    return result.value
  })
}
