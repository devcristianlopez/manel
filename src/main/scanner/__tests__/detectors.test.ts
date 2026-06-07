import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('child_process', () => {
  const mockExecSync = vi.fn()
  return {
    default: { execSync: mockExecSync },
    execSync: mockExecSync,
  }
})

import { execSync } from 'child_process'
import {
  detectOS,
  detectNode,
  detectNpm,
  detectYarn,
  detectPnpm,
  detectGit,
  detectDocker,
  detectDockerCompose,
  detectPython,
  detectPython3,
  detectPip,
  detectJava,
  detectMaven,
  detectGradle,
  detectVSCode,
} from '../detectors'

const mockExecSync = execSync as ReturnType<typeof vi.fn>

describe('safeExec behavior (tested through public detect* functions)', () => {
  beforeEach(() => { mockExecSync.mockReset() })

  it('should return result when execSync succeeds', () => {
    mockExecSync.mockReturnValue('v22.0.0\n')
    const result = detectNode()
    expect(result).not.toBeNull()
    expect(result!.version).toBe('22.0.0')
  })

  it('should return null when execSync throws', () => {
    mockExecSync.mockImplementation(() => { throw new Error('not found') })
    const result = detectNode()
    expect(result).toBeNull()
  })

  it('should return null when execSync throws non-Error', () => {
    mockExecSync.mockImplementation(() => { throw 'string error' })
    const result = detectNode()
    expect(result).toBeNull()
  })

  it('should handle empty output (version regex will not match)', () => {
    mockExecSync.mockReturnValue('')
    const result = detectNode()
    expect(result).toBeNull()
  })

  it('should call execSync with correct arguments', () => {
    mockExecSync.mockReturnValue('v22.0.0\n')
    detectNode()
    expect(mockExecSync).toHaveBeenCalledWith('node -v', { encoding: 'utf-8', timeout: 5000 })
  })
})

describe('extractVersion behavior (tested through public detect* functions)', () => {
  beforeEach(() => { mockExecSync.mockReset() })

  it('should extract version with regex from command output', () => {
    mockExecSync.mockReturnValue('v22.0.0\n')
    const result = detectNode()
    expect(result!.version).toBe('22.0.0')
  })

  it('should return null when regex does not match', () => {
    mockExecSync.mockReturnValue('hello world\n')
    const result = detectNode()
    expect(result).toBeNull()
  })

  it('should extract version from multi-line output', () => {
    mockExecSync.mockReturnValue('line1\nv18.0.0\nline3')
    const result = detectNode()
    expect(result!.version).toBe('18.0.0')
  })

  it('should extract git version with path suffix (first semver match)', () => {
    mockExecSync.mockReturnValue('git version 2.47.1.windows.1\n')
    const result = detectGit()
    expect(result!.version).toBe('2.47.1')
  })
})

describe('detectOS', () => {
  const originalPlatform = process.platform

  beforeEach(() => { mockExecSync.mockReset() })
  afterEach(() => { Object.defineProperty(process, 'platform', { value: originalPlatform }) })

  it('should detect macOS platform', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    mockExecSync.mockReturnValue('14.5.0')
    const result = detectOS()
    expect(result.platform).toBe('darwin')
    expect(result.distro).toBe('macOS')
    expect(result.version).toBe('14.5.0')
    expect(mockExecSync).toHaveBeenCalledWith('sw_vers -productVersion', { encoding: 'utf-8', timeout: 5000 })
  })

  it('should detect Windows platform from wmic output', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    mockExecSync.mockReturnValue('Caption  Version  \nMicrosoft Windows 11 Pro  10.0.22631\n')
    const result = detectOS()
    expect(result.platform).toBe('win32')
    expect(result.distro).toBe('Microsoft Windows 11 Pro')
    expect(result.version).toBe('10.0.22631')
  })

  it('should detect Linux platform', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    const result = detectOS()
    expect(result.platform).toBe('linux')
    expect(typeof result.release).toBe('string')
  })
})

describe('detectNode', () => {
  beforeEach(() => { mockExecSync.mockReset() })

  it('should detect node version', () => {
    mockExecSync.mockReturnValue('v22.0.0\n')
    expect(detectNode()).toEqual({ name: 'node', version: '22.0.0', path: 'node' })
  })

  it('should return null when node not found', () => {
    mockExecSync.mockImplementation(() => { throw new Error('not found') })
    expect(detectNode()).toBeNull()
  })
})

describe('detectNpm', () => {
  beforeEach(() => { mockExecSync.mockReset() })

  it('should detect npm version', () => {
    mockExecSync.mockReturnValue('10.9.0\n')
    expect(detectNpm()).toEqual({ name: 'npm', version: '10.9.0', path: 'npm' })
  })

  it('should return null when npm not found', () => {
    mockExecSync.mockImplementation(() => { throw new Error('not found') })
    expect(detectNpm()).toBeNull()
  })
})

describe('detectYarn', () => {
  beforeEach(() => { mockExecSync.mockReset() })

  it('should detect yarn version', () => {
    mockExecSync.mockReturnValue('1.22.22\n')
    expect(detectYarn()).toEqual({ name: 'yarn', version: '1.22.22', path: 'yarn' })
  })

  it('should return null when yarn not found', () => {
    mockExecSync.mockImplementation(() => { throw new Error('not found') })
    expect(detectYarn()).toBeNull()
  })
})

