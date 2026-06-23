import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'http'

const clients = new Map()
const salas = new Map()

function generarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function broadcast(salaId, data) {
  for (const [ws, info] of clients.entries()) {
    if (info.salaId === salaId && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: 'sala-actualizada', data }))
    }
  }
}

function broadcastTo(ws, event, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event, data }))
  }
}

function generarTablero() {
  const indices = new Set()
  while (indices.size < 16) indices.add(Math.floor(Math.random() * 53) + 1)
  return [...indices].sort((a, b) => a - b)
}

function handleMessage(ws, raw) {
  try {
    const { event, data } = JSON.parse(raw)
    switch (event) {
      case 'crear-sala': {
        const id = generarCodigo()
        salas.set(id, { id, jugadores: [], estado: 'esperando', mazo: [], cartaActual: null, historial: [], ganador: null, motivoFin: null, marcadas: {} })
        clients.set(ws, { salaId: id, jugadorId: null })
        broadcastTo(ws, 'sala-creada', { salaId: id })
        broadcast(id, { estado: 'esperando', jugadores: [], cartaActual: null, historial: [], cartasRestantes: 53, ganador: null, motivoFin: null, tablero: null })
        break
      }
      case 'unirse-sala': {
        const { salaId, nombre } = data
        const sala = salas.get(salaId)
        if (!sala) { broadcastTo(ws, 'error', { message: 'La sala no existe' }); break }
        if (sala.estado !== 'esperando') { broadcastTo(ws, 'error', { message: 'El juego ya comenz\u00f3' }); break }
        if (sala.jugadores.some(j => j.nombre === nombre)) { broadcastTo(ws, 'error', { message: 'Ese nombre ya est\u00e1 en uso' }); break }
        const jugador = { id: crypto.randomUUID(), nombre, tablero: null, ultimaActividad: Date.now() }
        sala.jugadores.push(jugador)
        clients.set(ws, { salaId, jugadorId: jugador.id })
        broadcastTo(ws, 'sala-unida', { jugador })
        broadcast(salaId, { estado: sala.estado, jugadores: sala.jugadores.map(j => ({ id: j.id, nombre: j.nombre })), cartaActual: null, historial: [], cartasRestantes: 53, ganador: null, motivoFin: null, tablero: null })
        break
      }
      case 'iniciar-juego': {
        const { salaId, jugadorId } = data
        const sala = salas.get(salaId)
        if (!sala) { broadcastTo(ws, 'error', { message: 'Sala no existe' }); break }
        if (sala.jugadores[0]?.id !== jugadorId) { broadcastTo(ws, 'error', { message: 'Solo el host puede iniciar' }); break }
        if (sala.jugadores.length < 2) { broadcastTo(ws, 'error', { message: 'Se necesitan al menos 2 jugadores' }); break }
        sala.mazo = Array.from({ length: 53 }, (_, i) => i + 1)
        for (let i = sala.mazo.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [sala.mazo[i], sala.mazo[j]] = [sala.mazo[j], sala.mazo[i]] }
        sala.historial = []
        sala.cartaActual = null
        sala.estado = 'jugando'
        sala.ganador = null
        sala.motivoFin = null
        sala.marcadas = {}
        sala.cartonActualIndex = -1
        for (const j of sala.jugadores) { j.tablero = generarTablero() }
        broadcast(salaId, { estado: 'jugando', jugadores: sala.jugadores.map(j => ({ id: j.id, nombre: j.nombre })), cartaActual: null, historial: [], cartasRestantes: 53, ganador: null, motivoFin: null, tablero: null })
        break
      }
      case 'siguiente-carta': {
        const sala = salas.get(data.salaId)
        if (!sala || sala.estado !== 'jugando' || !sala.mazo.length) { broadcastTo(ws, 'error', { message: 'Juego no activo' }); break }
        const cartaId = sala.mazo.shift()
        sala.cartaActual = cartaId
        sala.historial.push(cartaId)
        broadcast(data.salaId, { estado: 'jugando', cartaActual: cartaId, historial: sala.historial, cartasRestantes: sala.mazo.length, jugadores: sala.jugadores.map(j => ({ id: j.id, nombre: j.nombre })), ganador: null, motivoFin: null, tablero: null })
        break
      }
      case 'cantar-loteria': {
        const sala = salas.get(data.salaId)
        if (!sala || sala.estado !== 'jugando') { broadcastTo(ws, 'error', { message: 'Juego no activo' }); break }
        const jugador = sala.jugadores.find(j => j.id === data.jugadorId)
        if (!jugador || !jugador.tablero) { broadcastTo(ws, 'error', { message: 'Jugador sin tablero' }); break }
        const cartasDibujadas = new Set(sala.historial)
        if (jugador.tablero.every(c => cartasDibujadas.has(c))) {
          sala.estado = 'terminado'
          sala.ganador = jugador
          broadcast(data.salaId, { estado: 'terminado', ganador: { id: jugador.id, nombre: jugador.nombre }, motivoFin: null, cartaActual: sala.cartaActual, historial: sala.historial, cartasRestantes: sala.mazo.length, jugadores: sala.jugadores.map(j => ({ id: j.id, nombre: j.nombre })), tablero: null })
        } else {
          broadcastTo(ws, 'error', { message: 'No tienes todas las cartas marcadas', code: 'loteria_falsa' })
        }
        break
      }
      case 'nuevo-juego': {
        const sala = salas.get(data.salaId)
        if (!sala) { broadcastTo(ws, 'error', { message: 'Sala no existe' }); break }
        sala.estado = 'esperando'
        sala.mazo = []
        sala.cartaActual = null
        sala.historial = []
        sala.ganador = null
        sala.motivoFin = null
        sala.marcadas = {}
        sala.cartonActualIndex = -1
        for (const j of sala.jugadores) j.tablero = null
        broadcast(data.salaId, { estado: 'esperando', jugadores: sala.jugadores.map(j => ({ id: j.id, nombre: j.nombre })), cartaActual: null, historial: [], cartasRestantes: 53, ganador: null, motivoFin: null, tablero: null })
        break
      }
      case 'get-state': {
        const sala = salas.get(data.salaId)
        if (sala) {
          const info = clients.get(ws)
          const jugador = sala.jugadores.find(j => j.id === info?.jugadorId)
          broadcastTo(ws, 'sala-actualizada', { estado: sala.estado, jugadores: sala.jugadores.map(j => ({ id: j.id, nombre: j.nombre })), cartaActual: sala.cartaActual, historial: sala.historial, cartasRestantes: sala.mazo.length, ganador: sala.ganador ? { id: sala.ganador.id, nombre: sala.ganador.nombre } : null, motivoFin: sala.motivoFin || null, tablero: jugador?.tablero || null })
        }
        break
      }
    }
  } catch (e) {
    broadcastTo(ws, 'error', { message: 'Mensaje inv\u00e1lido' })
  }
}

