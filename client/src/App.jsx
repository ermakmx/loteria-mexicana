import { useState, useEffect } from 'react'
import Preloader from './components/Preloader'
import Lobby from './components/Lobby'
import Game from './components/Game'
import { LenguajeProvider } from './i18n/context'

export default function App() {
  const [listo, setListo] = useState(false)
  const [jugador, setJugador] = useState(null)
  const [salaId, setSalaId] = useState(null)
  const [initialGameState, setInitialGameState] = useState(null)

  useEffect(() => {
    if (salaId && jugador) {
      localStorage.setItem('loteria_ultimo_juego', JSON.stringify({ salaId, jugador, ts: Date.now() }))
    }
  }, [salaId, jugador])

  const volverAlLobby = () => {
    localStorage.removeItem('loteria_ultimo_juego')
    setJugador(null)
    setSalaId(null)
    setInitialGameState(null)
  }

  if (!listo) return <Preloader onReady={() => setListo(true)} />

  if (!salaId) {
    return (
      <LenguajeProvider>
        <div className="min-h-screen flex items-center justify-center p-4">
          <Lobby onUnirse={(data) => {
            setJugador(data.jugador)
            setSalaId(data.salaId)
            if (data.initialState) setInitialGameState(data.initialState)
          }} />
        </div>
      </LenguajeProvider>
    )
  }

  return (
    <LenguajeProvider>
      <div className="min-h-screen flex items-start justify-center p-4 pt-6">
        <Game jugador={jugador} salaId={salaId} onSalir={volverAlLobby} initialState={initialGameState} />
      </div>
    </LenguajeProvider>
  )
}