export default function CantorAnimado({ activo, cartaNombre }) {
  if (!activo) return null
  return (
    <div className="flex items-center justify-center gap-3 animate-bounce-in">
      <span className="text-2xl animate-bounce">🎤</span>
      <div>
        <div className="text-[10px] tracking-widest text-white/40 uppercase">Cantando...</div>
        {cartaNombre && <div className="text-base font-bold text-loteria-gold">{cartaNombre}</div>}
      </div>
    </div>
  )
}
