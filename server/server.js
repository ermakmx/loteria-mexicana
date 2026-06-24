import express from 'express'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.resolve(__dirname, '..', 'client', 'dist')
const RANKINGS_FILE = path.resolve(__dirname, 'rankings.json')

// ========== GAME LOGIC (shared) ==========
const TOTAL_CARTAS = 53
const CARTAS_POR_TABLERO = 16
const TIMEOUT_MS = 120000 // 2 min antes de declarar abandono
const salas = new Map()
const wsClients = new Map()

function generarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function generarTablero() {
  const indices = new Set()
  while (indices.size < CARTAS_POR_TABLERO) indices.add(Math.floor(Math.random() * TOTAL_CARTAS) + 1)
  return [...indices].sort((a, b) => a - b)
}

// ========== RANKINGS (local file) ==========
function leerRankings() {
  try {
    if (!fs.existsSync(RANKINGS_FILE)) return []
    return JSON.parse(fs.readFileSync(RANKINGS_FILE, 'utf-8'))
  } catch { return [] }
}

function guardarRankings(rankings) {
  try { fs.writeFileSync(RANKINGS_FILE, JSON.stringify(rankings, null, 2)) } catch {}
}

function registrarVictoria(nombreGanador, sala) {
  const rankings = leerRankings()
  const duracion = sala.inicio ? Math.round((Date.now() - sala.inicio) / 1000) : 0
  rankings.push({
    ganador: nombreGanador,
    jugadores: (sala.jugadores || []).map(j => j.nombre),
    fecha: new Date().toISOString(),
    totalCartas: sala.historial.length,
    duracion,
  })
  guardarRankings(rankings)
}

function obtenerRankings() {
  const entries = leerRankings()
  const conteo = {}
  for (const r of entries) conteo[r.ganador] = (conteo[r.ganador] || 0) + 1
  return Object.entries(conteo).map(([nombre, victorias]) => ({ nombre, victorias })).sort((a, b) => b.victorias - a.victorias)
}

function obtenerEstadisticas() {
  const entries = leerRankings()
  if (entries.length === 0) return { totalPartidas: 0, jugadores: [] }
  const stats = {}
  for (const r of entries) {
    for (const nombre of r.jugadores) {
      if (!stats[nombre]) stats[nombre] = { nombre, partidas: 0, victorias: 0, totalCartas: 0, totalDuracion: 0 }
      stats[nombre].partidas++
      stats[nombre].totalCartas += r.totalCartas
      if (r.duracion) stats[nombre].totalDuracion += r.duracion
    }
    if (stats[r.ganador]) stats[r.ganador].victorias++
  }
  return {
    totalPartidas: entries.length,
    jugadores: Object.values(stats).map(s => ({
      nombre: s.nombre,
      partidas: s.partidas,
      victorias: s.victorias,
      derrotas: s.partidas - s.victorias,
      winRate: Math.round((s.victorias / s.partidas) * 100),
      avgCartas: Math.round(s.totalCartas / s.partidas),
      avgDuracion: s.totalDuracion > 0 ? Math.round(s.totalDuracion / s.partidas) : 0,
    })).sort((a, b) => b.victorias - a.victorias),
  }
}

// ========== WEB SOCKET BROADCAST ==========
function wsBroadcast(salaId, data) {
  for (const [ws, info] of wsClients.entries()) {
    if (info.salaId === salaId && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: 'sala-actualizada', data }))
    }
  }
}

function wsSend(ws, event, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event, data }))
}

function sanitizarSala(sala, jugadorId) {
  if (!sala) return null
  return {
    estado: sala.estado,
    jugadores: sala.jugadores.map(j => ({ id: j.id, nombre: j.nombre })),
    cartaActualId: sala.cartaActual,
    historial: sala.historial,
    cartasRestantes: sala.mazo?.length ?? 0,
    ganador: sala.ganador ? { id: sala.ganador.id, nombre: sala.ganador.nombre } : null,
    tablero: jugadorId ? (sala.jugadores.find(j => j.id === jugadorId)?.tablero || null) : null,
    motivoFin: sala.motivoFin || null,
  }
}

function wsBroadcastState(sala, mensaje) {
  const data = sanitizarSala(sala, null)
  if (mensaje) data.mensaje = mensaje
  for (const [ws, info] of wsClients.entries()) {
    if (info.salaId !== sala.id || ws.readyState !== WebSocket.OPEN) continue
    const jugador = sala.jugadores.find(j => j.id === info.jugadorId)
    ws.send(JSON.stringify({ event: 'sala-actualizada', data: { ...data, tablero: jugador?.tablero || null } }))
  }
}

// ========== EXPRESS SETUP ==========
const app = express()
const server = createServer(app)

app.use(express.static(DIST, { maxAge: '1h' }))
app.use(express.json())

