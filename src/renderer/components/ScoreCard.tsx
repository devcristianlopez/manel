import React from 'react'
import type { TechnologyStatus } from '../../shared/types'

const statusConfig: Record<TechnologyStatus, { label: string; barColor: string; textColor: string }> = {
  green: { label: 'Verde', barColor: 'bg-emerald-500', textColor: 'text-emerald-500' },
  yellow: { label: 'Amarillo', barColor: 'bg-amber-500', textColor: 'text-amber-500' },
  red: { label: 'Rojo', barColor: 'bg-red-500', textColor: 'text-red-500' },
  black: { label: 'Negro', barColor: 'bg-gray-900', textColor: 'text-gray-400' },
}

interface ScoreCardProps {
  score: number
  status: TechnologyStatus
}

export function ScoreCard({ score, status }: ScoreCardProps) {
  const config = statusConfig[status]

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-400">Security Score</h2>
        <span className="text-4xl font-bold text-white">{score}/100</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-3 mb-2">
        <div
          className={`h-3 rounded-full transition-all duration-1000 ease-out ${config.barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-sm font-medium ${config.textColor}`}>{config.label}</span>
    </div>
  )
}
