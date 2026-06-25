const TOTAL_CARTAS = 53
const CARTAS_POR_TABLERO = 16

export function generarTablero() {
  const indices = new Set()
  while (indices.size < CARTAS_POR_TABLERO) {
    indices.add(Math.floor(Math.random() * TOTAL_CARTAS) + 1)
  }
  return [...indices].sort((a, b) => a - b)
}

export function iniciarJuego(sala) {
  sala.mazo = Array.from({ length: TOTAL_CARTAS }, (_, i) => i + 1)
  for (let i = sala.mazo.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sala.mazo[i], sala.mazo[j]] = [sala.mazo[j], sala.mazo[i]]
  }
  sala.historial = []
  sala.cartaActual = null
  sala.estado = 'jugando'
  sala.ganador = null
  sala.cartonActualIndex = -1
  sala.inicio = Date.now()

  for (const jugador of sala.jugadores) {
    jugador.tableros = Array.from({ length: sala.tableros || 1 }, () => generarTablero())
  }

  return sala
}

export function sacarCarta(sala) {
  if (sala.mazo.length === 0) return null
  const cartaId = sala.mazo.shift()
  sala.cartaActual = cartaId
  sala.historial.push(cartaId)
  return cartaId
}

export function verificarLoteria(sala, jugadorId) {
  const jugador = sala.jugadores.find(j => j.id === jugadorId)
  if (!jugador) return { valida: false, razon: 'Jugador no encontrado' }
  if (!jugador.tableros) return { valida: false, razon: 'Jugador sin tablero' }

  const cartasDibujadas = new Set(sala.historial)
  const todasEnTablero = jugador.tableros.every(t => t.every(cartaId => cartasDibujadas.has(cartaId)))

  if (todasEnTablero) {
    sala.estado = 'terminado'
    sala.ganador = jugador
    if (sala.intervaloId) {
      clearInterval(sala.intervaloId)
      sala.intervaloId = null
    }
    return { valida: true, ganador: jugador }
  }

  return { valida: false, razon: 'No tienes todas las cartas marcadas' }
}

export function reiniciarJuego(sala) {
  if (sala.intervaloId) {
    clearInterval(sala.intervaloId)
    sala.intervaloId = null
  }
  sala.estado = 'esperando'
  sala.mazo = []
  sala.cartaActual = null
  sala.historial = []
  sala.ganador = null
  sala.cartonActualIndex = -1
  sala.cantorActivo = false
  for (const jugador of sala.jugadores) {
    jugador.tableros = null
  }
  return sala
}
