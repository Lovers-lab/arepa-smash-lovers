'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CartItem, Marca } from '@/types'

function formatRD(n: number) { return `RD$${n.toLocaleString('es-DO')}` }

function createRipple(e: React.MouseEvent<HTMLButtonElement>, color = 'rgba(255,255,255,0.4)') {
  const btn = e.currentTarget
  const circle = document.createElement('span')
  const d = Math.max(btn.clientWidth, btn.clientHeight)
  const rect = btn.getBoundingClientRect()
  circle.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX-rect.left-d/2}px;top:${e.clientY-rect.top-d/2}px;position:absolute;border-radius:50%;background:${color};transform:scale(0);animation:ripple-anim 0.5s linear;pointer-events:none;`
  circle.classList.add('ripple')
  btn.appendChild(circle)
  setTimeout(() => circle.remove(), 600)
}

export default function CartPage() {
  const router = useRouter()
  const [marca, setMarca] = useState<Marca>('AREPA')
  const [items, setItems] = useState<CartItem[]>([])
  const [loyaltySaldo, setLoyaltySaldo] = useState(0)
  const [usarLoyalty, setUsarLoyalty] = useState(false)
  const [loyaltyAplicado, setLoyaltyAplicado] = useState(0)
  const [brandColor, setBrandColor] = useState('#C41E3A')
  const [hasGift, setHasGift] = useState(false)
  const [giftNombre, setGiftNombre] = useState('')

  useEffect(() => {
    const storedMarca = localStorage.getItem('lovers_marca') as Marca || 'AREPA'
    const storedCart = localStorage.getItem('lovers_cart')
    const storedUser = localStorage.getItem('lovers_user')
    if (!storedUser) { router.replace('/auth/login'); return }
    if (!storedCart) { router.replace('/menu'); return }
    const cart = JSON.parse(storedCart)
    const color = storedMarca === 'AREPA' ? '#C41E3A' : '#0052CC'
    setMarca(storedMarca); setItems(cart.items || []); setBrandColor(color)
    const userId = JSON.parse(storedUser).id
    loadLoyalty(userId)
    checkGift(userId, storedMarca)
  }, [])

  async function loadLoyalty(userId: string) {
    const res = await fetch(`/api/loyalty/balance?userId=${userId}`)
    const data = await res.json()
    setLoyaltySaldo(data.saldo || 0)
  }

  async function checkGift(userId: string, m: string) {
    const res = await fetch(`/api/welcome-offers/check?userId=${userId}&marca=${m}`)
    const data = await res.json()
    if (data.hasOffer) {
      setHasGift(true)
      setGiftNombre(`${data.giftName} gratis 🎁`)
    }
  }

  function updateQty(productId: string, delta: number) {
    setItems(prev => {
      const updated = prev.map(i => i.product.id === productId ? { ...i, cantidad: i.cantidad + delta } : i).filter(i => i.cantidad > 0)
      localStorage.setItem('lovers_cart', JSON.stringify({ marca, items: updated }))
      return updated
    })
  }

  const subtotal = items.reduce((a, i) => a + (i.product.precio + (i.totalExtras || 0)) * i.cantidad, 0)
  const loyaltyDesc = usarLoyalty ? Math.min(loyaltySaldo, subtotal) : 0
  const totalPagar = subtotal - loyaltyDesc
  const envio = totalPagar >= 500 ? 0 : 99
  const total = totalPagar + envio

  function toggleLoyalty(val: boolean) {
    setUsarLoyalty(val)
    setLoyaltyAplicado(val ? Math.min(loyaltySaldo, subtotal) : 0)
  }

  if (!items.length) return (
    <div style={{ minHeight:'100dvh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'16px', padding:'24px', background:'#F7F8FA', fontFamily:'var(--font-body)' }}>
      <span style={{ fontSize:'56px' }}>🛒</span>
      <p style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'18px', color:'#374151' }}>Tu carrito está vacío</p>
      <button onClick={() => router.push('/menu')} style={{ padding:'14px 32px', borderRadius:'999px', border:'none', background:brandColor, color:'white', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'15px', cursor:'pointer' }}>
        Ver menú
      </button>
    </div>
  )

  return (
    <div style={{ minHeight:'100dvh', background:'#F7F8FA', paddingBottom:'120px', fontFamily:'var(--font-body)' }}>
      <style>{`@keyframes ripple-anim{to{transform:scale(4);opacity:0}} .md-ripple{position:relative;overflow:hidden;}`}</style>

      <header style={{ position:'sticky', top:0, zIndex:30, background:'white', borderBottom:'1px solid #E4E6EA', boxShadow:'0 1px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth:'520px', margin:'0 auto', padding:'14px 16px', display:'flex', alignItems:'center', gap:'12px' }}>
          <button onClick={() => router.back()} className="md-ripple"
            style={{ width:'38px', height:'38px', borderRadius:'50%', background:'#F3F4F6', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', color:'#6B7280', position:'relative' }}>‹</button>
          <div>
            <h1 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'20px', margin:0 }}>Tu carrito</h1>
            <p style={{ fontSize:'12px', color:'#9CA3AF', margin:0 }}>{marca === 'AREPA' ? '🫓 Arepa Lovers' : '🍔 Smash Lovers'} · {items.length} producto{items.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </header>

      <main style={{ maxWidth:'520px', margin:'0 auto', padding:'16px' }}>

        <div style={{ background:'white', borderRadius:'20px', border:'1px solid #E4E6EA', overflow:'hidden', marginBottom:'12px', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
          {items.map((item, idx) => (
            <div key={item.product.id} style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:'12px', borderBottom: idx < items.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
              {item.product.foto_url
                ? <img src={item.product.foto_url} alt={item.product.nombre} style={{ width:'56px', height:'56px', borderRadius:'14px', objectFit:'cover', flexShrink:0 }} />
                : <div style={{ width:'56px', height:'56px', borderRadius:'14px', background:`${brandColor}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px', flexShrink:0 }}>{marca === 'AREPA' ? '🫓' : '🍔'}</div>
              }
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'14px', color:'#0D0F12', margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.product.nombre}</p>
                {item.modifiers && item.modifiers.length > 0 && (
                  <p style={{ fontSize:'11px', color:'#9CA3AF', margin:'0 0 4px' }}>{item.modifiers.map((m: any) => m.optionNombre).join(' · ')}</p>
                )}
                <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'14px', color:brandColor, margin:0 }}>{formatRD(item.product.precio + (item.totalExtras || 0))}</p>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
                <button onClick={(e) => { createRipple(e, `${brandColor}20`); updateQty(item.product.id, -1) }} className="md-ripple"
                  style={{ width:'30px', height:'30px', borderRadius:'50%', border:`2px solid ${brandColor}`, background:'white', color:brandColor, fontSize:'16px', fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>−</button>
                <span style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'15px', minWidth:'18px', textAlign:'center' }}>{item.cantidad}</span>
                <button onClick={(e) => { createRipple(e); updateQty(item.product.id, 1) }} className="md-ripple"
                  style={{ width:'30px', height:'30px', borderRadius:'50%', border:'none', background:brandColor, color:'white', fontSize:'16px', fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', boxShadow:`0 2px 8px ${brandColor}40` }}>+</button>
              </div>
            </div>
          ))}
        </div>

        {hasGift && (
          <div style={{ background:'linear-gradient(135deg, #FFFBEB, #FEF3C7)', border:'1px solid #FDE68A', borderRadius:'16px', padding:'14px 16px', display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px' }}>
            <span style={{ fontSize:'28px' }}>🎁</span>
            <div>
              <p style={{ fontWeight:800, fontSize:'14px', color:'#92400E', margin:'0 0 2px' }}>{giftNombre}</p>
              <p style={{ fontSize:'12px', color:'#B45309', margin:0 }}>Se agrega automáticamente con tu primer plato fuerte</p>
            </div>
          </div>
        )}

        {loyaltySaldo > 0 && (
          <div style={{ background:'white', borderRadius:'16px', border:'1px solid #E4E6EA', padding:'16px', marginBottom:'12px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:`${brandColor}12`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px' }}>💰</div>
                <div>
                  <p style={{ fontWeight:700, fontSize:'14px', color:'#0D0F12', margin:'0 0 2px' }}>Puntos Lovers</p>
                  <p style={{ fontSize:'12px', color:'#9CA3AF', margin:0 }}>{loyaltySaldo} pts disponibles = {formatRD(loyaltySaldo)}</p>
                </div>
              </div>
              <button onClick={() => toggleLoyalty(!usarLoyalty)}
                style={{ width:'48px', height:'26px', borderRadius:'999px', border:'none', cursor:'pointer', background: usarLoyalty ? '#10B981' : '#E5E7EB', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
                <span style={{ position:'absolute', top:'3px', left: usarLoyalty ? '24px' : '3px', width:'20px', height:'20px', borderRadius:'50%', background:'white', boxShadow:'0 1px 4px rgba(0,0,0,0.2)', transition:'left 0.2s', display:'block' }} />
              </button>
            </div>
            {usarLoyalty && (
              <div style={{ marginTop:'10px', padding:'8px 12px', background:'#DCFCE7', borderRadius:'10px', fontSize:'13px', fontWeight:700, color:'#15803D' }}>
                ✓ −{formatRD(loyaltyAplicado)} aplicado
              </div>
            )}
          </div>
        )}

        <div style={{ background:'white', borderRadius:'16px', border:'1px solid #E4E6EA', padding:'16px', marginBottom:'12px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'14px', color:'#6B7280', marginBottom:'8px' }}>
            <span>Subtotal</span><span>{formatRD(subtotal)}</span>
          </div>
          {usarLoyalty && loyaltyAplicado > 0 && (
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'14px', fontWeight:700, color:'#7C3AED', marginBottom:'8px' }}>
              <span>💰 Puntos Lovers</span><span>−{formatRD(loyaltyAplicado)}</span>
            </div>
          )}
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'14px', color:'#6B7280', marginBottom:'8px' }}>
            <span>Envío</span>
            <span style={{ color: envio === 0 ? '#10B981' : '#6B7280', fontWeight: envio === 0 ? 700 : 400 }}>
              {envio === 0 ? 'GRATIS 🎉' : formatRD(envio)}
            </span>
          </div>
          {envio > 0 && (
            <div style={{ background:'#F7F8FA', borderRadius:'10px', padding:'8px 12px', fontSize:'12px', color:'#9CA3AF', marginBottom:'8px' }}>
              Agrega {formatRD(500 - totalPagar)} más para envío gratis
            </div>
          )}
          <div style={{ borderTop:'1.5px solid #F3F4F6', paddingTop:'12px', display:'flex', justifyContent:'space-between', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'19px' }}>
            <span>Total</span>
            <span style={{ color:brandColor }}>{formatRD(total)}</span>
          </div>
        </div>
      </main>

      <div style={{ position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)', zIndex:40, width:'100%', maxWidth:'520px', padding:'0 16px' }}>
        <button onClick={() => router.push('/checkout')} className="md-ripple"
          style={{ width:'100%', padding:'18px 24px', borderRadius:'20px', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', background:`linear-gradient(135deg, ${brandColor}, ${brandColor}CC)`, boxShadow:`0 8px 32px ${brandColor}50`, position:'relative' }}>
          <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'15px', color:'white' }}>Ir al checkout</span>
          <span style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'17px', color:'white' }}>{formatRD(total)} →</span>
        </button>
      </div>
    </div>
  )
}
