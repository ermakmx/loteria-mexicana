const salas = new Map()

export function crearSala() {
  const id = generarCodigo()
  const sala = {
    id,
    jugadores: [],
    estado: 'esperando',
    mazo: [],
    cartaActual: null,
    historial: [],
    cantorActivo: false,
    intervaloId: null,
    ganador: null,
  }
  salas.set(id, sala)
  return sala
}

export function unirseSala(salaId, jugador) {
  const sala = salas.get(salaId)
  if (!sala) return { error: 'La sala no existe' }
  if (sala.estado !== 'esperando') return { error: 'El juego ya comenzó' }
  if (sala.jugadores.some(j => j.nombre === jugador.nombre)) return { error: 'Ese nombre ya está en uso' }
  const nuevoJugador = {
    id: generarIdJugador(),
    nombre: jugador.nombre,
    tablero: null,
  }
  sala.jugadores.push(nuevoJugador)
  return { jugador: nuevoJugador, sala }
}

export function obtenerSala(salaId) {
  return salas.get(salaId)
}

export function eliminarSala(salaId) {
  const sala = salas.get(salaId)
  if (sala && sala.intervaloId) clearInterval(sala.intervaloId)
  salas.delete(salaId)
}

function generarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  let codigo
  do {
    codigo = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  } while (salas.has(codigo))
  return codigo
}

function generarIdJugador() {
  return crypto.randomUUID()
}
