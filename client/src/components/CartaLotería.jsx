import { getCarta } from '../data/cartas'

export default function CartaLotería({ cartaId, marcada, onClick, compacto }) {
  const carta = getCarta(cartaId)
  if (!carta) return null

  return (
    <button
      onClick={onClick}
      className={`card-loteria ${marcada ? 'marked' : ''}`}
      style={{
        borderColor: marcada ? '#4CAF50' : 'rgba(255,255,255,0.15)',
      }}
    >
      <img
        src={`/cards/${carta.imagen}`}
        alt={carta.nombre}
        className="w-full h-full object-cover absolute inset-0"
        loading="lazy"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pt-5 pb-1 px-1">
        <div className={`font-bold text-white/90 text-center leading-tight drop-shadow-lg ${compacto ? 'text-[7px] sm:text-[9px]' : 'text-[10px] sm:text-xs'}`}>
          {carta.nombre}
        </div>
      </div>
      {marcada && (
        <div className="absolute inset-0 bg-green-900/50 flex items-center justify-center backdrop-blur-[1px]">
          <svg className={`drop-shadow-lg ${compacto ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-8 h-8 sm:w-10 sm:h-10'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  )
}