describe('detectPnpm', () => {
  beforeEach(() => { mockExecSync.mockReset() })

  it('should detect pnpm version', () => {
    mockExecSync.mockReturnValue('9.15.0\n')
    expect(detectPnpm()).toEqual({ name: 'pnpm', version: '9.15.0', path: 'pnpm' })
  })
})

describe('detectGit', () => {
  beforeEach(() => { mockExecSync.mockReset() })

  it('should detect git version', () => {
    mockExecSync.mockReturnValue('git version 2.47.1\n')
    expect(detectGit()).toEqual({ name: 'git', version: '2.47.1', path: 'git' })
  })
})

describe('detectDocker', () => {
  beforeEach(() => { mockExecSync.mockReset() })

  it('should detect docker version', () => {
    mockExecSync.mockReturnValue('Docker version 26.1.4, build 1234\n')
    expect(detectDocker()).toEqual({ name: 'docker', version: '26.1.4', path: 'docker' })
  })

  it('should return null when docker not found', () => {
    mockExecSync.mockImplementation(() => { throw new Error('not found') })
    expect(detectDocker()).toBeNull()
  })
})

describe('detectDockerCompose', () => {
  beforeEach(() => { mockExecSync.mockReset() })

  it('should detect docker-compose version', () => {
    mockExecSync.mockReturnValue('Docker Compose version v2.32.1\n')
    expect(detectDockerCompose()).toEqual({ name: 'docker-compose', version: '2.32.1', path: 'docker-compose' })
  })
})

describe('detectPython', () => {
  beforeEach(() => { mockExecSync.mockReset() })

  it('should detect python version', () => {
    mockExecSync.mockReturnValue('Python 3.12.0\n')
    expect(detectPython()).toEqual({ name: 'python', version: '3.12.0', path: 'python' })
  })

  it('should return null when python not found', () => {
    mockExecSync.mockImplementation(() => { throw new Error('not found') })
    expect(detectPython()).toBeNull()
  })
})

describe('detectPython3', () => {
  beforeEach(() => { mockExecSync.mockReset() })

  it('should detect python3 version', () => {
    mockExecSync.mockReturnValue('Python 3.13.0\n')
    expect(detectPython3()).toEqual({ name: 'python3', version: '3.13.0', path: 'python3' })
  })
})

describe('detectPip', () => {
  beforeEach(() => { mockExecSync.mockReset() })

  it('should detect pip version', () => {
    mockExecSync.mockReturnValue('pip 24.3.1 from /usr/lib/python3.12/site-packages/pip (python 3.12)\n')
    expect(detectPip()).toEqual({ name: 'pip', version: '24.3.1', path: 'pip' })
  })

  it('should return null when pip not found', () => {
    mockExecSync.mockImplementation(() => { throw new Error('not found') })
    expect(detectPip()).toBeNull()
  })
})

describe('detectJava', () => {
  beforeEach(() => { mockExecSync.mockReset() })

  it('should detect java version from stderr via 2>&1', () => {
    mockExecSync.mockReturnValue('java version "21.0.5" 2024-10-15 LTS\n')
    expect(detectJava()).toEqual({ name: 'java', version: '21.0.5', path: 'java' })
  })

  it('should return null when java not found', () => {
    mockExecSync.mockImplementation(() => { throw new Error('not found') })
    expect(detectJava()).toBeNull()
  })
})

describe('detectMaven', () => {
  beforeEach(() => { mockExecSync.mockReset() })

  it('should detect maven version', () => {
    mockExecSync.mockReturnValue('Apache Maven 3.9.9\n')
    expect(detectMaven()).toEqual({ name: 'mvn', version: '3.9.9', path: 'mvn' })
  })

  it('should return null when maven not found', () => {
    mockExecSync.mockImplementation(() => { throw new Error('not found') })
    expect(detectMaven()).toBeNull()
  })
})

describe('detectGradle', () => {
  beforeEach(() => { mockExecSync.mockReset() })

  it('should detect gradle version', () => {
    mockExecSync.mockReturnValue('Gradle 8.11.1\n')
    expect(detectGradle()).toEqual({ name: 'gradle', version: '8.11.1', path: 'gradle' })
  })

  it('should return null when gradle not found', () => {
    mockExecSync.mockImplementation(() => { throw new Error('not found') })
    expect(detectGradle()).toBeNull()
  })
})

describe('detectVSCode', () => {
  beforeEach(() => { mockExecSync.mockReset() })

  it('should detect vscode version', () => {
    mockExecSync.mockReturnValue('1.95.3\nabcdefg\n')
    expect(detectVSCode()).toEqual({ name: 'code', version: '1.95.3', path: 'code' })
  })

  it('should return null when vscode not found', () => {
    mockExecSync.mockImplementation(() => { throw new Error('not found') })
    expect(detectVSCode()).toBeNull()
  })

  it('should return null when version line is invalid', () => {
    mockExecSync.mockReturnValue('')
    expect(detectVSCode()).toBeNull()
  })
})
