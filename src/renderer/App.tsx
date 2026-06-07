import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { TechnologyResult, ScanSummary, TechnologyStatus } from '../shared/types'
import { ScoreCard } from './components/ScoreCard'
import { TechnologyList } from './components/TechnologyList'
import { ScanButton } from './components/ScanButton'
import { ScanProgress } from './components/ScanProgress'
import { TechnologyDetail } from './components/TechnologyDetail'

type View = 'dashboard' | 'detail'

function getScoreStatus(score: number): TechnologyStatus {
  if (score >= 80) return 'green'
  if (score >= 60) return 'yellow'
  if (score >= 40) return 'red'
  return 'black'
}

function App() {
  const [view, setView] = useState<View>('dashboard')
  const [selectedTech, setSelectedTech] = useState<TechnologyResult | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState('')
  const [currentSoftware, setCurrentSoftware] = useState('')
  const [scanResult, setScanResult] = useState<ScanSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scanIdRef = useRef<string | null>(null)

  const handleSelectTech = useCallback((tech: TechnologyResult) => {
    setSelectedTech(tech)
    setView('detail')
  }, [])

  const handleBack = useCallback(() => {
    setView('dashboard')
    setSelectedTech(null)
  }, [])

  const handleAnalyze = useCallback(async (scanId: string) => {
    try {
      setScanStatus('Analizando seguridad...')
      const softwares = await window.manel.getSoftwareByScanId(scanId)
      setScanStatus('Consultando vulnerabilidades...')
      const technologies = await window.manel.analyzeSecurity({ softwareList: softwares, scanId })
      setScanStatus('Calculando puntuación...')
      const summary = await window.manel.getScanSummary({ scanId, technologies })
      setScanResult(summary)
      setIsScanning(false)
      setScanStatus('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error durante el análisis de seguridad'
      setError(message)
      setIsScanning(false)
    }
  }, [])

  const handleScan = useCallback(async () => {
    setIsScanning(true)
    setScanStatus('Iniciando escaneo...')
    setCurrentSoftware('')
    setScanResult(null)
    setError(null)

    try {
      const result = await window.manel.startScan()
      scanIdRef.current = result.scanId
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al iniciar escaneo'
      setError(message)
      setIsScanning(false)
    }
  }, [])

  useEffect(() => {
    const cleanup = window.manel.onScanUpdate((data: Record<string, unknown>) => {
      switch (data.type) {
        case 'scan-started': {
          setScanStatus('Iniciando escaneo...')
          scanIdRef.current = data.scanId as string
          break
        }
        case 'status': {
          setScanStatus('Escaneando sistema...')
          break
        }
        case 'software-detected': {
          setScanStatus(`Detectando ${data.software as string}...`)
          setCurrentSoftware(data.software as string)
          break
        }
        case 'os-detected': {
          setScanStatus('Sistema operativo detectado')
          break
        }
        case 'scan-completed': {
          setScanStatus('Escaneo completado. Analizando seguridad...')
          if (scanIdRef.current) {
            handleAnalyze(scanIdRef.current)
          }
          break
        }
        case 'scan-failed': {
          setError((data.error as string) || 'Error durante el escaneo')
          setIsScanning(false)
          break
        }
      }
    })
    return () => { cleanup() }
  }, [handleAnalyze])

  if (view === 'detail' && selectedTech) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-6">
        <div className="max-w-4xl mx-auto">
          <TechnologyDetail technology={selectedTech} onBack={handleBack} />
        </div>
      </div>
    )
  }

  const score = scanResult?.overallScore ?? 0
  const scoreStatus = scanResult ? getScoreStatus(score) : 'green'

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center gap-3 mb-2">
          <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h1 className="text-2xl font-bold text-white">Manel</h1>
          <span className="text-sm text-gray-500">Security Health Monitor</span>
        </header>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between animate-fade-in">
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 p-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {isScanning && (
          <ScanProgress status={scanStatus} softwareDetected={currentSoftware} isScanning={isScanning} />
        )}

        {scanResult && !isScanning && (
          <ScoreCard score={score} status={scoreStatus} />
        )}

        {scanResult && !isScanning && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-red-400">{scanResult.scan.critical_count}</p>
                <p className="text-xs text-gray-400 mt-1">Críticos</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-orange-400">{scanResult.scan.high_count}</p>
                <p className="text-xs text-gray-400 mt-1">Altos</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-amber-400">{scanResult.scan.medium_count}</p>
                <p className="text-xs text-gray-400 mt-1">Medios</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-400">{scanResult.scan.low_count}</p>
                <p className="text-xs text-gray-400 mt-1">Bajos</p>
              </div>
            </div>

            <TechnologyList
              technologies={scanResult.technologies}
              onSelect={handleSelectTech}
            />
          </>
        )}

        {!scanResult && !isScanning && (
          <div className="text-center py-16 animate-fade-in">
            <svg className="w-16 h-16 mx-auto text-gray-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-400 mb-2">Sin escaneos aún</h2>
            <p className="text-gray-600">Ejecuta un escaneo para evaluar la seguridad de tu entorno de desarrollo</p>
          </div>
        )}

        <ScanButton onScan={handleScan} isScanning={isScanning} />
      </div>
    </div>
  )
}

export default App
