import CartaLotería from './CartaLotería'

export default function Tablero({ tablero, marcadas, onMarcar, titulo, compacto }) {
  return (
    <div className="w-full">
      {titulo && (
        <h3 className={`font-bold text-center text-white/50 mb-1 uppercase tracking-wider ${compacto ? 'text-[10px]' : 'text-sm'}`}>
          {titulo}
        </h3>
      )}
      <div className={`grid grid-cols-4 ${compacto ? 'gap-1' : 'gap-1.5 sm:gap-2'}`}>
        {tablero.map((cartaId) => (
          <CartaLotería
            key={cartaId}
            cartaId={cartaId}
            marcada={marcadas.has(cartaId)}
            onClick={() => onMarcar(cartaId)}
            compacto={compacto}
          />
        ))}
      </div>
    </div>
  )
}