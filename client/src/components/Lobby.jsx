import { useState, useEffect } from 'react'
import { useLenguaje } from '../i18n/context'

const API = '/api'

export default function Lobby({ onUnirse }) {
  const { t, toggleIdioma, idioma } = useLenguaje()
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [modo, setModo] = useState(null)
  const [rankings, setRankings] = useState(null)
  const [cargandoRankings, setCargandoRankings] = useState(false)
  const [estadisticas, setEstadisticas] = useState(null)
  const [cargandoStats, setCargandoStats] = useState(false)
  const [reconnectInfo, setReconnectInfo] = useState(null)
  const [reconnectChecking, setReconnectChecking] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('loteria_ultimo_juego')
      if (!saved) return
      const parsed = JSON.parse(saved)
      if (Date.now() - parsed.ts > 300000) { localStorage.removeItem('loteria_ultimo_juego'); return }
      setReconnectInfo(parsed)
    } catch {}
  }, [])

  async function handleReconnect() {
    if (!reconnectInfo) return
    setReconnectChecking(true)
    try {
      const r = await fetch(`${API}/estado-sala?salaId=${reconnectInfo.salaId}&jugadorId=${reconnectInfo.jugador.id}`)
      const data = await r.json()
      if (data && !data.error) {
        onUnirse({ jugador: reconnectInfo.jugador, salaId: reconnectInfo.salaId })
        return
      }
    } catch {}
    setReconnectInfo(null)
    localStorage.removeItem('loteria_ultimo_juego')
    setReconnectChecking(false)
  }

  async function crearSala() {
    if (!nombre.trim()) { setError(t('nombre_requerido')); return }
    setError(''); setCargando(true)
    try {
      const r = await fetch(`${API}/crear-sala`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim() }),
      })
      const data = await r.json()
      if (data.error) { setError(data.error); setCargando(false); return }
      onUnirse(data)
    } catch { setError(t('error_conexion')); setCargando(false) }
  }

  async function unirseSala() {
    if (!nombre.trim()) { setError(t('nombre_requerido')); return }
    if (!codigo.trim()) { setError(t('codigo_requerido')); return }
    setError(''); setCargando(true)
    try {
      const r = await fetch(`${API}/unirse-sala`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salaId: codigo.trim().toUpperCase(), nombre: nombre.trim() }),
      })
      const data = await r.json()
      if (data.error) { setError(data.error); setCargando(false); return }
      onUnirse(data)
    } catch { setError(t('error_conexion')); setCargando(false) }
  }

  async function verRankings() {
    setCargandoRankings(true)
    try {
      const r = await fetch(`${API}/rankings`)
      const data = await r.json()
      setRankings(data)
    } catch {}
    setCargandoRankings(false)
  }

  async function verEstadisticas() {
    setCargandoStats(true)
    try {
      const r = await fetch(`${API}/stats`)
      const data = await r.json()
      setEstadisticas(data)
    } catch {}
    setCargandoStats(false)
  }

  if (estadisticas !== null) {
    return (
      <div className="w-full max-w-sm mx-auto px-4">
        <div className="panel p-6 mt-4 text-center">
          <div className="flex items-center gap-3 pb-3 border-b border-white/10 mb-4">
            <button onClick={() => setEstadisticas(null)} className="text-white/40 hover:text-white/80 text-lg">{'\u2190'}</button>
            <h2 className="font-bold text-lg">{t('estadisticas')}</h2>
          </div>
          <p className="text-xs text-white/40 mb-4">{t('total_partidas')}: {estadisticas.totalPartidas}</p>
          {estadisticas.jugadores.length === 0 ? (
            <p className="text-white/40 text-sm py-6">{t('sin_datos')}</p>
          ) : (
            <div className="space-y-2">
              {estadisticas.jugadores.map((j) => (
                <div key={j.nombre} className="py-2 px-3 rounded-xl bg-white/5 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{j.nombre}</span>
                    <span className="text-loteria-gold font-bold text-sm">{j.victorias}V / {j.derrotas}D</span>
                  </div>
                  <div className="flex gap-2 text-[10px] text-white/40">
                    <span>{t('win_rate')}: {j.winRate}%</span>
                    <span>{t('prom_cartas')}: {j.avgCartas}</span>
                    {j.avgDuracion > 0 && <span>{t('prom_duracion')}: {j.avgDuracion}{t('segundos')}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (rankings !== null) {
    return (
      <div className="w-full max-w-sm mx-auto px-4">
        <div className="panel p-6 mt-4 text-center">
          <div className="flex items-center gap-3 pb-3 border-b border-white/10 mb-4">
            <button onClick={() => setRankings(null)} className="text-white/40 hover:text-white/80 text-lg">{'\u2190'}</button>
            <h2 className="font-bold text-lg">{t('rankings')}</h2>
          </div>
          {rankings.length === 0 ? (
            <p className="text-white/40 text-sm py-6">{t('sin_partidas')}</p>
          ) : (
            <div className="space-y-2">
              {rankings.map((r, i) => (
                <div key={r.nombre} className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5">
                  <span className="flex items-center gap-2">
                    <span className="w-6 text-center text-sm">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                    <span className="font-medium text-sm">{r.nombre}</span>
                  </span>
                  <span className="text-loteria-gold font-bold text-sm">{r.victorias} {r.victorias === 1 ? t('victoria') : t('victorias')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm mx-auto px-4">
      <div className="text-center mb-8 mt-4 sm:mt-8">
        <div className="mb-3"><img src="/cards/back.png" alt="Lotería" className="w-24 sm:w-28 mx-auto" /></div>
        <h1 className="text-4xl sm:text-5xl font-bold text-loteria-gold drop-shadow-lg mb-1">{t('lobby_title')}</h1>
        <p className="text-base sm:text-lg text-white/60">{t('lobby_subtitle')}</p>
      </div>

      <div className="text-right mb-2">
        <button onClick={toggleIdioma} className="text-xs text-white/30 hover:text-white/60 transition-colors">
          {t('idioma')}: {idioma === 'es' ? 'ES' : 'EN'}
        </button>
      </div>

      {modo !== 'crear' && modo !== 'unirse' && (
        <div className="space-y-3 mb-4">
          <label className="block text-sm font-medium text-white/60 mb-1">{t('tu_nombre')}</label>
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Juan" maxLength={20}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-loteria-gold/50 text-base" autoFocus
          />
        </div>
      )}

      {modo === 'crear' ? (
        <div className="panel p-6 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-white/10">
            <button onClick={() => { setModo(null); setError('') }} className="text-white/40 hover:text-white/80 text-lg">{'\u2190'}</button>
            <h2 className="font-bold text-lg">{t('crear')}</h2>
          </div>
          <p className="text-sm text-white/60">{t('compartir_codigo')}</p>
          <button onClick={crearSala} disabled={cargando}
            className="w-full btn-primary py-4 disabled:opacity-40 flex items-center justify-center gap-2">
            {cargando ? <span className="flex items-center gap-2"><span className="animate-spin text-lg">🎴</span> {t('creando')}...</span> : t('crear_sala')}
          </button>
        </div>
      ) : modo === 'unirse' ? (
        <div className="panel p-6 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-white/10">
            <button onClick={() => { setModo(null); setError(''); setCodigo('') }} className="text-white/40 hover:text-white/80 text-lg">{'\u2190'}</button>
            <h2 className="font-bold text-lg">{t('unirse')}</h2>
          </div>
          <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder={t('codigo_sala')} maxLength={4}
            className="w-full px-4 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-loteria-gold/50 text-center tracking-[0.3em] text-2xl font-bold uppercase" autoFocus
          />
          <button onClick={unirseSala} disabled={cargando}
            className="w-full btn-primary py-4 disabled:opacity-40 flex items-center justify-center gap-2">
            {cargando ? <span className="flex items-center gap-2"><span className="animate-spin text-lg">🎴</span> {t('uniendo')}...</span> : t('unirse_sala')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {reconnectInfo && (
            <button onClick={handleReconnect} disabled={reconnectChecking}
              className="w-full btn-accent py-3 flex items-center justify-center gap-2 text-sm border border-loteria-gold/30 bg-loteria-gold/5 hover:bg-loteria-gold/10 rounded-xl transition-colors">
              {reconnectChecking ? t('verificando') : t('reconectar')}
            </button>
          )}
          <button onClick={() => { setModo('crear'); setError('') }} className="w-full btn-primary py-4 flex items-center justify-center gap-2 text-base">{t('crear_sala')}</button>
          <button onClick={() => { setModo('unirse'); setError('') }} className="w-full btn-ghost py-4 flex items-center justify-center gap-2 text-base border border-white/10">{t('unirse_sala')}</button>
          <button onClick={verRankings} disabled={cargandoRankings} className="w-full btn-ghost py-3 flex items-center justify-center gap-2 text-sm text-white/40 hover:text-white/70">
            {cargandoRankings ? '\u23f3...' : t('rankings')}
          </button>
          <button onClick={verEstadisticas} disabled={cargandoStats} className="w-full btn-ghost py-3 flex items-center justify-center gap-2 text-sm text-white/40 hover:text-white/70">
            {cargandoStats ? '\u23f3...' : t('estadisticas')}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-500/20 border border-red-400/30 text-white/90 text-sm text-center animate-bounce-in">{error}</div>
      )}
    </div>
  )
}
