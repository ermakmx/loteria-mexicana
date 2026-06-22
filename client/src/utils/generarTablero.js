import { CARTAS } from '../data/cartas.js'

export function generarTablero() {
  const copia = [...CARTAS]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia.slice(0, 16)
}
