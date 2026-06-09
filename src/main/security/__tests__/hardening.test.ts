import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('child_process', () => {
  const mockExecSync = vi.fn()
  return {
    default: { execSync: mockExecSync },
    execSync: mockExecSync,
  }
})

import { execSync } from 'child_process'
import { runHardeningChecks } from '../hardening'

const mockExecSync = execSync as ReturnType<typeof vi.fn>

describe('runHardeningChecks (platform check)', () => {
  const originalPlatform = process.platform

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  it('should return empty array when platform is not linux', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    const results = await runHardeningChecks()
    expect(results).toEqual([])
  })

  it('should return empty array on windows', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    const results = await runHardeningChecks()
    expect(results).toEqual([])
  })
})

describe('checkFirewall (tested through runHardeningChecks)', () => {
  const originalPlatform = process.platform

  beforeEach(() => { mockExecSync.mockReset() })
  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
  })
  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  it('should pass when ufw is active', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd === 'ufw status') return 'Status: active'
      throw new Error('not found')
    })
    const results = await runHardeningChecks()
    const firewall = results.find(r => r.id === 'firewall-active')
    expect(firewall).toBeDefined()
    expect(firewall!.status).toBe('pass')
    expect(firewall!.details).toContain('UFW')
  })

  it('should pass when firewalld is running', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd === 'ufw status') return null // ufw returns null (execSync succeeds but output is empty/null-ish)
      if (cmd === 'firewall-cmd --state') return 'running'
      throw new Error('not found')
    })
    const results = await runHardeningChecks()
    const firewall = results.find(r => r.id === 'firewall-active')
    expect(firewall).toBeDefined()
    expect(firewall!.status).toBe('pass')
    expect(firewall!.details).toContain('firewalld')
  })

  it('should pass when iptables has rules configured', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd === 'ufw status') return null
      if (cmd === 'firewall-cmd --state') return null
      if (cmd === 'iptables -L -n') return 'Chain INPUT (policy ACCEPT)\ntarget'
      throw new Error('not found')
    })
    const results = await runHardeningChecks()
    const firewall = results.find(r => r.id === 'firewall-active')
    expect(firewall).toBeDefined()
    expect(firewall!.status).toBe('pass')
    expect(firewall!.details).toContain('iptables')
  })

  it('should fail when no firewall is detected', async () => {
    mockExecSync.mockReturnValue(null)
    const results = await runHardeningChecks()
    const firewall = results.find(r => r.id === 'firewall-active')
    expect(firewall).toBeDefined()
    expect(firewall!.status).toBe('fail')
    expect(firewall!.details).toContain('No se detectó firewall')
  })
})

describe('checkSELinux (tested through runHardeningChecks)', () => {
  const originalPlatform = process.platform

  beforeEach(() => { mockExecSync.mockReset() })
  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
  })
  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  it('should pass when SELinux is enforcing', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd === 'getenforce') return 'Enforcing'
      throw new Error('not found')
    })
    const results = await runHardeningChecks()
    const selinux = results.find(r => r.id === 'selinux-apparmor')
    expect(selinux).toBeDefined()
    expect(selinux!.status).toBe('pass')
    expect(selinux!.details).toContain('Enforcing')
  })

  it('should return warning when SELinux is permissive', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd === 'getenforce') return 'Permissive'
      throw new Error('not found')
    })
    const results = await runHardeningChecks()
    const selinux = results.find(r => r.id === 'selinux-apparmor')
    expect(selinux).toBeDefined()
    expect(selinux!.status).toBe('warning')
    expect(selinux!.details).toContain('Permissive')
  })

  it('should return fail when SELinux is disabled', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd === 'getenforce') return 'Disabled'
      throw new Error('not found')
    })
    const results = await runHardeningChecks()
    const selinux = results.find(r => r.id === 'selinux-apparmor')
    expect(selinux).toBeDefined()
    expect(selinux!.status).toBe('fail')
    expect(selinux!.details).toContain('deshabilitado')
  })

  it('should pass when AppArmor is enabled', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd === 'getenforce') return null
      if (cmd === 'aa-status --enabled') return 'enabled'
      throw new Error('not found')
    })
    const results = await runHardeningChecks()
    const selinux = results.find(r => r.id === 'selinux-apparmor')
    expect(selinux).toBeDefined()
    expect(selinux!.status).toBe('pass')
    expect(selinux!.details).toContain('AppArmor')
  })

  it('should fail when neither SELinux nor AppArmor is detected', async () => {
    mockExecSync.mockReturnValue(null)
    const results = await runHardeningChecks()
    const selinux = results.find(r => r.id === 'selinux-apparmor')
    expect(selinux).toBeDefined()
    expect(selinux!.status).toBe('fail')
    expect(selinux!.details).toContain('No se detectó SELinux')
  })
})

