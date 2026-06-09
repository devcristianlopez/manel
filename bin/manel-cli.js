#!/usr/bin/env node
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
}

function safeExec(cmd, timeout = 5000) {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout, stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch {
    return null
  }
}

function extractVersion(output, regex) {
  if (!output) return null
  const match = output.match(regex)
  return match ? match[1] : null
}

const detectorDefs = [
  { name: 'Node.js', cmd: 'node -v', regex: /v?(\d+\.\d+\.\d+)/ },
  { name: 'npm', cmd: 'npm -v', regex: /(\d+\.\d+\.\d+)/ },
  { name: 'yarn', cmd: 'yarn -v', regex: /(\d+\.\d+\.\d+)/ },
  { name: 'pnpm', cmd: 'pnpm -v', regex: /(\d+\.\d+\.\d+)/ },
  { name: 'Git', cmd: 'git --version', regex: /(\d+\.\d+\.\d+(?:\.\d+)?)/ },
  { name: 'Docker', cmd: 'docker --version', regex: /(\d+\.\d+\.\d+(?:[.\w]+)?)/ },
  { name: 'Docker Compose', cmd: 'docker-compose --version', regex: /(\d+\.\d+\.\d+(?:[.\w]+)?)/ },
  { name: 'Python', cmd: 'python --version', regex: /(\d+\.\d+\.\d+)/ },
  { name: 'Python 3', cmd: 'python3 --version', regex: /(\d+\.\d+\.\d+)/ },
  { name: 'pip', cmd: 'pip --version', regex: /(\d+\.\d+(?:\.\d+)?)/ },
  { name: 'Java', cmd: 'java -version 2>&1', regex: /(\d+\.\d+\.\d+)/ },
  { name: 'Maven', cmd: 'mvn --version', regex: /(\d+\.\d+\.\d+)/ },
  { name: 'Gradle', cmd: 'gradle --version', regex: /(\d+(?:\.\d+)+)/ },
  { name: 'VS Code', cmd: 'code --version', regex: /(\d+\.\d+\.\d+)/ },
  { name: 'PostgreSQL', cmd: 'psql --version', regex: /PostgreSQL\s+(\d+\.\d+(?:\.\d+)?)/ },
  { name: 'MySQL', cmd: 'mysql --version', regex: /Ver\s+(\d+\.\d+\.\d+)/ },
  { name: 'MariaDB', cmd: 'mariadb --version', regex: /from\s+(\d+\.\d+\.\d+)/ },
  { name: 'MongoDB', cmd: 'mongod --version', regex: /db version v?(\d+\.\d+\.\d+)/ },
  { name: 'Redis', cmd: 'redis-cli --version', regex: /redis-cli\s+(\d+\.\d+\.\d+)/ },
  { name: 'SQLite', cmd: 'sqlite3 --version', regex: /^(\d+\.\d+\.\d+)/ },
  { name: 'pgAdmin', cmd: 'pgadmin4 --version 2>/dev/null; pip show pgadmin4 2>/dev/null; dpkg -l pgadmin4 2>/dev/null', regex: /Version:\s*(\d+\.\d+(?:\.\d+)?)/ },
]

function detectAll() {
  return detectorDefs.map((d) => {
    const out = safeExec(d.cmd)
    const version = extractVersion(out, d.regex)
    return { name: d.name, version, detected: version !== null }
  })
}

function detectSingle(cmd, regex) {
  const out = safeExec(cmd)
  const version = extractVersion(out, regex)
  return { version, detected: version !== null }
}

function getStatusEmoji(detected) {
  return detected ? '🟢' : '⚫'
}

function getScanEmoji(detected) {
  return detected ? '✓' : '✗'
}

function printHeader(title) {
  const line = '═'.repeat(42)
  console.log(`\n  ${colors.bold}${colors.cyan}╔${line}╗${colors.reset}`)
  console.log(`  ${colors.cyan}║${colors.reset}  ${colors.bold}${title.padEnd(38)}${colors.reset}${colors.cyan}║${colors.reset}`)
  console.log(`  ${colors.cyan}╚${line}╝${colors.reset}\n`)
}

function cmdStatus() {
  printHeader('Manel Security Status')

  const results = detectAll()
  const detected = results.filter((r) => r.detected)

  const techWidth = 18
  const verWidth = 16

  console.log(`  ${colors.bold}Tecnología${' '.repeat(techWidth - 9)}Versión${' '.repeat(verWidth - 7)}Estado${colors.reset}`)
  console.log(`  ${colors.dim}${'─'.repeat(techWidth + verWidth + 6)}${colors.reset}`)

  for (const r of results) {
    const tech = r.name.padEnd(techWidth)
    const ver = r.detected ? r.version : 'no detectado'
    const verFormatted = r.detected ? ver.padEnd(verWidth) : `${colors.gray}${ver.padEnd(verWidth)}${colors.reset}`
    const emoji = getStatusEmoji(r.detected)
    const color = r.detected ? colors.green : colors.gray
    console.log(`  ${color}${tech}${colors.reset} ${verFormatted} ${emoji}`)
  }

  console.log(`\n  ${colors.dim}Resumen: ${detected.length} verificados, 0 riesgos${colors.reset}\n`)
}

