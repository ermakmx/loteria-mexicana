import { createContext, useContext, useState, useCallback } from 'react'
import { es, en } from './locales'

const LenguajeContext = createContext()

export function LenguajeProvider({ children }) {
  const [idioma, setIdioma] = useState(() => {
    try { return localStorage.getItem('loteria_idioma') || 'es' } catch { return 'es' }
  })

  const t = useCallback((clave) => {
    const lang = idioma === 'en' ? en : es
    return lang[clave] || clave
  }, [idioma])

  const toggleIdioma = useCallback(() => {
    setIdioma(prev => {
      const next = prev === 'es' ? 'en' : 'es'
      localStorage.setItem('loteria_idioma', next)
      return next
    })
  }, [])

  return (
    <LenguajeContext.Provider value={{ idioma, t, toggleIdioma }}>
      {children}
    </LenguajeContext.Provider>
  )
}

export function useLenguaje() {
  return useContext(LenguajeContext)
}
