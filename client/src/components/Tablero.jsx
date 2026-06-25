import CartaLotería from './CartaLotería'

export default function Tablero({ tablero, marcadas, onMarcar, titulo }) {
  return (
    <div className="w-full max-w-md mx-auto">
      {titulo && (
        <h3 className="text-sm font-bold text-center text-white/50 mb-2 uppercase tracking-wider">
          {titulo}
        </h3>
      )}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {tablero.map((cartaId) => (
          <CartaLotería
            key={cartaId}
            cartaId={cartaId}
            marcada={marcadas.has(cartaId)}
            onClick={() => onMarcar(cartaId)}
          />
        ))}
      </div>
    </div>
  )
}