import { crearSala, unirseSala, obtenerSala, eliminarSala, guardarSala, registrarVictoria, obtenerRankings, obtenerEstadisticas, listarSalasPublicas } from './salaManager.js'
import { iniciarJuego, sacarCarta, verificarLoteria, reiniciarJuego } from './gameManager.js'

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function json(res, data, status = 200) {
  cors(res)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.end(JSON.stringify(data))
}

function getBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => body += chunk)
    req.on('end', () => {
      try { resolve(JSON.parse(body)) }
      catch { resolve({}) }
    })
  })
}

function getParam(req, name) {
  const url = new URL(req.url, 'http://localhost')
  return url.searchParams.get(name)
}

function sanitizarSala(sala, jugadorId) {
  if (!sala) return null
  const jugador = jugadorId ? sala.jugadores.find(j => j.id === jugadorId) : null
  return {
    estado: sala.estado,
    jugadores: sala.jugadores.map(j => ({ id: j.id, nombre: j.nombre })),
    cartaActualId: sala.cartaActual,
    historial: sala.historial,
    cartasRestantes: sala.mazo?.length ?? 0,
    ganador: sala.ganador ? { id: sala.ganador.id, nombre: sala.ganador.nombre } : null,
    tableros: jugador?.tableros || null,
    motivoFin: sala.motivoFin || null,
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.end(); return }

  const path = new URL(req.url, 'http://localhost').pathname.replace(/\/api\/?/, '')

  try {
    switch (path) {
      case 'crear-sala': {
        if (req.method !== 'POST') { json(res, { error: 'POST required' }, 405); return }
        const { nombre, publica, tableros } = await getBody(req)
        if (!nombre) { json(res, { error: 'Nombre requerido' }, 400); return }
        const sala = await crearSala(!!publica, tableros)
        const r = await unirseSala(sala.id, { nombre })
        if (r.error) { await eliminarSala(sala.id); json(res, r, 400); return }
        json(res, {
          salaId: sala.id,
          jugador: r.jugador,
          jugadores: sala.jugadores.map(j => ({ id: j.id, nombre: j.nombre })),
        })
        return
      }

      case 'unirse-sala': {
        if (req.method !== 'POST') { json(res, { error: 'POST required' }, 405); return }
        const { salaId, nombre } = await getBody(req)
        if (!salaId || !nombre) { json(res, { error: 'salaId y nombre requeridos' }, 400); return }
        const r = await unirseSala(salaId, { nombre })
        if (r.error) { json(res, r, 400); return }
        json(res, {
          jugador: r.jugador,
          jugadores: r.sala.jugadores.map(j => ({ id: j.id, nombre: j.nombre })),
          salaId,
        })
        return
      }

      case 'iniciar-juego': {
        if (req.method !== 'POST') { json(res, { error: 'POST required' }, 405); return }
        const { salaId, jugadorId } = await getBody(req)
        const sala = await obtenerSala(salaId)
        if (!sala) { json(res, { error: 'Sala no existe' }, 404); return }
        if (sala.jugadores.length < 2) { json(res, { error: 'Mínimo 2 jugadores' }, 400); return }
        if (sala.jugadores[0]?.id !== jugadorId) { json(res, { error: 'Solo el host puede iniciar' }, 403); return }
        iniciarJuego(sala)
        await guardarSala(sala)
        const tablero = sala.jugadores.find(j => j.id === jugadorId)?.tablero || []
        json(res, { jugadorId, tablero, jugadores: sala.jugadores.map(j => ({ id: j.id, nombre: j.nombre })), totalCartas: sala.mazo.length })
        return
      }

      case 'siguiente-carta': {
        if (req.method !== 'POST') { json(res, { error: 'POST required' }, 405); return }
        const body = await getBody(req)
        const sala = await obtenerSala(body.salaId)
        if (!sala || sala.estado !== 'jugando') { json(res, { error: 'Juego no activo' }, 400); return }
        const cartaId = sacarCarta(sala)
        if (cartaId === null) { json(res, { mazoVacio: true }); return }
        await guardarSala(sala)
        json(res, { cartaId, historial: sala.historial, cartasRestantes: sala.mazo.length })
        return
      }

      case 'cantar-loteria': {
        if (req.method !== 'POST') { json(res, { error: 'POST required' }, 405); return }
        const body = await getBody(req)
        const sala = await obtenerSala(body.salaId)
        if (!sala || sala.estado !== 'jugando') { json(res, { error: 'Juego no activo' }, 400); return }
        const r = verificarLoteria(sala, body.jugadorId)
        await guardarSala(sala)
        if (r.valida) {
          await registrarVictoria(r.ganador.nombre, sala)
          json(res, { valida: true, ganador: { id: r.ganador.id, nombre: r.ganador.nombre } })
        } else {
          json(res, { valida: false, razon: r.razon })
        }
        return
      }

      case 'nuevo-juego': {
        if (req.method !== 'POST') { json(res, { error: 'POST required' }, 405); return }
        const body = await getBody(req)
        const sala = await obtenerSala(body.salaId)
        if (!sala) { json(res, { error: 'Sala no existe' }, 404); return }
        reiniciarJuego(sala)
        await guardarSala(sala)
        json(res, { jugadores: sala.jugadores.map(j => ({ id: j.id, nombre: j.nombre })) })
        return
      }

      case 'estado-sala': {
        const salaId = getParam(req, 'salaId')
        const jugadorId = getParam(req, 'jugadorId')
        if (!salaId) { json(res, { error: 'salaId requerido' }, 400); return }
        const sala = await obtenerSala(salaId, jugadorId)
        if (!sala) { json(res, { error: 'Sala no existe' }, 404); return }
        json(res, sanitizarSala(sala, jugadorId))
        return
      }

      case 'listar-salas': {
        json(res, listarSalasPublicas())
        return
      }

      case 'rankings': {
        const rankings = await obtenerRankings()
        json(res, rankings)
        return
      }

      case 'stats': {
        const stats = await obtenerEstadisticas()
        json(res, stats)
        return
      }

      default:
        json(res, { status: 'ok', juego: 'Lotería Mexicana' })
    }
  } catch (err) {
    json(res, { error: err.message }, 500)
  }
}
