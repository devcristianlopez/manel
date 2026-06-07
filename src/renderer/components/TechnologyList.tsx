import React from 'react'
import type { TechnologyResult } from '../../shared/types'
import { TechnologyItem } from './TechnologyItem'

interface TechnologyListProps {
  technologies: TechnologyResult[]
  onSelect: (tech: TechnologyResult) => void
}

export function TechnologyList({ technologies, onSelect }: TechnologyListProps) {
  if (technologies.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No se detectaron tecnologías</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {technologies.map((tech) => (
        <TechnologyItem key={tech.name} technology={tech} onSelect={onSelect} />
      ))}
    </div>
  )
}
