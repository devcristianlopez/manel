/**
 * Manel CLI — Spinner Tests
 *
 * Tests for the zero-dependency spinner used for progress feedback.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Spinner, setActiveSpinner, getActiveSpinner, stopActiveSpinner } from '../spinner'

describe('Spinner', () => {
  let mockStream: { write: ReturnType<typeof vi.fn>; isTTY: boolean }

  beforeEach(() => {
    mockStream = {
      write: vi.fn(),
      isTTY: true,
    }
    // Clear global spinner
    setActiveSpinner(null)
  })

  afterEach(() => {
    setActiveSpinner(null)
  })

  it('should create a spinner with initial message', () => {
    const spinner = new Spinner('Loading...', { enabled: true, stream: mockStream as any })
    expect(mockStream.write).toHaveBeenCalled()
    spinner.stop()
  })

  it('should write to stream in TTY mode', () => {
    mockStream.isTTY = true
    const spinner = new Spinner('Loading...', { enabled: true, stream: mockStream as any })
    expect(mockStream.write).toHaveBeenCalled()
    spinner.stop()
  })

  it('should write single line in non-TTY mode', () => {
    mockStream.isTTY = false
    const spinner = new Spinner('Loading...', { enabled: true, stream: mockStream as any })
    // In non-TTY, should write the message once
    const calls = mockStream.write.mock.calls.map((c: any[]) => c[0])
    expect(calls.some((c: string) => c.includes('Loading...'))).toBe(true)
    spinner.stop()
  })

  it('should update message with step()', () => {
    const spinner = new Spinner('Step 1', { enabled: true, stream: mockStream as any })
    spinner.step('Step 2')
    expect(spinner.isActive()).toBe(true)
    spinner.stop()
  })

  it('should stop and show final message', () => {
    const spinner = new Spinner('Loading...', { enabled: true, stream: mockStream as any })
    spinner.stop('Done!')
    expect(spinner.isActive()).toBe(false)
    expect(spinner.getFinalMessage()).toBe('Done!')
  })

  it('should stop without final message', () => {
    const spinner = new Spinner('Loading...', { enabled: true, stream: mockStream as any })
    spinner.stop()
    expect(spinner.isActive()).toBe(false)
    expect(spinner.getFinalMessage()).toBeNull()
  })

  it('should be safe to call stop() multiple times', () => {
    const spinner = new Spinner('Loading...', { enabled: true, stream: mockStream as any })
    spinner.stop('First')
    spinner.stop('Second')
    expect(spinner.getFinalMessage()).toBe('First')
  })

  it('should ignore step() after stop()', () => {
    const spinner = new Spinner('Loading...', { enabled: true, stream: mockStream as any })
    spinner.stop('Done')
    spinner.step('Should not appear')
    expect(spinner.getFinalMessage()).toBe('Done')
  })

  it('should not write when enabled is false', () => {
    mockStream.write.mockClear()
    const spinner = new Spinner('Loading...', { enabled: false, stream: mockStream as any })
    // When enabled=false and no TTY, should not write
    expect(mockStream.write).not.toHaveBeenCalled()
    spinner.stop()
  })
})

describe('Global Spinner Registry', () => {
  beforeEach(() => {
    setActiveSpinner(null)
  })

  it('should return null when no spinner is active', () => {
    expect(getActiveSpinner()).toBeNull()
  })

  it('should set and get active spinner', () => {
    const mockStream = { write: vi.fn(), isTTY: true }
    const spinner = new Spinner('Test', { enabled: true, stream: mockStream as any })
    setActiveSpinner(spinner)
    expect(getActiveSpinner()).toBe(spinner)
    spinner.stop()
  })

  it('should clear active spinner', () => {
    const mockStream = { write: vi.fn(), isTTY: true }
    const spinner = new Spinner('Test', { enabled: true, stream: mockStream as any })
    setActiveSpinner(spinner)
    setActiveSpinner(null)
    expect(getActiveSpinner()).toBeNull()
    spinner.stop()
  })

  it('should stop active spinner via stopActiveSpinner()', () => {
    const mockStream = { write: vi.fn(), isTTY: true }
    const spinner = new Spinner('Test', { enabled: true, stream: mockStream as any })
    setActiveSpinner(spinner)
    stopActiveSpinner('Stopped')
    expect(getActiveSpinner()).toBeNull()
    expect(spinner.isActive()).toBe(false)
  })

  it('should handle stopActiveSpinner when no spinner is active', () => {
    // Should not throw
    stopActiveSpinner('Nothing to stop')
    expect(getActiveSpinner()).toBeNull()
  })
})
