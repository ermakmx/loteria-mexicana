import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { crearSala, unirseSala, obtenerSala, eliminarSala } from './salaManager.js'
import { iniciarJuego, sacarCarta, verificarLoteria, reiniciarJuego } from './gameManager.js'

const app = express()
const httpServer = createServer(app)

const CLIENT_URL = process.env.CLIENT_URL || '*'
const io = new Server(httpServer, {
  cors: { origin: CLIENT_URL.split(','), methods: ['GET', 'POST'] },
})

app.use(cors({ origin: CLIENT_URL.split(',') }))
app.get('/', (_, res) => res.json({ status: 'ok', juego: 'Lotería Mexicana' }))

const INTERVALO_CANTOR = 4000

io.on('connection', (socket) => {
  let salaActual = null
  let jugadorActual = null

  socket.on('crear_sala', ({ nombre }) => {
    const sala = crearSala()
    const resultado = unirseSala(sala.id, { nombre })
    if (resultado.error) {
      eliminarSala(sala.id)
      socket.emit('error', { mensaje: resultado.error })
      return
    }
    salaActual = sala.id
    jugadorActual = resultado.jugador
    socket.join(sala.id)
    socket.emit('sala_creada', {
      salaId: sala.id,
      jugador: resultado.jugador,
      jugadores: sala.jugadores.map(j => ({ id: j.id, nombre: j.nombre })),
    })
  })

  socket.on('unirse_sala', ({ salaId, nombre }) => {
    const resultado = unirseSala(salaId, { nombre })
    if (resultado.error) {
      socket.emit('error', { mensaje: resultado.error })
      return
    }
    salaActual = salaId
    jugadorActual = resultado.jugador
    socket.join(salaId)
    socket.emit('sala_unida', {
      salaId: salaId,
      jugador: resultado.jugador,
      jugadores: resultado.sala.jugadores.map(j => ({ id: j.id, nombre: j.nombre })),
    })
    socket.to(salaId).emit('jugador_unido', {
      jugador: { id: resultado.jugador.id, nombre: resultado.jugador.nombre },
      jugadores: resultado.sala.jugadores.map(j => ({ id: j.id, nombre: j.nombre })),
    })
  })

  socket.on('iniciar_juego', () => {
    const sala = obtenerSala(salaActual)
    if (!sala) return
    if (sala.jugadores.length < 2) {
      socket.emit('error', { mensaje: 'Se necesitan al menos 2 jugadores' })
      return
    }
    iniciarJuego(sala)
    for (const jugador of sala.jugadores) {
      const tablero = jugador.tablero
      io.to(salaActual).emit('juego_iniciado', {
        jugadorId: jugador.id,
        tablero,
        jugadores: sala.jugadores.map(j => ({ id: j.id, nombre: j.nombre })),
        totalCartas: sala.mazo.length + 1,
      })
    }
    sala.cantorActivo = true
    sala.intervaloId = setInterval(() => {
      const cartaId = sacarCarta(sala)
      if (cartaId === null) {
        clearInterval(sala.intervaloId)
        sala.intervaloId = null
        io.to(salaActual).emit('mazo_vacio')
        return
      }
      io.to(salaActual).emit('carta_sacada', {
        cartaId,
        historial: sala.historial,
        cartasRestantes: sala.mazo.length,
      })
    }, INTERVALO_CANTOR)
  })

  socket.on('cantar_loteria', () => {
    const sala = obtenerSala(salaActual)
    if (!sala || sala.estado !== 'jugando') return
    const resultado = verificarLoteria(sala, jugadorActual.id)
    if (resultado.valida) {
      io.to(salaActual).emit('loteria_valida', {
        ganador: { id: resultado.ganador.id, nombre: resultado.ganador.nombre },
      })
    } else {
      socket.emit('loteria_invalida', { razon: resultado.razon })
    }
  })

  socket.on('nuevo_juego', () => {
    const sala = obtenerSala(salaActual)
    if (!sala) return
    reiniciarJuego(sala)
    io.to(salaActual).emit('juego_reiniciado', {
      jugadores: sala.jugadores.map(j => ({ id: j.id, nombre: j.nombre })),
    })
  })

  socket.on('disconnect', () => {
    if (salaActual) {
      const sala = obtenerSala(salaActual)
      if (sala) {
        sala.jugadores = sala.jugadores.filter(j => j.id !== jugadorActual?.id)
        io.to(salaActual).emit('jugador_desconectado', {
          jugadorId: jugadorActual?.id,
          jugadores: sala.jugadores.map(j => ({ id: j.id, nombre: j.nombre })),
        })
        if (sala.jugadores.length === 0) {
          eliminarSala(salaActual)
        }
      }
    }
  })
})

const PORT = process.env.PORT || 4000
httpServer.listen(PORT, () => {
  console.log('🎴 Servidor de Lotería en http://localhost:' + PORT)
})