// REST API
app.all('/api/*', (req, res) => {
  const path = req.path.replace(/\/api\/?/, '')
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')

  switch (path) {
    case 'crear-sala': {
      if (req.method !== 'POST') { res.status(405).json({ error: 'POST required' }); return }
      const { nombre } = req.body
      if (!nombre) { res.status(400).json({ error: 'Nombre requerido' }); return }
      const id = generarCodigo()
      const sala = { id, jugadores: [], estado: 'esperando', mazo: [], cartaActual: null, historial: [], ganador: null, inicio: null, motivoFin: null }
      salas.set(id, sala)
      const jugador = { id: crypto.randomUUID(), nombre, tablero: null, ultimaActividad: Date.now() }
      sala.jugadores.push(jugador)
      res.json({ salaId: id, jugador, jugadores: sala.jugadores.map(j => ({ id: j.id, nombre: j.nombre })) })
      return
    }
    case 'unirse-sala': {
      if (req.method !== 'POST') { res.status(405).json({ error: 'POST required' }); return }
      const { salaId, nombre } = req.body
      if (!salaId || !nombre) { res.status(400).json({ error: 'salaId y nombre requeridos' }); return }
      const sala = salas.get(salaId)
      if (!sala) { res.status(400).json({ error: 'La sala no existe' }); return }
      if (sala.estado !== 'esperando') { res.status(400).json({ error: 'El juego ya comenzó' }); return }
      if (sala.jugadores.some(j => j.nombre === nombre)) { res.status(400).json({ error: 'Ese nombre ya está en uso' }); return }
      const jugador = { id: crypto.randomUUID(), nombre, tablero: null, ultimaActividad: Date.now() }
      sala.jugadores.push(jugador)
      wsBroadcastState(sala)
      res.json({ jugador, jugadores: sala.jugadores.map(j => ({ id: j.id, nombre: j.nombre })), salaId })
      return
    }
    case 'iniciar-juego': {
      if (req.method !== 'POST') { res.status(405).json({ error: 'POST required' }); return }
      const { salaId, jugadorId } = req.body
      const sala = salas.get(salaId)
      if (!sala) { res.status(404).json({ error: 'Sala no existe' }); return }
      if (sala.jugadores.length < 2) { res.status(400).json({ error: 'Mínimo 2 jugadores' }); return }
      if (sala.jugadores[0]?.id !== jugadorId) { res.status(403).json({ error: 'Solo el host puede iniciar' }); return }
      sala.mazo = Array.from({ length: TOTAL_CARTAS }, (_, i) => i + 1)
      for (let i = sala.mazo.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [sala.mazo[i], sala.mazo[j]] = [sala.mazo[j], sala.mazo[i]] }
      sala.historial = []
      sala.cartaActual = null
      sala.estado = 'jugando'
      sala.ganador = null
      sala.motivoFin = null
      sala.inicio = Date.now()
      for (const j of sala.jugadores) j.tablero = generarTablero()
      const tablero = sala.jugadores.find(j => j.id === jugadorId)?.tablero || []
      wsBroadcastState(sala)
      res.json({ jugadorId, tablero, jugadores: sala.jugadores.map(j => ({ id: j.id, nombre: j.nombre })), totalCartas: sala.mazo.length })
      return
    }
    case 'siguiente-carta': {
      if (req.method !== 'POST') { res.status(405).json({ error: 'POST required' }); return }
      const { salaId } = req.body
      const sala = salas.get(salaId)
      if (!sala) { res.status(400).json({ error: 'Sala no existe' }); return }
      if (sala.estado !== 'jugando') {
        console.log(`siguiente-carta: sala ${salaId} estado=${sala.estado} jug=${sala.jugadores.length}`)
        res.status(400).json({ error: 'Juego no activo' }); return
      }
      if (!sala.mazo.length) { res.json({ mazoVacio: true }); return }
      const cartaId = sala.mazo.shift()
      sala.cartaActual = cartaId
      sala.historial.push(cartaId)
      wsBroadcastState(sala)
      res.json({ cartaId, historial: sala.historial, cartasRestantes: sala.mazo.length })
      return
    }
    case 'cantar-loteria': {
      if (req.method !== 'POST') { res.status(405).json({ error: 'POST required' }); return }
      const body = req.body
      const sala = salas.get(body.salaId)
      if (!sala || sala.estado !== 'jugando') { console.log(`iniciar-juego antes: sala ${body.salaId} estado=${sala?.estado}`); res.status(400).json({ error: 'Juego no activo' }); return }
      const jugador = sala.jugadores.find(j => j.id === body.jugadorId)
      if (!jugador || !jugador.tablero) { res.json({ valida: false, razon: 'Jugador sin tablero' }); return }
      const cartasDibujadas = new Set(sala.historial)
      if (jugador.tablero.every(c => cartasDibujadas.has(c))) {
        sala.estado = 'terminado'
        sala.ganador = jugador
        registrarVictoria(jugador.nombre, sala)
        wsBroadcastState(sala)
        res.json({ valida: true, ganador: { id: jugador.id, nombre: jugador.nombre } })
      } else {
        res.json({ valida: false, razon: 'No tienes todas las cartas marcadas' })
      }
      return
    }
    case 'nuevo-juego': {
      if (req.method !== 'POST') { res.status(405).json({ error: 'POST required' }); return }
      const body = req.body
      const sala = salas.get(body.salaId)
      if (!sala) { res.status(404).json({ error: 'Sala no existe' }); return }
      sala.estado = 'esperando'
      sala.mazo = []
      sala.cartaActual = null
      sala.historial = []
      sala.ganador = null
      sala.motivoFin = null
      sala.inicio = null
      for (const j of sala.jugadores) j.tablero = null
      wsBroadcastState(sala)
      res.json({ jugadores: sala.jugadores.map(j => ({ id: j.id, nombre: j.nombre })) })
      return
    }
    case 'estado-sala': {
      const salaId = req.query.salaId
      const jugadorId = req.query.jugadorId
      if (!salaId) { res.status(400).json({ error: 'salaId requerido' }); return }
      const sala = salas.get(salaId)
      if (!sala) { res.status(404).json({ error: 'Sala no existe' }); return }
      if (jugadorId) {
        const j = sala.jugadores.find(p => p.id === jugadorId)
        if (j) j.ultimaActividad = Date.now()
      }
      res.json(sanitizarSala(sala, jugadorId))
      return
    }
    case 'rankings': {
      res.json(obtenerRankings())
      return
    }
    case 'stats': {
      res.json(obtenerEstadisticas())
      return
    }
    default:
      res.json({ status: 'ok', juego: 'Lotería Mexicana' })
  }
})

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return
  res.sendFile(path.join(DIST, 'index.html'))
})

