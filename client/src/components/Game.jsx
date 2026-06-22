import { useState, useEffect, useCallback } from 'react'
import { getCarta } from '../data/cartas'
import { cantarCarta, callarCantor } from '../utils/cantor'
import Tablero from './Tablero'
import Mazo from './Mazo'
import CantorAnimado from './CantorAnimado'

export default function Game({ socket, jugador, salaId, onSalir }) {
  const [estado, setEstado] = useState('esperando')
  const [tablero, setTablero] = useState([])
  const [marcadas, setMarcadas] = useState(new Set())
  const [cartaActualId, setCartaActualId] = useState(null)
  const [historial, setHistorial] = useState([])
  const [jugadores, setJugadores] = useState([])
  const [cartasRestantes, setCartasRestantes] = useState(53)
  const [ganador, setGanador] = useState(null)
  const [cantando, setCantando] = useState(false)
  const [error, setError] = useState('')
  const [errorClave, setErrorClave] = useState(0)

  const esHost = jugadores[0]?.id === jugador.id

  useEffect(() => {
    if (!socket) return
    const fns = {
      juego_iniciado: (data) => {
        if (data.jugadorId === jugador.id) setTablero(data.tablero)
        setJugadores(data.jugadores)
        setEstado('jugando')
        setMarcadas(new Set())
        setCartaActualId(null)
        setHistorial([])
        setGanador(null)
        setError('')
      },
      carta_sacada: (data) => {
        setCartaActualId(data.cartaId)
        setHistorial(data.historial)
        setCartasRestantes(data.cartasRestantes)
        const carta = getCarta(data.cartaId)
        if (carta) {
          setCantando(true)
          cantarCarta(carta, (tipo) => { if (tipo === 'end') setCantando(false) })
        }
      },
      loteria_valida: (data) => {
        setEstado('terminado')
        setGanador(data.ganador)
        setCantando(false)
        callarCantor()
      },
      loteria_invalida: (data) => {
        setError('¡Lotería falsa! ' + data.razon)
        setErrorClave(k => k + 1)
      },
      jugador_unido: (data) => setJugadores(data.jugadores),
      jugador_desconectado: (data) => setJugadores(data.jugadores),
      juego_reiniciado: (data) => {
        setJugadores(data.jugadores)
        setEstado('esperando')
        setTablero([]); setMarcadas(new Set()); setCartaActualId(null)
        setHistorial([]); setGanador(null); setError('')
      },
      error: (data) => { setError(data.mensaje); setErrorClave(k => k + 1) },
    }
    for (const [ev, fn] of Object.entries(fns)) socket.on(ev, fn)
    return () => { for (const [ev, fn] of Object.entries(fns)) socket.off(ev, fn) }
  }, [socket, jugador.id])

  const marcarCarta = useCallback((cartaId) => {
    setMarcadas(prev => {
      const next = new Set(prev)
      if (next.has(cartaId)) next.delete(cartaId)
      else next.add(cartaId)
      return next
    })
  }, [])

  const cantarLoteria = () => { if (estado === 'jugando' && socket) socket.emit('cantar_loteria') }
  const iniciarJuego = () => { if (socket) socket.emit('iniciar_juego') }
  const nuevoJuego = () => { if (socket) { callarCantor(); socket.emit('nuevo_juego') } }
  const cartaActual = cartaActualId ? getCarta(cartaActualId) : null

  if (estado === 'terminado') {
    const ganaste = ganador?.id === jugador.id
    return (
      <div className="w-full max-w-sm mx-auto text-center py-8 sm:py-12 px-4">
        <div className="panel p-8">
          <div className="text-6xl sm:text-7xl mb-4">
            {ganaste ? '🏆' : '🎴'}
          </div>
          <h2 className={`text-3xl sm:text-4xl font-bold mb-2 ${ganaste ? 'text-loteria-gold' : 'text-white/80'}`}>
            {ganaste ? '¡GANASTE!' : `Ganó ${ganador?.nombre}`}
          </h2>
          <p className="text-sm text-white/40 mb-6">
            {ganaste ? 'Eres el nuevo campeón de la Lotería' : 'Mejor suerte la próxima vez'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={nuevoJuego} className="btn-primary px-8 py-4 flex items-center justify-center gap-2">
              🔄 Jugar de nuevo
            </button>
            <button onClick={onSalir} className="btn-ghost px-8 py-4">
              Salir
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <button onClick={onSalir} className="text-white/30 hover:text-white/80 text-sm flex items-center gap-1 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Salir
        </button>
        <div className="text-center">
          <h1 className="text-base font-bold text-loteria-gold/80 tracking-wide">🎴 Lotería</h1>
          <div className="text-[10px] text-white/30 tracking-widest">{salaId}</div>
        </div>
        <div className="flex gap-1">
          {jugadores.map(j => (
            <span key={j.id} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${j.id === jugador.id ? 'bg-loteria-gold/30 text-loteria-gold' : 'bg-white/10 text-white/60'}`} title={j.nombre}>
              {j.nombre.charAt(0).toUpperCase()}
            </span>
          ))}
        </div>
      </div>

      {/* Waiting Room */}
      {estado === 'esperando' && (
        <div className="max-w-sm mx-auto">
          <div className="panel p-6 text-center">
            <div className="text-4xl mb-3">🎴</div>
            <h2 className="text-lg font-bold mb-1">Esperando jugadores</h2>
            <p className="text-xs text-white/40 mb-5">Comparte el código <span className="text-loteria-gold font-bold tracking-widest">{salaId}</span> para que se unan</p>

            <div className="space-y-2 mb-5">
              {jugadores.map((j, i) => (
                <div key={j.id} className={`py-2 px-3 rounded-xl text-sm flex items-center justify-between ${j.id === jugador.id ? 'bg-loteria-gold/10 ring-1 ring-loteria-gold/30' : 'bg-white/5'}`}>
                  <span className="flex items-center gap-2">
                    <span>👤</span>
                    <span className="font-medium">{j.nombre}</span>
                    {j.id === jugador.id && <span className="text-[10px] text-white/40">(tú)</span>}
                  </span>
                  {i === 0 && <span className="text-[10px] bg-loteria-gold/20 text-loteria-gold px-2 py-0.5 rounded-full font-bold">HOST</span>}
                </div>
              ))}
            </div>

            {jugadores.length < 2 && (
              <p className="text-xs text-white/30 mb-4">Mínimo 2 jugadores para empezar</p>
            )}

            {esHost ? (
              <button
                onClick={iniciarJuego}
                disabled={jugadores.length < 2}
                className="w-full btn-primary py-4 disabled:opacity-30 disabled:cursor-not-allowed text-base"
              >
                ▶️ Iniciar juego
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 text-sm text-white/40">
                <span className="w-2 h-2 rounded-full bg-loteria-gold animate-pulse" />
                Esperando al host...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Game */}
      {estado === 'jugando' && (
        <>
          {/* Desktop: 2 columns | Mobile: single column */}
          <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-6 xl:gap-8 items-start">
            {/* Left column: Cantor + Current Card + LOTERÍA button */}
            <div className="flex flex-col items-center gap-3 mb-4 lg:mb-0 lg:sticky lg:top-4">
              <CantorAnimado activo={cantando} cartaNombre={cartaActual?.nombre} />
              <Mazo cartaActualId={cartaActualId} historial={historial} cartasRestantes={cartasRestantes} />
              <button
                onClick={cantarLoteria}
                className="btn-danger text-xl sm:text-2xl px-8 py-5 sm:py-6 shadow-2xl shadow-red-600/20 w-full max-w-[260px] animate-pulse-loteria"
              >
                ¡LOTERÍA!
              </button>
            </div>

            {/* Right column: Board */}
            <div className="flex-1">
              <Tablero tablero={tablero} marcadas={marcadas} onMarcar={marcarCarta} />
            </div>
          </div>
        </>
      )}

      {/* Error toast */}
      {error && (
        <div key={errorClave} className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-bold animate-bounce-in z-50 max-w-[90vw] text-center">
          {error}
        </div>
      )}
    </div>
  )
}
