import { put, list } from '@vercel/blob'

const RANKINGS_FILE = 'rankings.json'
const TIMEOUT_MS = 30000

const salas = new Map()

function generarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function crearSala() {
  const id = generarCodigo()
  const sala = { id, jugadores: [], estado: 'esperando', mazo: [], cartaActual: null, historial: [], ganador: null }
  salas.set(id, sala)
  return sala
}

export async function unirseSala(salaId, jugador) {
  const sala = salas.get(salaId)
  if (!sala) return { error: 'La sala no existe' }
  if (sala.estado !== 'esperando') return { error: 'El juego ya comenzó' }
  if (sala.jugadores.some(j => j.nombre === jugador.nombre)) return { error: 'Ese nombre ya está en uso' }
  const nuevoJugador = { id: crypto.randomUUID(), nombre: jugador.nombre, tablero: null, ultimaActividad: Date.now() }
  sala.jugadores.push(nuevoJugador)
  return { jugador: nuevoJugador, sala }
}

function limpiarInactivos(sala) {
  if (!sala || sala.estado !== 'jugando') return
  const ahora = Date.now()
  const activos = sala.jugadores.filter(j => ahora - (j.ultimaActividad || 0) < TIMEOUT_MS)
  if (activos.length < sala.jugadores.length) {
    sala.jugadores = activos
  }
}

function verificarAbandono(sala, jugadorId) {
  if (!sala || sala.estado !== 'jugando') return null
  if (sala.jugadores.length > 1) return null
  const unico = sala.jugadores[0]
  if (!unico) return null
  if (unico.id !== jugadorId) return null
  return unico
}

export async function obtenerSala(salaId, jugadorId) {
  const sala = salas.get(salaId)
  if (!sala) return null

  if (jugadorId) {
    const jugador = sala.jugadores.find(j => j.id === jugadorId)
    if (jugador) jugador.ultimaActividad = Date.now()
  }

  limpiarInactivos(sala)

  const ganador = verificarAbandono(sala, jugadorId)
  if (ganador) {
    sala.estado = 'terminado'
    sala.ganador = ganador
    sala.motivoFin = 'abandono'
    try { await registrarVictoria(ganador.nombre, sala) } catch {}
  }

  return sala
}

export async function guardarSala(sala) {
  salas.set(sala.id, sala)
}

export async function eliminarSala(salaId) {
  salas.delete(salaId)
}

// ========== RANKINGS ==========
export async function registrarVictoria(nombreGanador, sala) {
  try {
    const result = await list({ prefix: RANKINGS_FILE })
    let rankings = []
    if (result.blobs.length > 0) {
      const url = result.blobs[0].url + '?_t=' + Date.now()
      const res = await fetch(url)
      if (res.ok) { const t = await res.text(); if (t) rankings = JSON.parse(t) }
    }
    const duracion = sala.inicio ? Math.round((Date.now() - sala.inicio) / 1000) : 0
    rankings.push({
      ganador: nombreGanador,
      jugadores: (sala.jugadores || []).map(j => j.nombre),
      fecha: new Date().toISOString(),
      totalCartas: sala.historial.length,
      duracion,
    })
    await put(RANKINGS_FILE, JSON.stringify(rankings), {
      access: 'public', addRandomSuffix: false, allowOverwrite: true,
    })
  } catch {}
}

export async function obtenerRankings() {
  try {
    const entries = await leerRankings()
    const conteo = {}
    for (const r of entries) conteo[r.ganador] = (conteo[r.ganador] || 0) + 1
    return Object.entries(conteo)
      .map(([nombre, victorias]) => ({ nombre, victorias }))
      .sort((a, b) => b.victorias - a.victorias)
  } catch { return [] }
}

async function leerRankings() {
  const result = await list({ prefix: RANKINGS_FILE })
  if (result.blobs.length === 0) return []
  const url = result.blobs[0].url + '?_t=' + Date.now()
  const res = await fetch(url)
  if (!res.ok) return []
  return JSON.parse(await res.text())
}

export async function obtenerEstadisticas() {
  try {
    const entries = await leerRankings()
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
        avgDuracion: s.totalDuracion > 0 ? Math.round(s.totalDuracion / (s.partidas)) : 0,
      })).sort((a, b) => b.victorias - a.victorias),
    }
  } catch { return { totalPartidas: 0, jugadores: [] } }
}
