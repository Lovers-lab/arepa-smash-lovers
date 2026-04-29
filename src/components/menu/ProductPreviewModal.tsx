'use client'
import { useEffect, useRef } from 'react'

interface Product {
  id: string
  nombre: string
  precio: number
  descripcion?: string
  foto_url?: string | null
  descuento_pct?: number
  es_destacado?: boolean
}

interface Props {
  product: Product
  brandColor: string
  marca: string
  inCartQty: number
  onClose: () => void
  onAddToCart: () => void
  onRemoveFromCart: () => void
}

function formatRD(n: number) { return `RD$${n.toLocaleString('es-DO')}` }

export default function ProductPreviewModal({ product, brandColor, marca, inCartQty, onClose, onAddToCart, onRemoveFromCart }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const currentY = useRef(0)
  const isDragging = useRef(false)

  const descuento = product.descuento_pct || 0
  const precioFinal = descuento > 0 ? Math.round(product.precio * (1 - descuento / 100)) : product.precio

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Touch drag to close
  function onTouchStart(e: React.TouchEvent) {
    startY.current = e.touches[0].clientY
    isDragging.current = true
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!isDragging.current || !sheetRef.current) return
    const delta = e.touches[0].clientY - startY.current
    currentY.current = delta
    if (delta > 0) sheetRef.current.style.transform = `translateY(${delta}px)`
  }
  function onTouchEnd() {
    isDragging.current = false
    if (!sheetRef.current) return
    if (currentY.current > 120) {
      onClose()
    } else {
      sheetRef.current.style.transform = 'translateY(0)'
      sheetRef.current.style.transition = 'transform 0.3s ease'
      setTimeout(() => { if (sheetRef.current) sheetRef.current.style.transition = '' }, 300)
    }
    currentY.current = 0
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)', animation:'fadeIn 0.25s ease' }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        style={{
          position:'relative', zIndex:1,
          background:'white',
          borderRadius:'28px 28px 0 0',
          maxHeight:'92dvh',
          display:'flex', flexDirection:'column',
          animation:'slideUp 0.32s cubic-bezier(0.32,0.72,0,1)',
          overflow:'hidden',
        }}
      >
        {/* Drag handle */}
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{ padding:'12px 0 4px', display:'flex', justifyContent:'center', cursor:'grab', flexShrink:0 }}
        >
          <div style={{ width:40, height:4, borderRadius:999, background:'#E0E0E0' }} />
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY:'auto', flex:1 }}>
          {/* Foto grande */}
          <div style={{ position:'relative', height:280, background:'linear-gradient(135deg,#FEF3C7,#FDE68A)', flexShrink:0 }}>
            {product.foto_url
              ? <img src={product.foto_url} alt={product.nombre} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'80px' }}>{marca === 'AREPA' ? '🫓' : '🍔'}</div>
            }
            {/* Badges */}
            {descuento > 0 && (
              <div style={{ position:'absolute', top:16, left:16, background:'#FFD600', color:'#1A1A1A', fontSize:'13px', fontWeight:900, padding:'5px 12px', borderRadius:999, boxShadow:'0 2px 8px rgba(0,0,0,0.15)' }}>{descuento}% OFF</div>
            )}
            {product.es_destacado && !descuento && (
              <div style={{ position:'absolute', top:16, right:16, background:brandColor, color:'white', fontSize:'12px', fontWeight:800, padding:'5px 12px', borderRadius:999, boxShadow:'0 2px 8px rgba(0,0,0,0.2)' }}>⭐ Top</div>
            )}
            {/* Close button */}
            <button
              onClick={onClose}
              style={{ position:'absolute', top:14, right:14, width:36, height:36, borderRadius:'50%', border:'none', background:'rgba(0,0,0,0.35)', backdropFilter:'blur(8px)', color:'white', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>
              ×
            </button>
          </div>

          {/* Info */}
          <div style={{ padding:'20px 20px 8px' }}>
            <h2 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'22px', color:'#0D0F12', margin:'0 0 8px', lineHeight:1.2 }}>{product.nombre}</h2>

            {/* Precio */}
            <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:16 }}>
              <span style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'26px', color:brandColor }}>{formatRD(precioFinal)}</span>
              {descuento > 0 && (
                <span style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:'16px', color:'#9CA3AF', textDecoration:'line-through' }}>{formatRD(product.precio)}</span>
              )}
            </div>

            {/* Descripción */}
            {product.descripcion && (
              <div style={{ marginBottom:20 }}>
                <p style={{ fontSize:'15px', color:'#6B7280', lineHeight:1.7, margin:0 }}>{product.descripcion}</p>
              </div>
            )}

            {/* Separador */}
            <div style={{ height:1, background:'#F3F4F6', marginBottom:20 }} />
          </div>
        </div>

        {/* Bottom CTA — sticky */}
        <div style={{ padding:'12px 20px 28px', background:'white', borderTop:'1px solid #F3F4F6', flexShrink:0 }}>
          {inCartQty > 0 ? (
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <button
                onClick={onRemoveFromCart}
                style={{ width:52, height:52, borderRadius:14, border:`2px solid ${brandColor}`, background:'white', color:brandColor, fontSize:24, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                −
              </button>
              <div style={{ flex:1, textAlign:'center' }}>
                <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'18px' }}>{inCartQty} en carrito</div>
                <div style={{ fontSize:'13px', color:'#9CA3AF' }}>{formatRD(precioFinal * inCartQty)}</div>
              </div>
              <button
                onClick={onAddToCart}
                style={{ width:52, height:52, borderRadius:14, border:'none', background:brandColor, color:'white', fontSize:24, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:`0 4px 16px ${brandColor}40` }}>
                +
              </button>
            </div>
          ) : (
            <button
              onClick={onAddToCart}
              style={{ width:'100%', padding:'16px', borderRadius:16, border:'none', background:brandColor, color:'white', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'17px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:`0 6px 20px ${brandColor}45` }}>
              Agregar al carrito · {formatRD(precioFinal)}
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUp { from { transform:translateY(100%) } to { transform:translateY(0) } }
      `}</style>
    </div>
  )
}