describe('checkSSHRootLogin (tested through runHardeningChecks)', () => {
  const originalPlatform = process.platform

  beforeEach(() => { mockExecSync.mockReset() })
  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
  })
  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  it('should pass when PermitRootLogin is prohibit-password', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('permitrootlogin') || cmd.includes('PermitRootLogin')) {
        return 'PermitRootLogin prohibit-password'
      }
      throw new Error('not found')
    })
    const results = await runHardeningChecks()
    const sshRoot = results.find(r => r.id === 'ssh-root-login')
    expect(sshRoot).toBeDefined()
    expect(sshRoot!.status).toBe('pass')
    expect(sshRoot!.details).toContain('solo con llaves')
  })

  it('should pass when PermitRootLogin is without-password', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('permitrootlogin') || cmd.includes('PermitRootLogin')) {
        return 'PermitRootLogin without-password'
      }
      throw new Error('not found')
    })
    const results = await runHardeningChecks()
    const sshRoot = results.find(r => r.id === 'ssh-root-login')
    expect(sshRoot).toBeDefined()
    expect(sshRoot!.status).toBe('pass')
  })

  it('should pass when PermitRootLogin is no', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('permitrootlogin') || cmd.includes('PermitRootLogin')) {
        return 'PermitRootLogin no'
      }
      throw new Error('not found')
    })
    const results = await runHardeningChecks()
    const sshRoot = results.find(r => r.id === 'ssh-root-login')
    expect(sshRoot).toBeDefined()
    expect(sshRoot!.status).toBe('pass')
    expect(sshRoot!.details).toContain('deshabilitado')
  })

  it('should fail when PermitRootLogin is yes', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('permitrootlogin') || cmd.includes('PermitRootLogin')) {
        return 'PermitRootLogin yes'
      }
      throw new Error('not found')
    })
    const results = await runHardeningChecks()
    const sshRoot = results.find(r => r.id === 'ssh-root-login')
    expect(sshRoot).toBeDefined()
    expect(sshRoot!.status).toBe('fail')
    expect(sshRoot!.details).toContain('habilitado')
  })

  it('should return warning when sshd is not installed', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('permitrootlogin') || cmd.startsWith('sshd')) return null
      throw new Error('not found')
    })
    const results = await runHardeningChecks()
    const sshRoot = results.find(r => r.id === 'ssh-root-login')
    expect(sshRoot).toBeDefined()
    expect(sshRoot!.status).toBe('warning')
    expect(sshRoot!.details).toContain('sshd no está instalado')
  })
})

describe('checkSSHPasswordAuth (tested through runHardeningChecks)', () => {
  const originalPlatform = process.platform

  beforeEach(() => { mockExecSync.mockReset() })
  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
  })
  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  it('should pass when PasswordAuthentication is no', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('passwordauthentication') || cmd.includes('PasswordAuthentication')) {
        return 'PasswordAuthentication no'
      }
      throw new Error('not found')
    })
    const results = await runHardeningChecks()
    const sshPass = results.find(r => r.id === 'ssh-password-auth')
    expect(sshPass).toBeDefined()
    expect(sshPass!.status).toBe('pass')
    expect(sshPass!.details).toContain('deshabilitada')
  })

  it('should fail when PasswordAuthentication is yes', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('passwordauthentication') || cmd.includes('PasswordAuthentication')) {
        return 'PasswordAuthentication yes'
      }
      throw new Error('not found')
    })
    const results = await runHardeningChecks()
    const sshPass = results.find(r => r.id === 'ssh-password-auth')
    expect(sshPass).toBeDefined()
    expect(sshPass!.status).toBe('fail')
    expect(sshPass!.details).toContain('habilitada')
  })

  it('should return warning when sshd is not installed', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('passwordauthentication') || cmd.startsWith('sshd')) return null
      throw new Error('not found')
    })
    const results = await runHardeningChecks()
    const sshPass = results.find(r => r.id === 'ssh-password-auth')
    expect(sshPass).toBeDefined()
    expect(sshPass!.status).toBe('warning')
    expect(sshPass!.details).toContain('sshd no está instalado')
  })
})

