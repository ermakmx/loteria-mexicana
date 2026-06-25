import { useState, useEffect, useRef, useCallback } from 'react'
import { getCarta } from '../data/cartas'
import { cantarCarta, callarCantor, reproducirEfecto } from '../utils/cantor'
import Tablero from './Tablero'
import Mazo from './Mazo'
import CantorAnimado from './CantorAnimado'
import { useLenguaje } from '../i18n/context'
import useWebSocket from '../useWebSocket'

const API = '/api'

export default function Game({ jugador, salaId, onSalir, initialState }) {
  const { t } = useLenguaje()
  const { connected, lastState, salaError } = useWebSocket(salaId, jugador.id)
  const [estado, setEstado] = useState('esperando')
  const [tableros, setTableros] = useState([])
  const [marcadas, setMarcadas] = useState(new Set())
  const [cartaActualId, setCartaActualId] = useState(null)
  const [historial, setHistorial] = useState([])
  const [jugadores, setJugadores] = useState([])
  const [cartasRestantes, setCartasRestantes] = useState(53)
  const [ganador, setGanador] = useState(null)
  const [cantando, setCantando] = useState(false)
  const [error, setError] = useState('')
  const [errorClave, setErrorClave] = useState(0)
  const [motivoFin, setMotivoFin] = useState(null)
  const [cuentaRegresiva, setCuentaRegresiva] = useState(0)
  const [notificacion, setNotificacion] = useState('')
  const [progreso, setProgreso] = useState({})
  const [cargando, setCargando] = useState(false)

  const esHost = jugadores[0]?.id === jugador.id
  const ultimoCartaIdRef = useRef(null)
  const pollingRef = useRef(null)
  const redirigiendoRef = useRef(false)

  // Apply initial state from reconnect on mount
  useEffect(() => {
    if (initialState) {
      handleStateUpdate(initialState)
    }
  }, [])

  // Sala desapareció (servidor reiniciado) → volver al lobby
  useEffect(() => {
    if (salaError === 'sala_no_existe' && !redirigiendoRef.current) {
      redirigiendoRef.current = true
      onSalir()
    }
  }, [salaError, onSalir])

  async function post(endpoint, data, maxRetries = 4) {
    for (let i = 0; i < maxRetries; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 400))
      try {
        const r = await fetch(`${API}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        const result = await r.json()
        if ((result.error === 'Sala no existe' || result.error === 'Juego no activo') && i < maxRetries - 1) continue
        return result
      } catch {
        if (i < maxRetries - 1) continue
        return { error: 'Error de conexión' }
      }
    }
    return { error: 'Error después de reintentos' }
  }

  // WebSocket state update handler
  function handleStateUpdate(data) {
    if (!data) return
    setJugadores(data.jugadores || [])

    if (data.estado === 'jugando' && data.tableros) {
      setTableros(data.tableros)
      setMarcadas(new Set())
    }

    if (data.cartaActualId !== ultimoCartaIdRef.current && data.cartaActualId !== null) {
      ultimoCartaIdRef.current = data.cartaActualId
      const carta = getCarta(data.cartaActualId)
      if (carta) {
        setCantando(true)
        cantarCarta(carta, (tipo) => { if (tipo === 'end') setCantando(false) })
      }
    }

    setCartaActualId(data.cartaActualId)
    setHistorial(data.historial || [])
    setCartasRestantes(data.cartasRestantes ?? 0)
    setEstado(data.estado)
    if (data.estado !== 'terminado') setMotivoFin(null)
    if (data.progreso) setProgreso(data.progreso)

    if (data.ganador) {
      setGanador(data.ganador)
      setMotivoFin(data.motivoFin || null)
      setCantando(false)
      callarCantor()
    }
  }

  // Apply WebSocket state updates
  useEffect(() => {
    handleStateUpdate(lastState)
    if (lastState?.mensaje) {
      setNotificacion(lastState.mensaje)
      setTimeout(() => setNotificacion(''), 5000)
    }
  }, [lastState])

  // REST polling fallback
  async function poll() {
    for (let i = 0; i < 3; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 300))
      try {
        const r = await fetch(`${API}/estado-sala?salaId=${salaId}&jugadorId=${jugador.id}`)
        if (!r.ok) continue
        const data = await r.json()
        if (data.error) { if (data.error === 'Sala no existe' && i < 2) continue; return }
        handleStateUpdate(data)
        return
      } catch { continue }
    }
  }

  useEffect(() => {
    if (!connected) {
      poll()
      pollingRef.current = setInterval(poll, 600)
    } else {
      clearInterval(pollingRef.current)
    }
    return () => { clearInterval(pollingRef.current); callarCantor() }
  }, [salaId, jugador.id, connected])

  useEffect(() => {
    if (estado !== 'jugando') { setCuentaRegresiva(0); return }
    setCuentaRegresiva(4)
    const intervaloCarta = esHost ? setInterval(async () => {
      setCuentaRegresiva(4)
      await post('/siguiente-carta', { salaId })
    }, 4000) : null
    const intervaloTick = setInterval(() => {
      setCuentaRegresiva(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => { if (intervaloCarta) clearInterval(intervaloCarta); clearInterval(intervaloTick) }
  }, [estado, esHost, salaId])

  // Non-host: reset countdown when a new card arrives
  useEffect(() => {
    if (esHost || estado !== 'jugando' || !cartaActualId) return
    setCuentaRegresiva(4)
  }, [cartaActualId, esHost, estado])

  const marcarCarta = useCallback((cartaId) => {
    setMarcadas(prev => {
      const next = new Set(prev)
      if (next.has(cartaId)) next.delete(cartaId)
      else next.add(cartaId)
      return next
    })
  }, [])

  async function iniciarJuego() {
    setCargando(true)
    const data = await post('/iniciar-juego', { salaId, jugadorId: jugador.id })
    setCargando(false)
    if (data.error) { setError(data.error); setErrorClave(k => k + 1); return }
    if (data.tableros) setTableros(data.tableros)
    if (data.jugadores) setJugadores(data.jugadores)
    ultimoCartaIdRef.current = null
    setEstado('jugando')
  }

  async function cantarLoteria() {
    const data = await post('/cantar-loteria', { salaId, jugadorId: jugador.id })
    if (data.valida) {
      setEstado('terminado')
      setGanador(data.ganador)
      setCantando(false)
      callarCantor()
      reproducirEfecto('victoria')
    } else {
      setError(t('loteria_falsa') + ' ' + (data.razon || ''))
      setErrorClave(k => k + 1)
      callarCantor()
      reproducirEfecto('trampa')
    }
  }

  async function nuevoJuego() {
    const data = await post('/nuevo-juego', { salaId })
    ultimoCartaIdRef.current = null
    setTableros([])
    setMarcadas(new Set())
    setGanador(null)
    setEstado('esperando')
    if (data.jugadores) setJugadores(data.jugadores)
  }

  const cartaActual = cartaActualId ? getCarta(cartaActualId) : null

  if (estado === 'terminado') {
    const ganaste = ganador?.id === jugador.id
    const esAbandono = motivoFin === 'abandono'
    const mensaje = ganaste
      ? (esAbandono ? t('abandono_todos') : t('nuevo_campeon'))
      : t('perdiste')
    return (
      <div className="w-full max-w-sm mx-auto text-center py-8 sm:py-12 px-4">
        <div className="panel p-8">
          <div className="text-6xl sm:text-7xl mb-4">{ganaste ? (esAbandono ? '💪' : '🏆') : '🎴'}</div>
          <h2 className={`text-3xl sm:text-4xl font-bold mb-2 ${ganaste ? 'text-loteria-gold' : 'text-white/80'}`}>
            {ganaste ? t('ganaste') : `${t('ganador')} ${ganador?.nombre}`}
          </h2>
          <p className="text-sm text-white/40 mb-6">{mensaje}</p>
          <div className="space-y-2 mb-6">
            {Object.entries(progreso).map(([id, p]) => (
              <div key={id} className={`py-2 px-3 rounded-xl text-sm ${id === ganador?.id ? 'bg-loteria-gold/15 ring-1 ring-loteria-gold/40' : 'bg-white/5'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-xs">{p.nombre} {id === ganador?.id ? '👑' : ''}</span>
                  <span className="text-[10px] text-white/40">{p.llenas}/{p.total}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${id === ganador?.id ? 'bg-loteria-gold' : 'bg-white/20'}`}
                    style={{ width: `${p.pct}%` }} />
                </div>
                <div className="text-right text-[10px] text-white/30 mt-0.5">{p.pct}%</div>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={nuevoJuego} className="btn-primary px-8 py-4 flex items-center justify-center gap-2">{t('jugar_de_nuevo')}</button>
            <button onClick={onSalir} className="btn-ghost px-8 py-4">{t('salir')}</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 py-4">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <button onClick={onSalir} className="text-white/30 hover:text-white/80 text-sm flex items-center gap-1 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t('salir')}
        </button>
        <div className="text-center">
          <h1 className="text-base font-bold text-loteria-gold/80 tracking-wide">🎴 {t('lobby_title')}</h1>
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

      {estado === 'esperando' && (
        <div className="max-w-sm mx-auto">
          <div className="panel p-6 text-center">
            <div className="text-4xl mb-3">🎴</div>
            <h2 className="text-lg font-bold mb-1">{t('esperando_jugadores')}</h2>
            <p className="text-xs text-white/40 mb-5">{t('compartir_codigo')} <span className="text-loteria-gold font-bold tracking-widest">{salaId}</span></p>
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
            {jugadores.length < 2 && <p className="text-xs text-white/30 mb-4">{t('minimo_2')}</p>}
            {esHost ? (
              <button onClick={iniciarJuego} disabled={jugadores.length < 2 || cargando}
                className="w-full btn-primary py-4 disabled:opacity-30 disabled:cursor-not-allowed text-base">{t('iniciar_juego')}</button>
            ) : (
              <div className="flex items-center justify-center gap-2 text-sm text-white/40">
                <span className="w-2 h-2 rounded-full bg-loteria-gold animate-pulse" /> {t('esperando_host')}
              </div>
            )}
          </div>
        </div>
      )}

      {estado === 'jugando' && (
        <div className="flex flex-col lg:flex-row lg:gap-6 xl:gap-8 items-start">
          <div className="flex flex-row lg:flex-col items-center gap-3 mb-4 lg:mb-0 lg:sticky lg:top-4 w-full lg:w-auto lg:min-w-[200px]">
            <CantorAnimado activo={cantando} cartaNombre={cartaActual?.nombre} />
            <Mazo cartaActualId={cartaActualId} historial={historial} cartasRestantes={cartasRestantes} />
            <div className="hidden lg:block w-full max-w-[200px]">
              <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-white/5">
                <div className="relative w-10 h-10 flex-shrink-0">
                  <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15" fill="none" className="stroke-white/10" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15" fill="none" className="stroke-loteria-gold" strokeWidth="3"
                      strokeDasharray={`${estado === 'jugando' ? (cuentaRegresiva / 4) * 94.2 : 0} 94.2`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{estado === 'jugando' ? cuentaRegresiva : '--'}</span>
                </div>
                <div className="text-left leading-tight">
                  <div className="text-xs font-medium text-white/80">Carta {historial.length + 1} / 53</div>
                  <div className="text-[10px] text-white/30">{cartasRestantes} restantes</div>
                </div>
              </div>
            </div>
            <button onClick={cantarLoteria}
              className="btn-danger text-lg sm:text-xl px-6 py-4 shadow-2xl shadow-red-600/20 w-full max-w-[200px] animate-pulse-loteria">¡LOTERÍA!</button>
          </div>
          <div className="flex-1 w-full min-w-0">
            <div className={`grid gap-2 sm:gap-3 ${
              tableros.length === 1 ? 'grid-cols-1' :
              tableros.length === 2 ? 'grid-cols-1 sm:grid-cols-2' :
              tableros.length === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
              'grid-cols-1 sm:grid-cols-2'
            }`}>
              {tableros.map((t, i) => (
                <Tablero key={i} tablero={t} marcadas={marcadas} onMarcar={marcarCarta}
                  titulo={tableros.length > 1 ? `${t('tablero_numero')} ${i + 1}` : t('tu_tablero')}
                  compacto={tableros.length > 1} />
              ))}
            </div>
          </div>
        </div>
      )}

      {notificacion && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-loteria-gold/90 text-black px-5 py-3 rounded-xl shadow-xl text-sm font-bold animate-bounce-in z-50 max-w-[90vw] text-center">
          {notificacion}
        </div>
      )}

      {error && (
        <div key={errorClave} className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-bold animate-bounce-in z-50 max-w-[90vw] text-center">
          {error}
        </div>
      )}
    </div>
  )
}