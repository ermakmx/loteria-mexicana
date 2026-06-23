export const audioCache = new Map()
let audioActual = null

export function cantarCarta(carta, callback) {
  const audio = audioCache.get(carta.id)
  if (!audio) {
    if (callback) callback('end')
    return
  }

  if (audioActual) {
    audioActual.pause()
    audioActual.currentTime = 0
  }

  audioActual = audio
  audioActual.currentTime = 0

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