describe('checkOpenPorts (tested through runHardeningChecks)', () => {
  const originalPlatform = process.platform

  beforeEach(() => { mockExecSync.mockReset() })
  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
  })
  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  it('should pass when only common ports are open', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd === 'ss -tlnp') {
        return 'LISTEN 0 128 0.0.0.0:22 0.0.0.0:*\nLISTEN 0 128 0.0.0.0:80 0.0.0.0:*\nLISTEN 0 128 0.0.0.0:443 0.0.0.0:*'
      }
      throw new Error('not found')
    })
    const results = await runHardeningChecks()
    const ports = results.find(r => r.id === 'open-ports')
    expect(ports).toBeDefined()
    expect(ports!.status).toBe('pass')
    expect(ports!.details).toContain('Solo puertos conocidos')
  })

  it('should fail when dangerous ports are open', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd === 'ss -tlnp') {
        return 'LISTEN 0 128 0.0.0.0:23 0.0.0.0:*\nLISTEN 0 128 0.0.0.0:80 0.0.0.0:*'
      }
      throw new Error('not found')
    })
    const results = await runHardeningChecks()
    const ports = results.find(r => r.id === 'open-ports')
    expect(ports).toBeDefined()
    expect(ports!.status).toBe('fail')
    expect(ports!.details).toContain('Puerto peligroso')
  })

  it('should fail when unknown ports are open', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd === 'ss -tlnp') {
        return 'LISTEN 0 128 0.0.0.0:9999 0.0.0.0:*'
      }
      throw new Error('not found')
    })
    const results = await runHardeningChecks()
    const ports = results.find(r => r.id === 'open-ports')
    expect(ports).toBeDefined()
    expect(ports!.status).toBe('fail')
    expect(ports!.details).toContain('Puerto desconocido')
  })

  it('should return error when ss command fails', async () => {
    mockExecSync.mockReturnValue(null)
    const results = await runHardeningChecks()
    const ports = results.find(r => r.id === 'open-ports')
    expect(ports).toBeDefined()
    expect(ports!.status).toBe('error')
    expect(ports!.details).toContain('No se pudo ejecutar ss')
  })
})

describe('checkUpdates (tested through runHardeningChecks)', () => {
  const originalPlatform = process.platform

  beforeEach(() => { mockExecSync.mockReset() })
  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
  })
  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  it('should pass when apt has no security updates', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('apt') && cmd.includes('upgradable')) return ''
      throw new Error('not found')
    })
    const results = await runHardeningChecks()
    const updates = results.find(r => r.id === 'security-updates')
    expect(updates).toBeDefined()
    expect(updates!.status).toBe('pass')
  })

  it('should fail when apt has security updates', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('apt') && cmd.includes('upgradable')) {
        return 'libssl1.1/stable-security 1.1.1n-0+deb10u6 amd64 [upgradable from: 1.1.1n-0+deb10u1]\nopenssl/stable-security 1.1.1n-0+deb10u6 amd64 [upgradable from: 1.1.1n-0+deb10u1]'
      }
      throw new Error('not found')
    })
    const results = await runHardeningChecks()
    const updates = results.find(r => r.id === 'security-updates')
    expect(updates).toBeDefined()
    expect(updates!.status).toBe('fail')
    expect(updates!.details).toContain('2 actualizaciones')
  })

  it('should pass when dnf has no security updates', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('apt') && cmd.includes('upgradable')) return null
      if (cmd.includes('dnf') && cmd.includes('check-update')) return 'Last metadata expiration check: 1:00:00 ago'
      throw new Error('not found')
    })
    const results = await runHardeningChecks()
    const updates = results.find(r => r.id === 'security-updates')
    expect(updates).toBeDefined()
    expect(updates!.status).toBe('pass')
  })

  it('should fail when dnf has security updates', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('apt') && cmd.includes('upgradable')) return null
      if (cmd.includes('dnf') && cmd.includes('check-update')) {
        return 'Last metadata expiration check: 1:00:00 ago\nkernel.x86_64 5.14.0-503.el9 updates\nopenssl.x86_64 3.0.7-25.el9_4 updates'
      }
      throw new Error('not found')
    })
    const results = await runHardeningChecks()
    const updates = results.find(r => r.id === 'security-updates')
    expect(updates).toBeDefined()
    expect(updates!.status).toBe('fail')
    expect(updates!.details).toContain('2 actualizaciones')
  })

  it('should return warning when no package manager is detected', async () => {
    mockExecSync.mockReturnValue(null)
    const results = await runHardeningChecks()
    const updates = results.find(r => r.id === 'security-updates')
    expect(updates).toBeDefined()
    expect(updates!.status).toBe('warning')
    expect(updates!.details).toContain('No se pudo determinar el gestor de paquetes')
  })
})

