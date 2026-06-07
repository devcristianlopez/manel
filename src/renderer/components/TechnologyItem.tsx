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

interface TechnologyItemProps {
  technology: TechnologyResult
  onSelect: (tech: TechnologyResult) => void
}

export function TechnologyItem({ technology, onSelect }: TechnologyItemProps) {
  const vulnCount = technology.vulnerabilities.length

  return (
    <button
      onClick={() => onSelect(technology)}
      className="w-full flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 hover:bg-gray-800/50 transition-all duration-200 text-left group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${statusColors[technology.status]} ${technology.status === 'red' || technology.status === 'black' ? 'animate-pulse-soft' : ''}`} />
        <div className="min-w-0">
          <p className="text-white font-medium truncate">{technology.name}</p>
          <p className="text-sm text-gray-400 truncate">{technology.installedVersion}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
        <span className={`text-xs font-medium ${
          technology.status === 'green' ? 'text-emerald-500' :
          technology.status === 'yellow' ? 'text-amber-500' :
          'text-red-500'
        }`}>
          {statusLabels[technology.status]}
        </span>
        {vulnCount > 0 && (
          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-medium">
            {vulnCount}
          </span>
        )}
        <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  )
}
