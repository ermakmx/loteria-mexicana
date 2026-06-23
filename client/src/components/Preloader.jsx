import { useState, useEffect } from 'react'
import { preloadAssets } from '../utils/preloader'

export default function Preloader({ onReady }) {
  const [progreso, setProgreso] = useState(0)

  useEffect(() => {
    preloadAssets(setProgreso).then(onReady)
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="text-6xl mb-6 animate-pulse">🎴</div>
      <h1 className="text-4xl font-bold text-loteria-gold mb-2 drop-shadow-lg">Lotería</h1>
      <p className="text-white/50 text-sm mb-6">Mexicana — En línea</p>
      <div className="w-64 sm:w-80 bg-white/10 rounded-full h-3 overflow-hidden shadow-inner">
        <div
          className="h-full bg-gradient-to-r from-loteria-gold to-yellow-400 rounded-full transition-all duration-300 shadow-lg"
          style={{ width: `${Math.round(progreso * 100)}%` }}
        />
      </div>
      <p className="text-white/40 text-xs mt-3 font-mono">
        {Math.round(progreso * 100)}% · Cargando recursos...
      </p>
      {(progreso * 100) >= 100 && (
        <p className="text-loteria-gold text-sm mt-4 animate-bounce-in font-bold">¡Listo!</p>
      )}
    </div>
  )
}
