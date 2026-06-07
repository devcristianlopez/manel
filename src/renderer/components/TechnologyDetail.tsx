import React from 'react'
import type { TechnologyResult } from '../../shared/types'

const severityColors: Record<string, { bg: string; text: string; label: string }> = {
  CRITICAL: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'CRITICAL' },
  HIGH: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'HIGH' },
  MEDIUM: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'MEDIUM' },
  LOW: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'LOW' },
  NONE: { bg: 'bg-gray-500/20', text: 'text-gray-500', label: 'NONE' },
}

const statusLabels: Record<string, { label: string; color: string }> = {
  green: { label: 'VERDE', color: 'text-emerald-500' },
  yellow: { label: 'AMARILLO', color: 'text-amber-500' },
  red: { label: 'ROJO', color: 'text-red-500' },
  black: { label: 'NEGRO', color: 'text-gray-400' },
}

interface TechnologyDetailProps {
  technology: TechnologyResult
  onBack: () => void
}

export function TechnologyDetail({ technology, onBack }: TechnologyDetailProps) {
  const statusInfo = statusLabels[technology.status]

  return (
    <div className="space-y-6 animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span>Volver al Dashboard</span>
      </button>

      <div className="flex items-center gap-3">
        <div className={`w-4 h-4 rounded-full ${
          technology.status === 'green' ? 'bg-emerald-500' :
          technology.status === 'yellow' ? 'bg-amber-500' :
          technology.status === 'red' ? 'bg-red-500' :
          'bg-gray-600'
        }`} />
        <h1 className="text-2xl font-bold text-white">{technology.name}</h1>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-400">Versión actual</p>
            <p className="text-lg font-semibold text-white">{technology.installedVersion}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Última versión</p>
            <p className="text-lg font-semibold text-white">{technology.latestVersion}</p>
          </div>
        </div>
        <div>
          <p className="text-sm text-gray-400 mb-1">Estado</p>
          <span className={`font-bold ${statusInfo.color}`}>{statusInfo.label}</span>
        </div>
      </div>

      {technology.vulnerabilities.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Vulnerabilidades ({technology.vulnerabilities.length})</h2>
          <div className="space-y-2">
            {technology.vulnerabilities.map((vuln) => {
              const sev = severityColors[vuln.severity] || severityColors.NONE
              return (
                <div key={vuln.id} className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg">
                  <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-bold ${sev.bg} ${sev.text}`}>
                    {sev.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">{vuln.cve || 'N/A'}</p>
                    <p className="text-xs text-gray-400 truncate">{vuln.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-2">Acción recomendada</h2>
        <p className="text-gray-300 leading-relaxed">{technology.recommendation}</p>
      </div>
    </div>
  )
}
