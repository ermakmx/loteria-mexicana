import { useState, useEffect } from 'react'

export default function Lobby({ socket, onUnirse }) {
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [modo, setModo] = useState(null)

  useEffect(() => {
    if (!socket) return
    const crearHandler = (data) => { setCargando(false); onUnirse(data) }
    const unirHandler = (data) => { setCargando(false); onUnirse(data) }
    const errorHandler = (data) => { setError(data.mensaje); setCargando(false) }
    socket.on('sala_creada', crearHandler)
    socket.on('sala_unida', unirHandler)
    socket.on('error', errorHandler)
    return () => {
      socket.off('sala_creada', crearHandler)
      socket.off('sala_unida', unirHandler)
      socket.off('error', errorHandler)
    }
  }, [socket, onUnirse])

  function crearSala() {
    if (!nombre.trim()) { setError('Escribe tu nombre'); return }
    setError('')
    setCargando(true)
    socket.emit('crear_sala', { nombre: nombre.trim() })
  }

  function unirseSala() {
    if (!nombre.trim()) { setError('Escribe tu nombre'); return }
    if (!codigo.trim()) { setError('Escribe el código de la sala'); return }
    setError('')
    setCargando(true)
    socket.emit('unirse_sala', { salaId: codigo.trim().toUpperCase(), nombre: nombre.trim() })
  }

  return (
    <div className="w-full max-w-sm mx-auto px-4">
      <div className="text-center mb-8 mt-4 sm:mt-8">
        <div className="text-5xl sm:text-6xl mb-3">🎴</div>
        <h1 className="text-4xl sm:text-5xl font-bold text-loteria-gold drop-shadow-lg mb-1">
          Lotería
        </h1>
        <p className="text-base sm:text-lg text-white/60">Mexicana — En línea</p>
      </div>

      {modo !== 'crear' && modo !== 'unirse' && (
        <div className="space-y-3 mb-4">
          <label className="block text-sm font-medium text-white/60 mb-1">Tu nombre</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Juan"
            maxLength={20}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-loteria-gold/50 focus:border-transparent text-base"
            autoFocus
          />
        </div>
      )}

      {modo === 'crear' ? (
        <div className="panel p-6 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-white/10">
            <button onClick={() => { setModo(null); setError('') }} className="text-white/40 hover:text-white/80 text-lg">←</button>
            <h2 className="font-bold text-lg">Crear sala</h2>
          </div>
          <p className="text-sm text-white/60">Se generará un código para compartir</p>
          <button
            onClick={crearSala}
            disabled={cargando}
            className="w-full btn-primary py-4 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {cargando ? (
              <span className="flex items-center gap-2"><span className="animate-spin text-lg">🎴</span> Creando...</span>
            ) : '🎲 Crear sala'}
          </button>
        </div>
      ) : modo === 'unirse' ? (
        <div className="panel p-6 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-white/10">
            <button onClick={() => { setModo(null); setError(''); setCodigo('') }} className="text-white/40 hover:text-white/80 text-lg">←</button>
            <h2 className="font-bold text-lg">Unirse a sala</h2>
          </div>
          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="ABCD"
            maxLength={4}
            className="w-full px-4 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-loteria-gold/50 focus:border-transparent uppercase text-center tracking-[0.3em] text-2xl font-bold"
            autoFocus
          />
          <button
            onClick={unirseSala}
            disabled={cargando}
            className="w-full btn-primary py-4 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {cargando ? (
              <span className="flex items-center gap-2"><span className="animate-spin text-lg">🎴</span> Uniendo...</span>
            ) : '🔗 Unirse'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <button onClick={() => { setModo('crear'); setError('') }} className="w-full btn-primary py-4 flex items-center justify-center gap-2 text-base">
            🎲 Crear sala
          </button>
          <button onClick={() => { setModo('unirse'); setError('') }} className="w-full btn-ghost py-4 flex items-center justify-center gap-2 text-base border border-white/10">
            🔗 Unirse a sala
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-500/20 border border-red-400/30 text-white/90 text-sm text-center animate-bounce-in">
          {error}
        </div>
      )}
    </div>
  )
}
