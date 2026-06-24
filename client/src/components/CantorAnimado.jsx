export default function CantorAnimado({ activo, cartaNombre }) {
  return (
    <div className={`flex items-center justify-center gap-3 w-full max-w-[260px] min-h-[48px] rounded-xl ${activo ? 'bg-loteria-gold/10 animate-bounce-in' : 'bg-white/5'}`}>
      <span className={`text-xl ${activo ? 'animate-bounce' : 'opacity-30'}`}>🎤</span>
      <div className="leading-tight">
        {activo ? (
          <>
            <div className="text-[10px] tracking-widest text-white/40 uppercase">Cantando...</div>
            {cartaNombre && <div className="text-sm font-bold text-loteria-gold">{cartaNombre}</div>}
          </>
        ) : (
          <div className="text-[10px] text-white/20">Esperando carta...</div>
        )}
      </div>
    </div>
  )
}