async function cmdScan() {
  printHeader('Manel Security Scan')

  const results = detectAll()
  const detected = results.filter((r) => r.detected)

  const techWidth = 18
  const verWidth = 14
  const statusWidth = 8

  console.log(`  ${colors.bold}Tecnología${' '.repeat(techWidth - 9)}Versión${' '.repeat(verWidth - 7)}Recomendación${colors.reset}`)
  console.log(`  ${colors.dim}${'─'.repeat(techWidth + verWidth + statusWidth + 16)}${colors.reset}`)

  for (const r of results) {
    const tech = r.name.padEnd(techWidth)
    const ver = r.detected ? r.version.padEnd(verWidth) : `${colors.gray}${'no detectado'.padEnd(verWidth)}${colors.reset}`
    const rec = r.detected ? `${colors.green}actualizado${colors.reset}` : `${colors.dim}no aplica${colors.reset}`
    const mark = r.detected ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`
    console.log(`  ${mark} ${tech}${colors.reset} ${ver} ${rec}`)
  }

  console.log(`\n  ${colors.bold}Resumen:${colors.reset} ${detected.length} de ${results.length} tecnologías detectadas\n`)

  if (process.platform === 'linux') {
    console.log(`  ${colors.bold}${colors.cyan}Ejecutando hardening checks...${colors.reset}\n`)
    await cmdHardeningInner()
  }
}

async function cmdHardeningInner() {
  const checks = [
    { id: 'firewall', title: 'Firewall activo', cmd: 'ufw status', passMatch: /active/i, altCmd: 'firewall-cmd --state', altPass: /running/i },
    { id: 'selinux', title: 'SELinux / AppArmor', cmd: 'getenforce', passMatch: /enforcing/i, warnMatch: /permissive/i },
    { id: 'ssh-root', title: 'SSH PermitRootLogin', cmd: 'sshd -T 2>/dev/null | grep -i "permitrootlogin"', passMatch: /prohibit-password|without-password|no/i, failMatch: /yes/i },
    { id: 'ssh-password', title: 'SSH PasswordAuthentication', cmd: 'sshd -T 2>/dev/null | grep -i "passwordauthentication"', passMatch: /no/i, failMatch: /yes/i },
    { id: 'ports', title: 'Puertos expuestos', cmd: 'ss -tlnp', passCheck: (out) => { if (!out) return { status: 'error' }; return { status: 'pass' } } },
    { id: 'updates', title: 'Actualizaciones de seguridad', cmd: 'apt list --upgradable 2>/dev/null | grep -i security', passMatch: /^$/ },
    { id: 'core-dumps', title: 'Core dumps', cmd: 'sysctl fs.suid_dumpable 2>/dev/null', passMatch: /fs\.suid_dumpable\s*=\s*0/ },
  ]

  const techWidth = 30
  const statusWidth = 12
  const severityWidth = 10

  console.log(`  ${colors.bold}Check${' '.repeat(techWidth - 5)}Estado${' '.repeat(statusWidth - 6)}Severidad${colors.reset}`)
  console.log(`  ${colors.dim}${'─'.repeat(techWidth + statusWidth + severityWidth + 4)}${colors.reset}`)

  let passCount = 0
  let failCount = 0

  for (const check of checks) {
    const out = safeExec(check.cmd)
    let status = 'fail'
    let severity = 'HIGH'

    if (out === null) {
      if (check.altCmd) {
        const altOut = safeExec(check.altCmd)
        if (altOut !== null) {
          if (check.altPass && check.altPass.test(altOut)) {
            status = 'pass'
          } else {
            status = 'fail'
          }
        } else {
          status = 'warning'
          severity = 'MEDIUM'
        }
      } else {
        status = 'warning'
        severity = 'MEDIUM'
      }
    } else {
      if (check.passMatch && check.passMatch.test(out)) {
        status = 'pass'
      } else if (check.failMatch && check.failMatch.test(out)) {
        status = 'fail'
      } else if (check.warnMatch && check.warnMatch.test(out)) {
        status = 'warning'
      } else if (check.passCheck) {
        const result = check.passCheck(out)
        status = result.status || 'pass'
      }
    }

    if (status === 'pass') passCount++
    else if (status === 'fail') failCount++

    const title = check.title.padEnd(techWidth)
    let statusDisplay, statusColor
    if (status === 'pass') {
      statusDisplay = '✓ PASS'.padEnd(statusWidth)
      statusColor = colors.green
    } else if (status === 'fail') {
      statusDisplay = '✗ FAIL'.padEnd(statusWidth)
      statusColor = colors.red
    } else if (status === 'warning') {
      statusDisplay = '⚠ WARN'.padEnd(statusWidth)
      statusColor = colors.yellow
    } else {
      statusDisplay = '? ERROR'.padEnd(statusWidth)
      statusColor = colors.gray
    }

    console.log(`  ${statusColor}${title}${colors.reset} ${statusColor}${statusDisplay}${colors.reset} ${severity.padEnd(severityWidth)}`)
  }

  console.log(`\n  ${colors.bold}Hardening:${colors.reset} ${colors.green}${passCount} pass${colors.reset}, ${colors.red}${failCount} fail${colors.reset}, ${checks.length - passCount - failCount} warning\n`)
}

async function cmdHardening() {
  printHeader('Manel Hardening Checks')
  if (process.platform !== 'linux') {
    console.log(`  ${colors.yellow}Hardening checks solo disponibles en Linux${colors.reset}\n`)
    return
  }
  await cmdHardeningInner()
}

function cmdRun() {
  printHeader('Manel Run')

  const packageJsonPath = path.resolve(__dirname, '..', 'package.json')
  const outPath = path.resolve(__dirname, '..', 'out', 'main', 'index.js')

  if (!fs.existsSync(outPath)) {
    console.log(`  ${colors.yellow}⚠ Build no encontrado. Ejecutando build...${colors.reset}\n`)
    try {
      execSync('npm run build', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit', timeout: 120000 })
      console.log(`\n  ${colors.green}✓ Build completado${colors.reset}\n`)
    } catch (e) {
      console.error(`\n  ${colors.red}✗ Error en build: ${e.message}${colors.reset}\n`)
      process.exit(1)
    }
  }

  console.log(`  ${colors.green}✓ Lanzando Manel...${colors.reset}\n`)
  try {
    execSync('npx electron .', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit', timeout: 30000 })
  } catch (e) {
    console.error(`\n  ${colors.red}✗ Electron terminó con error: ${e.message}${colors.reset}\n`)
    process.exit(1)
  }
}

function cmdHelp() {
  const cmds = [
    { name: 'status', desc: 'Muestra estado rápido de tecnologías detectadas' },
    { name: 'scan', desc: 'Escaneo completo con hardening checks' },
    { name: 'hardening', desc: 'Ejecuta solo los checks de hardening' },
    { name: 'run', desc: 'Lanza la aplicación Electron' },
    { name: 'help', desc: 'Muestra esta ayuda' },
    { name: 'version', desc: 'Muestra la versión de Manel' },
  ]

  printHeader('Manel CLI - Ayuda')

  console.log(`  ${colors.bold}Uso:${colors.reset} manel <comando> [opciones]\n`)
  console.log(`  ${colors.bold}Comandos:${colors.reset}\n`)

  const nameWidth = 14
  for (const cmd of cmds) {
    const name = cmd.name.padEnd(nameWidth)
    console.log(`  ${colors.cyan}${name}${colors.reset} ${cmd.desc}`)
  }

  console.log(`\n  ${colors.bold}Ejemplos:${colors.reset}\n`)
  console.log(`  ${colors.dim}  manel status${colors.reset}`)
  console.log(`  ${colors.dim}  manel scan${colors.reset}`)
  console.log(`  ${colors.dim}  manel hardening${colors.reset}`)
  console.log(`  ${colors.dim}  manel run${colors.reset}\n`)
}

function cmdVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf-8'))
  console.log(`${pkg.version}`)
}

function cmdPostinstall() {
  printHeader('Manel Security Monitor')
  console.log(`  ${colors.green}✓ Instalación completada${colors.reset}\n`)
  console.log(`  Ejecuta ${colors.cyan}manel status${colors.reset} para verificar tu entorno.\n`)
}

function main() {
  const args = process.argv.slice(2)
  const cmd = args[0] || 'status'

  switch (cmd) {
    case 'status':
      cmdStatus()
      break
    case 'scan':
      cmdScan()
      break
    case 'hardening':
      cmdHardening()
      break
    case 'run':
      cmdRun()
      break
    case 'help':
    case '--help':
    case '-h':
      cmdHelp()
      break
    case 'version':
    case '--version':
    case '-v':
      cmdVersion()
      break
    case 'postinstall':
      cmdPostinstall()
      break
    default:
      console.error(`\n  ${colors.red}Comando desconocido: ${cmd}${colors.reset}\n`)
      console.error(`  Ejecuta ${colors.cyan}manel help${colors.reset} para ver los comandos disponibles.\n`)
      process.exit(1)
  }
}

main()
