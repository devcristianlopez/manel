import React from 'react'

interface ScanProgressProps {
  status: string
  softwareDetected: string
  isScanning: boolean
}

export function ScanProgress({ status, softwareDetected, isScanning }: ScanProgressProps) {
  if (!isScanning) return null

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <svg className="animate-spin h-5 w-5 text-emerald-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-white font-medium">Escaneando sistema...</p>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
        <div className="h-2 bg-emerald-500 rounded-full animate-pulse-soft" style={{ width: '60%' }} />
      </div>
      <p className="text-sm text-gray-400">{status || 'Preparando...'}</p>
      {softwareDetected && (
        <p className="text-xs text-gray-500">
          Último detectado: <span className="text-gray-300 font-medium">{softwareDetected}</span>
        </p>
      )}
    </div>
  )
}
