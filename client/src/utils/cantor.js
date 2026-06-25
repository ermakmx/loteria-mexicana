export const audioCache = new Map()
let audioActual = null
let utteranceActual = null

function detenerTodo() {
  if (audioActual) {
    audioActual.pause()
    audioActual.currentTime = 0
    audioActual = null
  }
  if (utteranceActual) {
    window.speechSynthesis?.cancel()
    utteranceActual = null
  }
}

export function cantarCarta(carta, callback) {
  const audio = audioCache.get(carta.id)
  if (!audio) {
    if (callback) callback('end')
    return
  }

  detenerTodo()

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

export function reproducirEfecto(tipo, callback) {
  detenerTodo()

  if (!window.speechSynthesis) {
    if (callback) callback('end')
    return
  }

  const esVictoria = tipo === 'victoria'
  const texto = esVictoria
    ? '¡LOTERÍA! ¡LOTERÍA! ¡LOTERÍA!'
    : 'Buuuuu, trampa, trampa'

  const utterance = new SpeechSynthesisUtterance(texto)
  utterance.lang = 'es-MX'
  utterance.rate = esVictoria ? 1.5 : 0.8
  utterance.pitch = esVictoria ? 1.2 : 0.4

  utteranceActual = utterance

  utterance.onend = () => {
    utteranceActual = null
    if (callback) callback('end')
  }
  utterance.onerror = () => {
    utteranceActual = null
    if (callback) callback('end')
  }

  window.speechSynthesis.speak(utterance)
}

export function callarCantor() {
  detenerTodo()
}
