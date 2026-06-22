const audioCache = new Map()
let audioActual = null

export function cantarCarta(carta, callback) {
  const src = `/audio/carta_${carta.id}.mp3`

  if (audioActual) {
    audioActual.pause()
    audioActual.currentTime = 0
  }

  if (audioCache.has(src)) {
    audioActual = audioCache.get(src)
    audioActual.currentTime = 0
  } else {
    audioActual = new Audio(src)
    audioActual.preload = 'auto'
    audioCache.set(src, audioActual)
  }

  if (callback) {
    audioActual.onended = () => callback('end')
    audioActual.onerror = () => callback('end')
  }

  audioActual.play().catch(() => {
    if (callback) callback('end')
  })
}

export function callarCantor() {
  if (audioActual) {
    audioActual.pause()
    audioActual.currentTime = 0
  }
}
