import CartaLotería from './CartaLotería'

export default function Tablero({ tablero, marcadas, onMarcar }) {
  return (
    <div className="w-full max-w-md mx-auto">
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