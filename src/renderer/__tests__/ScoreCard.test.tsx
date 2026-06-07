import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { ScoreCard } from '../components/ScoreCard'

describe('ScoreCard', () => {
  it('should render the score value', () => {
    render(<ScoreCard score={85} status="green" />)
    expect(screen.getByText('85/100')).toBeDefined()
  })

  it('should render the title Security Score', () => {
    render(<ScoreCard score={50} status="yellow" />)
    expect(screen.getByText('Security Score')).toBeDefined()
  })

  it('should display green label for green status', () => {
    render(<ScoreCard score={90} status="green" />)
    expect(screen.getByText('Verde')).toBeDefined()
  })

  it('should display yellow label for yellow status', () => {
    render(<ScoreCard score={65} status="yellow" />)
    expect(screen.getByText('Amarillo')).toBeDefined()
  })

  it('should display red label for red status', () => {
    render(<ScoreCard score={45} status="red" />)
    expect(screen.getByText('Rojo')).toBeDefined()
  })

  it('should display black label for black status', () => {
    render(<ScoreCard score={20} status="black" />)
    expect(screen.getByText('Negro')).toBeDefined()
  })

  it('should set bar width based on score percentage', () => {
    render(<ScoreCard score={75} status="yellow" />)
    const bar = screen.getByText('75/100')
    expect(bar).toBeDefined()
  })

  it('should render bar with width style based on score', () => {
    const { container } = render(<ScoreCard score={42} status="red" />)
    const barDiv = container.querySelector('.bg-gray-800 > div')
    expect(barDiv).not.toBeNull()
    expect(barDiv!.getAttribute('style')).toContain('width: 42%')
  })

  it('should handle score of 0', () => {
    render(<ScoreCard score={0} status="black" />)
    expect(screen.getByText('0/100')).toBeDefined()
    expect(screen.getByText('Negro')).toBeDefined()
  })

  it('should handle score of 100', () => {
    render(<ScoreCard score={100} status="green" />)
    expect(screen.getByText('100/100')).toBeDefined()
    expect(screen.getByText('Verde')).toBeDefined()
  })

  it('should apply the correct bar color class for each status', () => {
    const { container: greenContainer } = render(<ScoreCard score={90} status="green" />)
    expect(greenContainer.innerHTML).toContain('bg-emerald-500')

    const { container: yellowContainer } = render(<ScoreCard score={70} status="yellow" />)
    expect(yellowContainer.innerHTML).toContain('bg-amber-500')

    const { container: redContainer } = render(<ScoreCard score={50} status="red" />)
    expect(redContainer.innerHTML).toContain('bg-red-500')

    const { container: blackContainer } = render(<ScoreCard score={20} status="black" />)
    expect(blackContainer.innerHTML).toContain('bg-gray-900')
  })
})
