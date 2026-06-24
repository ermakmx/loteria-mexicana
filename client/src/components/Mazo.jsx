import { getCarta } from '../data/cartas'

function CartaDisplay({ cartaId }) {
  const carta = getCarta(cartaId)
  if (!carta) return null
  return (
    <div className="flex flex-col items-center animate-carta-entrada">
      <img
        src={`/cards/${carta.imagen}`}
        alt={carta.nombre}
        className="w-full max-w-[180px] h-auto max-h-56 object-contain rounded-xl shadow-2xl"
      />
      <div className="text-lg sm:text-xl font-bold text-white mt-2 text-center">{carta.nombre}</div>
    </div>
  )
}

export default function Mazo({ cartaActualId, historial, cartasRestantes }) {
  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="flex items-center gap-2 text-xs text-white/40">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        Cantando...
        <span className="text-white/20">({cartasRestantes} restantes)</span>
      </div>

      <div className="panel p-3 sm:p-4 w-full max-w-[260px] mx-auto">
        {cartaActualId && <CartaDisplay key={cartaActualId} cartaId={cartaActualId} />}
      </div>

      {historial.length > 0 && (
        <details className="w-full max-w-[260px] mx-auto text-xs">
          <summary className="cursor-pointer text-white/30 hover:text-white/60 text-center py-1">
            Historial ({historial.length})
          </summary>
          <div className="flex flex-wrap gap-1 mt-1 justify-center">
            {historial.map((id) => {
              const c = getCarta(id)
              return (
                <span key={id} title={c?.nombre} className="bg-white/5 rounded p-0.5">
                  <img src={`/cards/${c?.imagen}`} className="w-5 h-7 object-cover rounded" />
                </span>
              )
            })}
          </div>
        </details>
      )}
    </div>
  )
}