// ========== WEB SOCKET ==========
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws) => {
  wsClients.set(ws, { salaId: null, jugadorId: null })
  ws.isAlive = true

  ws.on('pong', () => { ws.isAlive = true })

  ws.on('message', (raw) => {
    try {
      const { event, data } = JSON.parse(raw.toString())
      switch (event) {
        case 'crear-sala': {
          const id = generarCodigo()
          const sala = { id, jugadores: [], estado: 'esperando', mazo: [], cartaActual: null, historial: [], ganador: null, inicio: null, motivoFin: null }
          salas.set(id, sala)
          wsClients.set(ws, { salaId: id, jugadorId: null })
          wsSend(ws, 'sala-creada', { salaId: id })
          break
        }
        case 'unirse-sala': {
          const { salaId, nombre } = data
          const sala = salas.get(salaId)
          if (!sala) { wsSend(ws, 'error', { message: 'La sala no existe' }); break }
          if (sala.estado !== 'esperando') { wsSend(ws, 'error', { message: 'El juego ya comenzó' }); break }
          if (sala.jugadores.some(j => j.nombre === nombre)) { wsSend(ws, 'error', { message: 'Ese nombre ya está en uso' }); break }
          const jugador = { id: crypto.randomUUID(), nombre, tablero: null, ultimaActividad: Date.now() }
          sala.jugadores.push(jugador)
          wsClients.set(ws, { salaId, jugadorId: jugador.id })
          wsSend(ws, 'sala-unida', { jugador })
          wsBroadcastState(sala)
          break
        }
        case 'iniciar-juego': {
          const { salaId, jugadorId } = data
          const sala = salas.get(salaId)
          if (!sala) { wsSend(ws, 'error', { message: 'Sala no existe' }); break }
          if (sala.jugadores[0]?.id !== jugadorId) { wsSend(ws, 'error', { message: 'Solo el host puede iniciar' }); break }
          if (sala.jugadores.length < 2) { wsSend(ws, 'error', { message: 'Se necesitan al menos 2 jugadores' }); break }
          sala.mazo = Array.from({ length: TOTAL_CARTAS }, (_, i) => i + 1)
          for (let i = sala.mazo.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [sala.mazo[i], sala.mazo[j]] = [sala.mazo[j], sala.mazo[i]] }
          sala.historial = []
          sala.cartaActual = null
          sala.estado = 'jugando'
          sala.ganador = null
          sala.motivoFin = null
          sala.inicio = Date.now()
          for (const j of sala.jugadores) j.tablero = generarTablero()
          wsBroadcastState(sala)
          break
        }
        case 'siguiente-carta': {
          const sala = salas.get(data.salaId)
          if (!sala || sala.estado !== 'jugando' || !sala.mazo.length) { wsSend(ws, 'error', { message: 'Juego no activo' }); break }
          const cartaId = sala.mazo.shift()
          sala.cartaActual = cartaId
          sala.historial.push(cartaId)
          wsBroadcastState(sala)
          break
        }
        case 'cantar-loteria': {
          const sala = salas.get(data.salaId)
          if (!sala || sala.estado !== 'jugando') { wsSend(ws, 'error', { message: 'Juego no activo' }); break }
          const jugador = sala.jugadores.find(j => j.id === data.jugadorId)
          if (!jugador || !jugador.tablero) { wsSend(ws, 'error', { message: 'Jugador sin tablero' }); break }
          const cartasDibujadas = new Set(sala.historial)
          if (jugador.tablero.every(c => cartasDibujadas.has(c))) {
            sala.estado = 'terminado'
            sala.ganador = jugador
            registrarVictoria(jugador.nombre, sala)
            wsBroadcastState(sala)
          } else {
            wsSend(ws, 'error', { message: 'No tienes todas las cartas marcadas', code: 'loteria_falsa' })
          }
          break
        }
        case 'nuevo-juego': {
          const sala = salas.get(data.salaId)
          if (!sala) { wsSend(ws, 'error', { message: 'Sala no existe' }); break }
          sala.estado = 'esperando'
          sala.mazo = []
          sala.cartaActual = null
          sala.historial = []
          sala.ganador = null
          sala.motivoFin = null
          sala.inicio = null
          for (const j of sala.jugadores) j.tablero = null
          wsBroadcastState(sala)
          break
        }
        case 'get-state': {
          wsClients.set(ws, { salaId: data.salaId || null, jugadorId: data.jugadorId || null })
          const sala = salas.get(data.salaId)
          if (sala) {
            if (data.jugadorId) {
              const j = sala.jugadores.find(p => p.id === data.jugadorId)
              if (j) j.ultimaActividad = Date.now()
            }
            const jugador = sala.jugadores.find(j => j.id === data.jugadorId)
            wsSend(ws, 'sala-actualizada', { ...sanitizarSala(sala, data.jugadorId), tablero: jugador?.tablero || null })
          } else {
            wsSend(ws, 'error', { message: 'Sala no existe', code: 'sala_no_existe' })
          }
          break
        }
      }
    } catch { wsSend(ws, 'error', { message: 'Mensaje inválido' }) }
  })

  ws.on('close', () => {
    const info = wsClients.get(ws)
    if (info?.salaId && info?.jugadorId) {
      const sala = salas.get(info.salaId)
      if (sala) {
        const eraHost = sala.jugadores[0]?.id === info.jugadorId
        sala.jugadores = sala.jugadores.filter(j => j.id !== info.jugadorId)

        if (sala.jugadores.length === 0) { salas.delete(info.salaId); wsClients.delete(ws); return }

        if (sala.jugadores.length === 1 && sala.estado === 'jugando') {
          sala.estado = 'terminado'
          sala.ganador = sala.jugadores[0]
          sala.motivoFin = 'abandono'
          registrarVictoria(sala.ganador.nombre, sala)
          wsBroadcastState(sala)
          wsClients.delete(ws)
          return
        }

        if (eraHost && sala.jugadores.length >= 2) {
          wsBroadcastState(sala, `Host desconectado. ${sala.jugadores[0].nombre} es el nuevo host.`)
          wsClients.delete(ws)
          return
        }

        wsBroadcastState(sala)
      }
    }
    wsClients.delete(ws)
  })
})

