import { getCarta } from '../data/cartas'

export default function CartaLotería({ cartaId, marcada, onClick }) {
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
        <div className="text-[10px] sm:text-xs font-bold text-white/90 text-center leading-tight drop-shadow-lg">
          {carta.nombre}
        </div>
      </div>
      {marcada && (
        <div className="absolute inset-0 bg-green-900/50 flex items-center justify-center backdrop-blur-[1px]">
          <svg className="w-8 h-8 sm:w-10 sm:h-10 text-green-300 drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  )
}
