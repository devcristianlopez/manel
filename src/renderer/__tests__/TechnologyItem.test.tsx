import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { TechnologyItem } from '../components/TechnologyItem'
import type { TechnologyResult } from '../../shared/types'

function createTech(overrides: Partial<TechnologyResult> = {}): TechnologyResult {
  return {
    name: 'node',
    installedVersion: '22.0.0',
    latestVersion: '22.0.0',
    status: 'green',
    vulnerabilities: [],
    recommendation: '',
    ...overrides,
  }
}

describe('TechnologyItem', () => {
  it('should render the technology name', () => {
    const tech = createTech({ name: 'node' })
    render(<TechnologyItem technology={tech} onSelect={vi.fn()} />)
    expect(screen.getByText('node')).toBeDefined()
  })

  it('should render the installed version', () => {
    const tech = createTech({ installedVersion: '18.0.0' })
    render(<TechnologyItem technology={tech} onSelect={vi.fn()} />)
    expect(screen.getByText('18.0.0')).toBeDefined()
  })

  it('should render "Al día" for green status', () => {
    const tech = createTech({ status: 'green' })
    render(<TechnologyItem technology={tech} onSelect={vi.fn()} />)
    expect(screen.getByText('Al día')).toBeDefined()
  })

  it('should render "EOL pronto" for yellow status', () => {
    const tech = createTech({ status: 'yellow' })
    render(<TechnologyItem technology={tech} onSelect={vi.fn()} />)
    expect(screen.getByText('EOL pronto')).toBeDefined()
  })

  it('should render "Actualizar" for red status', () => {
    const tech = createTech({ status: 'red' })
    render(<TechnologyItem technology={tech} onSelect={vi.fn()} />)
    expect(screen.getByText('Actualizar')).toBeDefined()
  })

  it('should render "Crítico" for black status', () => {
    const tech = createTech({ status: 'black' })
    render(<TechnologyItem technology={tech} onSelect={vi.fn()} />)
    expect(screen.getByText('Crítico')).toBeDefined()
  })

  it('should show vulnerability count badge when vulns > 0', () => {
    const vulns = [
      { id: 'v1', cve: 'CVE-1', severity: 'HIGH' as const, description: '', software_id: '', fixed_version: '', source: '' },
    ]
    const tech = createTech({ status: 'red', vulnerabilities: vulns })
    render(<TechnologyItem technology={tech} onSelect={vi.fn()} />)
    expect(screen.getByText('1')).toBeDefined()
  })

  it('should not show vulnerability badge when no vulns', () => {
    const tech = createTech({ vulnerabilities: [] })
    render(<TechnologyItem technology={tech} onSelect={vi.fn()} />)
    expect(screen.queryByText('0')).toBeNull()
  })

  it('should call onSelect when clicked', () => {
    const onSelect = vi.fn()
    const tech = createTech({ name: 'python' })
    render(<TechnologyItem technology={tech} onSelect={onSelect} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    expect(onSelect).toHaveBeenCalledWith(tech)
  })

  it('should render as a button element', () => {
    const tech = createTech()
    render(<TechnologyItem technology={tech} onSelect={vi.fn()} />)

    const button = screen.getByRole('button')
    expect(button).toBeDefined()
  })

  it('should have correct color class for each status', () => {
    const { container: greenContainer } = render(
      <TechnologyItem technology={createTech({ status: 'green' })} onSelect={vi.fn()} />
    )
    expect(greenContainer.innerHTML).toContain('bg-emerald-500')

    const { container: yellowContainer } = render(
      <TechnologyItem technology={createTech({ status: 'yellow' })} onSelect={vi.fn()} />
    )
    expect(yellowContainer.innerHTML).toContain('bg-amber-500')

    const { container: redContainer } = render(
      <TechnologyItem technology={createTech({ status: 'red' })} onSelect={vi.fn()} />
    )
    expect(redContainer.innerHTML).toContain('bg-red-500')

    const { container: blackContainer } = render(
      <TechnologyItem technology={createTech({ status: 'black' })} onSelect={vi.fn()} />
    )
    expect(blackContainer.innerHTML).toContain('bg-gray-600')
  })

  it('should render multiple vulnerability counts', () => {
    const vulns = Array.from({ length: 5 }, (_, i) => ({
      id: `v${i}`,
      cve: `CVE-${i}`,
      severity: 'LOW' as const,
      description: '',
      software_id: '',
      fixed_version: '',
      source: '',
    }))
    const tech = createTech({ status: 'red', vulnerabilities: vulns })
    render(<TechnologyItem technology={tech} onSelect={vi.fn()} />)
    expect(screen.getByText('5')).toBeDefined()
  })
})