// Abandono checker
setInterval(() => {
  const ahora = Date.now()
  for (const [id, sala] of salas) {
    if (sala.jugadores.length === 0) { salas.delete(id); continue }
    if (sala.estado !== 'jugando') continue
    sala.jugadores = sala.jugadores.filter(j => ahora - (j.ultimaActividad || 0) < TIMEOUT_MS)
    if (sala.jugadores.length === 0) { salas.delete(id); continue }
    if (sala.jugadores.length === 1) {
      console.log(`abandono: sala ${id} ganador=${sala.jugadores[0].nombre}`)
      sala.estado = 'terminado'
      sala.ganador = sala.jugadores[0]
      sala.motivoFin = 'abandono'
      wsBroadcastState(sala)
    } else {
      wsBroadcastState(sala)
    }
  }
}, 10000)

// Heartbeat: cerrar conexiones muertas
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      wsClients.delete(ws)
      return ws.terminate()
    }
    ws.isAlive = false
    ws.ping()
  })
}, 30000)

const PORT = process.env.PORT || 4000
server.listen(PORT, () => {
  console.log(`Servidor unificado corriendo en http://localhost:${PORT}`)
  console.log(`  REST API:  http://localhost:${PORT}/api/`)
  console.log(`  WebSocket: ws://localhost:${PORT}/ws`)
  console.log(`  Cliente:   http://localhost:${PORT}/`)
})
