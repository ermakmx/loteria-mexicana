import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import Lobby from './components/Lobby'
import Game from './components/Game'

export default function App() {
  const [jugador, setJugador] = useState(null)
  const [salaId, setSalaId] = useState(null)
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    const serverUrl = import.meta.env.VITE_SERVER_URL || undefined
    const s = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })
    s.on('connect', () => setSocket(s))
    s.on('connect_error', (err) => console.error('Socket error:', err.message))
    return () => s.disconnect()
  }, [])

  if (!socket) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center text-white/60">
          <div className="text-4xl mb-4 animate-pulse">🎴</div>
          <p>Conectando al servidor...</p>
        </div>
      </div>
    )
  }

  const volverAlLobby = () => {
    setJugador(null)
    setSalaId(null)
  }

  if (!salaId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Lobby socket={socket} onUnirse={(data) => {
          setJugador(data.jugador)
          setSalaId(data.salaId)
        }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-start justify-center p-4 pt-6">
      <Game socket={socket} jugador={jugador} salaId={salaId} onSalir={volverAlLobby} />
    </div>
  )
}