describe('checkCoreDumps (tested through runHardeningChecks)', () => {
  const originalPlatform = process.platform

  beforeEach(() => { mockExecSync.mockReset() })
  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
  })
  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  it('should pass when fs.suid_dumpable is 0', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('suid_dumpable')) return 'fs.suid_dumpable = 0'
      throw new Error('not found')
    })
    const results = await runHardeningChecks()
    const coredump = results.find(r => r.id === 'core-dumps')
    expect(coredump).toBeDefined()
    expect(coredump!.status).toBe('pass')
    expect(coredump!.details).toContain('deshabilitados')
  })

  it('should fail when fs.suid_dumpable is 1', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('suid_dumpable')) return 'fs.suid_dumpable = 1'
      throw new Error('not found')
    })
    const results = await runHardeningChecks()
    const coredump = results.find(r => r.id === 'core-dumps')
    expect(coredump).toBeDefined()
    expect(coredump!.status).toBe('fail')
    expect(coredump!.details).toContain('habilitados')
  })

  it('should return warning when fs.suid_dumpable is 2', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('suid_dumpable')) return 'fs.suid_dumpable = 2'
      throw new Error('not found')
    })
    const results = await runHardeningChecks()
    const coredump = results.find(r => r.id === 'core-dumps')
    expect(coredump).toBeDefined()
    expect(coredump!.status).toBe('warning')
    expect(coredump!.details).toContain('parcial')
  })

  it('should return error when sysctl command fails', async () => {
    mockExecSync.mockReturnValue(null)
    const results = await runHardeningChecks()
    const coredump = results.find(r => r.id === 'core-dumps')
    expect(coredump).toBeDefined()
    expect(coredump!.status).toBe('error')
    expect(coredump!.details).toContain('No se pudo consultar')
  })
})

describe('runHardeningChecks (error handling)', () => {
  const originalPlatform = process.platform

  beforeEach(() => { mockExecSync.mockReset() })
  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
  })
  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  it('should run all 7 checks and return results', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd === 'ufw status') return 'Status: active'
      if (cmd === 'getenforce') return 'Enforcing'
      if (cmd.includes('permitrootlogin')) return 'PermitRootLogin no'
      if (cmd.includes('passwordauthentication')) return 'PasswordAuthentication no'
      if (cmd === 'ss -tlnp') return 'LISTEN 0 128 0.0.0.0:22 0.0.0.0:*'
      if (cmd.includes('apt') && cmd.includes('upgradable')) return ''
      if (cmd.includes('suid_dumpable')) return 'fs.suid_dumpable = 0'
      return null
    })
    const results = await runHardeningChecks()
    expect(results).toHaveLength(7)
    expect(results.every(r => r.id)).toBe(true)
    expect(results.every(r => r.category)).toBe(true)
    expect(results.every(r => r.severity)).toBe(true)
  })

  it('should handle errors gracefully with Promise.allSettled', async () => {
    // Make all execSync calls throw
    mockExecSync.mockImplementation(() => { throw new Error('unexpected error') })
    const results = await runHardeningChecks()
    expect(results).toHaveLength(7)
    // All should have status error or fail/warning since safeExec catches errors
    results.forEach(r => {
      expect(['pass', 'fail', 'warning', 'error']).toContain(r.status)
    })
  })

  it('should handle mixed pass/fail/warning/error statuses', async () => {
    // Return different values based on command
    mockExecSync.mockImplementation((cmd: string) => {
      // Firewall: active (pass)
      if (cmd === 'ufw status') return 'Status: active'
      // SELinux: permissive (warning)
      if (cmd === 'getenforce') return 'Permissive'
      // SSH root: yes (fail)
      if (cmd.includes('permitrootlogin')) return 'PermitRootLogin yes'
      // SSH password: no (pass)
      if (cmd.includes('passwordauthentication')) return 'PasswordAuthentication no'
      // Open ports: only known (pass)
      if (cmd === 'ss -tlnp') return 'LISTEN 0 128 0.0.0.0:22 0.0.0.0:*'
      // Updates: none (pass)
      if (cmd.includes('apt') && cmd.includes('upgradable')) return ''
      // Core dumps: enabled (fail)
      if (cmd.includes('suid_dumpable')) return 'fs.suid_dumpable = 1'
      return null
    })
    const results = await runHardeningChecks()
    expect(results).toHaveLength(7)
    const passes = results.filter(r => r.status === 'pass')
    const fails = results.filter(r => r.status === 'fail')
    const warnings = results.filter(r => r.status === 'warning')
    expect(passes.length).toBeGreaterThanOrEqual(3)
    expect(fails.length).toBeGreaterThanOrEqual(2)
    expect(warnings.length).toBeGreaterThanOrEqual(1)
  })
})
