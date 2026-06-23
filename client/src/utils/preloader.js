import { CARTAS } from '../data/cartas'
import { audioCache } from './cantor'

export function preloadAssets(onProgress) {
  const total = CARTAS.length * 2
  let loaded = 0

  function listo() {
    loaded++
    if (onProgress) onProgress(Math.min(loaded / total, 1))
    if (loaded >= total) resolve()
  }

  let resolve
  return new Promise((r) => {
    resolve = r
    if (CARTAS.length === 0) { resolve(); return }
    for (const carta of CARTAS) {
      const img = new Image()
      img.onload = img.onerror = listo
      img.src = `/cards/${carta.imagen}`
      const audio = new Audio()
      audio.preload = 'auto'
      audioCache.set(carta.id, audio)
      audio.addEventListener('canplaythrough', listo, { once: true })
      audio.addEventListener('error', listo, { once: true })
      audio.src = `/audio/carta_${carta.id}.mp3`
      audio.load()
    }
  })
}
