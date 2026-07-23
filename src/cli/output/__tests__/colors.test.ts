/**
 * Tests for src/cli/output/colors
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  red, green, yellow, blue, cyan, magenta,
  bold, dim, reset,
  severityColor, statusColor, scoreColor,
} from '../colors'

describe('Colors', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.FORCE_COLOR
    delete process.env.NO_COLOR
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('color functions (forceColor: true)', () => {
    it('should wrap text in red ANSI codes', () => {
      expect(red('error', { forceColor: true })).toBe('\x1b[31merror\x1b[0m')
    })

    it('should wrap text in green ANSI codes', () => {
      expect(green('ok', { forceColor: true })).toBe('\x1b[32mok\x1b[0m')
    })

    it('should wrap text in yellow ANSI codes', () => {
      expect(yellow('warn', { forceColor: true })).toBe('\x1b[33mwarn\x1b[0m')
    })

    it('should wrap text in blue ANSI codes', () => {
      expect(blue('info', { forceColor: true })).toBe('\x1b[34minfo\x1b[0m')
    })

    it('should wrap text in cyan ANSI codes', () => {
      expect(cyan('data', { forceColor: true })).toBe('\x1b[36mdata\x1b[0m')
    })

    it('should wrap text in magenta ANSI codes', () => {
      expect(magenta('accent', { forceColor: true })).toBe('\x1b[35maccent\x1b[0m')
    })

    it('should wrap text in bold ANSI codes', () => {
      expect(bold('title', { forceColor: true })).toBe('\x1b[1mtitle\x1b[0m')
    })

    it('should wrap text in dim ANSI codes', () => {
      expect(dim('muted', { forceColor: true })).toBe('\x1b[2mmuted\x1b[0m')
    })
  })

  describe('color functions (forceColor: false / no options)', () => {
    it('should return plain text when forceColor is false', () => {
      expect(red('error', { forceColor: false })).toBe('error')
      expect(green('ok', { forceColor: false })).toBe('ok')
    })

    it('forceColor should override NO_COLOR', () => {
      process.env.NO_COLOR = '1'
      // forceColor: true explicitly overrides NO_COLOR
      expect(red('error', { forceColor: true })).toBe('\x1b[31merror\x1b[0m')
    })

    it('should respect NO_COLOR when no forceColor', () => {
      process.env.NO_COLOR = '1'
      expect(red('error')).toBe('error')
    })

    it('forceColor should take precedence over FORCE_COLOR env', () => {
      process.env.FORCE_COLOR = '1'
      // forceColor: false explicitly disables colors
      expect(red('error', { forceColor: false })).toBe('error')
    })

    it('should respect FORCE_COLOR env when no forceColor param', () => {
      process.env.FORCE_COLOR = '1'
      expect(red('error')).toBe('\x1b[31merror\x1b[0m')
    })

    it('should auto-detect when no forceColor', () => {
      // In test environment (jsdom), stdout.isTTY is typically undefined/false
      expect(red('error')).toBe('error')
    })
  })

  describe('reset', () => {
    it('should return reset code when forceColor is true', () => {
      expect(reset({ forceColor: true })).toBe('\x1b[0m')
    })

    it('should return empty string when forceColor is false', () => {
      expect(reset({ forceColor: false })).toBe('')
    })
  })

  describe('severityColor', () => {
    it('should color CRITICAL in red', () => {
      expect(severityColor('CRITICAL', 'CRITICAL', { forceColor: true })).toBe('\x1b[31mCRITICAL\x1b[0m')
    })

    it('should color HIGH in red', () => {
      expect(severityColor('HIGH', 'HIGH', { forceColor: true })).toBe('\x1b[31mHIGH\x1b[0m')
    })

    it('should color MEDIUM in yellow', () => {
      expect(severityColor('MEDIUM', 'MEDIUM', { forceColor: true })).toBe('\x1b[33mMEDIUM\x1b[0m')
    })

    it('should color LOW in cyan', () => {
      expect(severityColor('LOW', 'LOW', { forceColor: true })).toBe('\x1b[36mLOW\x1b[0m')
    })

    it('should not color when forceColor is false', () => {
      expect(severityColor('CRITICAL', 'CRITICAL', { forceColor: false })).toBe('CRITICAL')
    })
  })

  describe('statusColor', () => {
    it('should color pass in green', () => {
      expect(statusColor('pass', 'pass', { forceColor: true })).toBe('\x1b[32mpass\x1b[0m')
    })

    it('should color fail in red', () => {
      expect(statusColor('fail', 'fail', { forceColor: true })).toBe('\x1b[31mfail\x1b[0m')
    })

    it('should color warning in yellow', () => {
      expect(statusColor('warning', 'warning', { forceColor: true })).toBe('\x1b[33mwarning\x1b[0m')
    })

    it('should not color when forceColor is false', () => {
      expect(statusColor('pass', 'pass', { forceColor: false })).toBe('pass')
    })
  })

  describe('scoreColor', () => {
    it('should color high score in green', () => {
      expect(scoreColor('90', 90, { forceColor: true })).toBe('\x1b[32m90\x1b[0m')
    })

    it('should color medium score in yellow', () => {
      expect(scoreColor('70', 70, { forceColor: true })).toBe('\x1b[33m70\x1b[0m')
    })

    it('should color low score in red+bold', () => {
      const result = scoreColor('30', 30, { forceColor: true })
      expect(result).toContain('\x1b[31m')  // red
      expect(result).toContain('\x1b[1m')   // bold
    })

    it('should not color when forceColor is false', () => {
      expect(scoreColor('90', 90, { forceColor: false })).toBe('90')
    })
  })
})
