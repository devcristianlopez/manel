import React, { useState } from 'react'
import type { HardeningResult } from '../../shared/types'

const severityConfig: Record<string, { bg: string; text: string }> = {
  CRITICAL: { bg: 'bg-red-500/20', text: 'text-red-400' },
  HIGH: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  MEDIUM: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  LOW: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
}

const statusIcon: Record<string, { icon: string; color: string }> = {
  pass: { icon: '\u2713', color: 'text-emerald-500' },
  warning: { icon: '\u26A0', color: 'text-amber-500' },
  fail: { icon: '\u2717', color: 'text-red-500' },
  error: { icon: '?', color: 'text-gray-500' },
}

interface HardeningSectionProps {
  results: HardeningResult[]
}

export function HardeningSection({ results }: HardeningSectionProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const passed = results.filter(r => r.status === 'pass').length
  const score = results.length > 0 ? Math.round((passed / results.length) * 100) : 100

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-300">Hardening del Sistema</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Score:</span>
          <span className={`text-sm font-bold ${score >= 80 ? 'text-emerald-500' : score >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
            {score}% ({passed}/{results.length})
          </span>
        </div>
      </div>

      <div className="space-y-1">
        {results.map((check) => {
          const sev = severityConfig[check.severity] || severityConfig.LOW
          const si = statusIcon[check.status] || statusIcon.error
          const isExpanded = expanded[check.id] || false

          return (
            <div key={check.id}>
              <button
                onClick={() => toggleExpand(check.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-800/30 rounded-lg transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`flex-shrink-0 text-lg font-bold ${si.color}`}>{si.icon}</span>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{check.title || check.check_id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${sev.bg} ${sev.text}`}>
                    {check.severity}
                  </span>
                  <svg className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
              {isExpanded && (
                <div className="px-4 pb-3 text-sm text-gray-400 ml-8 border-l border-gray-800 pl-4">
                  {check.details || 'Sin detalles'}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
