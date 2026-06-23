import { useEffect, useRef, useCallback, useState } from 'react'

const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const WS_URL = `${WS_PROTOCOL}//${window.location.host}/ws`

export default function useWebSocket(salaId, jugadorId) {
  const wsRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [lastState, setLastState] = useState(null)
  const handlersRef = useRef(new Map())
  const reconnectAttemptsRef = useRef(0)

  const send = useCallback((event, data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event, data }))
    }
  }, [])

  const on = useCallback((event, handler) => {
    handlersRef.current.set(event, handler)
  }, [])

  const off = useCallback((event) => {
    handlersRef.current.delete(event)
  }, [])

  useEffect(() => {
    let mounted = true

    function connect() {
      if (!mounted) return
      wsRef.current = new WebSocket(WS_URL)

      wsRef.current.onopen = () => {
        reconnectAttemptsRef.current = 0
        setConnected(true)
        if (salaId) {
          send('get-state', { salaId, jugadorId })
        }
      }

      wsRef.current.onmessage = (msg) => {
        try {
          const { event, data } = JSON.parse(msg.data)
          if (event === 'sala-actualizada') {
            setLastState(data)
          }
          const handler = handlersRef.current.get(event)
          if (handler) handler(data)
        } catch {}
      }

      wsRef.current.onclose = () => {
        setConnected(false)
        if (!mounted) return
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000)
        reconnectAttemptsRef.current++
        reconnectTimerRef.current = setTimeout(connect, delay)
      }

      wsRef.current.onerror = () => {
        wsRef.current?.close()
      }
    }

    connect()

    // Periodic ping to keep ultimaActividad alive
    const pingInterval = setInterval(() => {
      if (salaId && jugadorId && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ event: 'get-state', data: { salaId, jugadorId } }))
      }
    }, 15000)

    return () => {
      mounted = false
      clearTimeout(reconnectTimerRef.current)
      clearInterval(pingInterval)
      wsRef.current?.close()
    }
  }, [salaId, jugadorId])

  return { connected, send, on, off, lastState }
}
