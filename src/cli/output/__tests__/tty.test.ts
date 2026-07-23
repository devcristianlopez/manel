/**
 * Tests for src/cli/output/tty
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { detectTTY, shouldUseColor } from '../tty'

describe('TTY Detection', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('detectTTY', () => {
    it('should detect TTY when stdout.isTTY is true', () => {
      const mockStdout = { isTTY: true } as NodeJS.WriteStream
      const result = detectTTY(mockStdout)
      expect(result.isTTY).toBe(true)
      expect(result.useColor).toBe(true)
    })

    it('should detect non-TTY when stdout.isTTY is false', () => {
      const mockStdout = { isTTY: false } as NodeJS.WriteStream
      const result = detectTTY(mockStdout)
      expect(result.isTTY).toBe(false)
      expect(result.useColor).toBe(false)
    })

    it('should respect FORCE_COLOR even in non-TTY', () => {
      process.env.FORCE_COLOR = '1'
      const mockStdout = { isTTY: false } as NodeJS.WriteStream
      const result = detectTTY(mockStdout)
      expect(result.useColor).toBe(true)
    })

    it('should respect NO_COLOR in TTY', () => {
      process.env.NO_COLOR = '1'
      const mockStdout = { isTTY: true } as NodeJS.WriteStream
      const result = detectTTY(mockStdout)
      expect(result.useColor).toBe(false)
    })

    it('FORCE_COLOR should override NO_COLOR', () => {
      process.env.FORCE_COLOR = '1'
      process.env.NO_COLOR = '1'
      const mockStdout = { isTTY: false } as NodeJS.WriteStream
      const result = detectTTY(mockStdout)
      expect(result.useColor).toBe(true)
    })

    it('should treat empty FORCE_COLOR as disabled', () => {
      process.env.FORCE_COLOR = ''
      const mockStdout = { isTTY: false } as NodeJS.WriteStream
      const result = detectTTY(mockStdout)
      expect(result.useColor).toBe(false)
    })

    it('should treat "0" as disabled', () => {
      process.env.FORCE_COLOR = '0'
      const mockStdout = { isTTY: false } as NodeJS.WriteStream
      const result = detectTTY(mockStdout)
      expect(result.useColor).toBe(false)
    })

    it('should treat "false" as disabled', () => {
      process.env.FORCE_COLOR = 'false'
      const mockStdout = { isTTY: false } as NodeJS.WriteStream
      const result = detectTTY(mockStdout)
      expect(result.useColor).toBe(false)
    })
  })

  describe('shouldUseColor', () => {
    it('should return true for TTY', () => {
      const mockStdout = { isTTY: true } as NodeJS.WriteStream
      expect(shouldUseColor(mockStdout)).toBe(true)
    })

    it('should return false for non-TTY', () => {
      const mockStdout = { isTTY: false } as NodeJS.WriteStream
      expect(shouldUseColor(mockStdout)).toBe(false)
    })

    it('should respect FORCE_COLOR', () => {
      process.env.FORCE_COLOR = '1'
      const mockStdout = { isTTY: false } as NodeJS.WriteStream
      expect(shouldUseColor(mockStdout)).toBe(true)
    })
  })
})