const server = createServer()
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws) => {
  ws.on('message', (msg) => handleMessage(ws, msg.toString()))
  ws.on('close', () => {
    const info = clients.get(ws)
    if (info?.salaId && info?.jugadorId) {
      const sala = salas.get(info.salaId)
      if (sala) {
        sala.jugadores = sala.jugadores.filter(j => j.id !== info.jugadorId)
        if (sala.jugadores.length === 0) { salas.delete(info.salaId); clients.delete(ws); return }
        broadcast(info.salaId, { estado: sala.estado, jugadores: sala.jugadores.map(j => ({ id: j.id, nombre: j.nombre })), cartaActual: sala.cartaActual, historial: sala.historial, cartasRestantes: sala.mazo.length, ganador: sala.ganador ? { id: sala.ganador.id, nombre: sala.ganador.nombre } : null, motivoFin: sala.motivoFin || null, tablero: null })
      }
    }
    clients.delete(ws)
  })
})

setInterval(() => {
  const ahora = Date.now()
  for (const [ws, info] of clients.entries()) {
    if (!info.salaId || !salas.has(info.salaId)) continue
    const sala = salas.get(info.salaId)
    if (info.jugadorId) {
      const jugador = sala.jugadores.find(j => j.id === info.jugadorId)
      if (jugador) jugador.ultimaActividad = ahora
    }
    const activos = sala.jugadores.filter(j => ahora - (j.ultimaActividad || 0) < 30000)
    if (activos.length < sala.jugadores.length && sala.estado === 'jugando') {
      sala.jugadores = activos
      if (activos.length === 1) {
        sala.estado = 'terminado'
        sala.ganador = activos[0]
        sala.motivoFin = 'abandono'
        broadcast(info.salaId, { estado: 'terminado', ganador: { id: activos[0].id, nombre: activos[0].nombre }, motivoFin: 'abandono', cartaActual: sala.cartaActual, historial: sala.historial, cartasRestantes: sala.mazo.length, jugadores: sala.jugadores.map(j => ({ id: j.id, nombre: j.nombre })), tablero: null })
      } else {
        broadcast(info.salaId, { estado: sala.estado, jugadores: sala.jugadores.map(j => ({ id: j.id, nombre: j.nombre })), cartaActual: sala.cartaActual, historial: sala.historial, cartasRestantes: sala.mazo.length, ganador: null, motivoFin: null, tablero: null })
      }
    }
  }
}, 10000)

const PORT = process.env.PORT || 8080
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`)
})
