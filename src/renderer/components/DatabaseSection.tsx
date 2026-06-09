import React from 'react'
import type { TechnologyResult } from '../../shared/types'

const statusColors: Record<string, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
  black: 'bg-gray-600',
}

const statusLabels: Record<string, string> = {
  green: 'Al día',
  yellow: 'EOL pronto',
  red: 'Actualizar',
  black: 'Crítico',
}

interface DatabaseSectionProps {
  technologies: TechnologyResult[]
  onSelect: (tech: TechnologyResult) => void
}

export function DatabaseSection({ technologies, onSelect }: DatabaseSectionProps) {
  if (technologies.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg className="w-8 h-8 mx-auto mb-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        </svg>
        <p className="text-sm">No se detectaron bases de datos</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        </svg>
        <h2 className="text-lg font-semibold text-gray-300">Bases de Datos</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {technologies.map((tech) => (
          <button
            key={tech.name}
            onClick={() => onSelect(tech)}
            className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 hover:bg-gray-800/50 transition-all duration-200 text-left group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${statusColors[tech.status]} ${tech.status === 'red' || tech.status === 'black' ? 'animate-pulse-soft' : ''}`} />
              <div className="min-w-0">
                <p className="text-white font-medium truncate">{tech.name}</p>
                <p className="text-sm text-gray-400 truncate">{tech.installedVersion}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 ml-3">
              <span className={`text-xs font-medium ${
                tech.status === 'green' ? 'text-emerald-500' :
                tech.status === 'yellow' ? 'text-amber-500' :
                'text-red-500'
              }`}>
                {statusLabels[tech.status]}
              </span>
              {tech.vulnerabilities.length > 0 && (
                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-medium">
                  {tech.vulnerabilities.length}
                </span>
              )}
              <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
