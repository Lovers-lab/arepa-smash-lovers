'use client'


import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Marca, CartItem } from '@/types'
import { validateCardNumber, validateCardExpiry, formatCardNumber, formatCardExpiry } from '@/lib/utils/validators'
import { formatRD, calculateShipping } from '@/lib/utils/formatters'
import { createClient } from '@/lib/supabase/client'
import BankSelector from '@/components/forms/BankSelector'
import MapPicker from '@/components/map/MapPicker'
import { syncCartToCloud } from '@/lib/utils/cart'

export const dynamic = 'force-dynamic'
const supabase = createClient()

type Step = 'direccion' | 'pago' | 'confirmar'
type MetodoPago = 'TARJETA' | 'TRANSFERENCIA'

function ripple(e: React.MouseEvent<HTMLButtonElement>, c = 'rgba(255,255,255,0.4)') {
  const b = e.currentTarget, d = Math.max(b.clientWidth, b.clientHeight)
  const r = b.getBoundingClientRect(), s = document.createElement('span')
  s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX-r.left-d/2}px;top:${e.clientY-r.top-d/2}px;position:absolute;border-radius:50%;background:${c};transform:scale(0);animation:rpl 0.5s linear;pointer-events:none;`
  b.appendChild(s); setTimeout(() => s.remove(), 600)
}

export default function CheckoutPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('direccion')
  const [marca, setMarca] = useState<Marca>('AREPA')
  const [user, setUser] = useState<any>(null)
  const [items, setItems] = useState<CartItem[]>([])
  const [brandColor, setBrandColor] = useState('#C41E3A')
  const [direccion, setDireccion] = useState('')
  const [notasCliente, setNotasCliente] = useState('')
  const [metodoPago, setMetodoPago] = useState<MetodoPago | null>(null)
  const [comprobante, setComprobante] = useState<File | null>(null)
  const [comprobantePreview, setComprobantePreview] = useState('')
  const [selectedBank, setSelectedBank] = useState<any>(null)
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null)
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null)
  const [inDeliveryZone, setInDeliveryZone] = useState<boolean | null>(null)
  const [deliveryZone, setDeliveryZone] = useState<any>(null)
  const [cardNombre, setCardNombre] = useState('')
  const [cardNumero, setCardNumero] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCVV, setCardCVV] = useState('')
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({})
  const [promoCode, setPromoCode] = useState('')
  const [promoResult, setPromoResult] = useState<any>(null)
  const [checkingPromo, setCheckingPromo] = useState(false)
  const [loyaltySaldo, setLoyaltySaldo] = useState(0)
  const loyaltyOnRef = useRef(false)
  const [usarLoyalty, setUsarLoyalty] = useState(false)
  const [loyaltyAplicado, setLoyaltyAplicado] = useState(0)
  const [hasGift, setHasGift] = useState(false)
  const [giftNombre, setGiftNombre] = useState('')
  const [metodosActivos, setMetodosActivos] = useState({ tarjeta: true, transferencia: true })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const storedUser = localStorage.getItem('lovers_user')
    const storedCart = localStorage.getItem('lovers_cart')
    const storedMarca = localStorage.getItem('lovers_marca') as Marca || 'AREPA'
    if (!storedUser || !storedCart) { router.replace('/menu'); return }
    const u = JSON.parse(storedUser)
    const cart = JSON.parse(storedCart)
    setUser(u); setItems(cart.items || []); setMarca(storedMarca)
    setBrandColor(storedMarca === 'SMASH' ? '#0052CC' : '#C41E3A')
    loadSettings(storedMarca)
    checkWelcome(u.id, storedMarca)
    loadLoyalty(u.id)
  }, [])

  useEffect(() => {
    const montoGuardado = Number(localStorage.getItem('lovers_loyalty_monto') || 0)
    if (montoGuardado > 0) {
      setUsarLoyalty(true)
      setLoyaltyAplicado(montoGuardado)
    }
  }, [])

  async function loadSettings(m: Marca) {
    const { data: zoneData } = await supabase.from('delivery_zones').select('*').eq('activo', true).single()
    if (zoneData) setDeliveryZone(zoneData)
  }

  async function loadLoyalty(userId: string) {
    const res = await fetch(`/api/loyalty/balance?userId=${userId}`)
    const data = await res.json()
    setLoyaltySaldo(data.saldo || 0)
  }

  async function checkWelcome(userId: string, m: string) {
    const res = await fetch(`/api/welcome-offers/check?userId=${userId}&marca=${m}`)
    const data = await res.json()
    if (data.hasOffer) {
      setHasGift(true)
      setGiftNombre(data.giftName || (m === 'SMASH' ? 'Papas Bacon Cheese' : 'Tequeños'))
    }
  }

  async function checkPromoCode() {
    if (!promoCode.trim() || !user) return
    setCheckingPromo(true)
    const res = await fetch(`/api/codes/validate?code=${encodeURIComponent(promoCode.trim())}&userId=${user.id}`)
    const data = await res.json()
    setPromoResult(data); setCheckingPromo(false)
  }

  function toggleLoyalty(val: boolean) {
    setUsarLoyalty(val)
    if (val) setLoyaltyAplicado(Math.min(loyaltySaldo, subtotal))
    else setLoyaltyAplicado(0)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setError('La foto debe pesar menos de 2MB'); return }
    setComprobante(file); setComprobantePreview(URL.createObjectURL(file)); setError('')
  }

  function validateCard(): boolean {
    const errs: Record<string, string> = {}
    if (!cardNombre.trim()) errs.nombre = 'Requerido'
    if (!validateCardNumber(cardNumero)) errs.numero = 'Número inválido'
    if (!validateCardExpiry(cardExpiry)) errs.expiry = 'Fecha inválida'
    if (cardCVV.length < 3) errs.cvv = 'CVV inválido'
    setCardErrors(errs)
    return Object.keys(errs).length === 0
  }

  const subtotal = items.reduce((a, i) => a + (i.product.precio + (i.totalExtras || 0)) * i.cantidad, 0)
  const promoDiscount = promoResult?.valid ? Math.round(subtotal * (promoResult.discount_pct || 0) / 100) : 0
  const totalPostDesc = Math.max(0, subtotal - loyaltyAplicado - promoDiscount)
  const envio = calculateShipping(totalPostDesc)
  const total = totalPostDesc + envio
  const stepNum = step === 'direccion' ? 1 : step === 'pago' ? 2 : 3
  const brandLogo = marca === 'AREPA' ? '/logos/logo-arepa.png' : '/logos/logo-smash.png'

  async function submitOrder() {

    setSubmitting(true); setError('')
    try {
      const formData = new FormData()
      formData.append('userId', user.id)
      formData.append('marca', marca)
      formData.append('metodoPago', metodoPago!)
      formData.append('direccion', direccion)
      formData.append('notasCliente', notasCliente)
      formData.append('loyaltyAplicado', String(loyaltyAplicado))
      formData.append('promoCode', promoResult?.valid ? (promoResult.code || '') : '')
      formData.append('promoType', promoResult?.type || '')
      formData.append('items', JSON.stringify(items.map(i => ({ productId: i.product.id, cantidad: i.cantidad, notas: i.notas }))))
      if (deliveryLat) formData.append('lat', String(deliveryLat))
      if (deliveryLng) formData.append('lng', String(deliveryLng))

      if (comprobante) formData.append('comprobante', comprobante)
      const res = await fetch('/api/orders/create', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error procesando el pedido'); setSubmitting(false); return }
      localStorage.removeItem('lovers_cart')
      // Limpiar carrito en cloud
      syncCartToCloud(user.id, marca, [])
      // Guardar en array de pedidos activos (soporta múltiples simultáneos)
      const existingRaw = localStorage.getItem('lovers_active_orders')
      const existing = existingRaw ? JSON.parse(existingRaw) : []
      const newOrder = { id: data.orderId, numero: data.numeroPedido || String(data.orderId).substring(0,8), estado: 'PENDIENTE', marca: marca }
      localStorage.setItem('lovers_active_orders', JSON.stringify([...existing, newOrder]))
      router.push('/')
    } catch { setError('Error de conexión. Intenta de nuevo.'); setSubmitting(false) }
  }

  const fld = (label: string, ph: string, val: string, set: (v:string)=>void, err?: string, type='text') => (
    <div>
      <label style={{ fontSize:'12px', fontWeight:700, color:'#6B7280', display:'block', marginBottom:'6px' }}>{label}</label>
      <input type={type} placeholder={ph} value={val} onChange={e => set(e.target.value)}
        style={{ width:'100%', border:`2px solid ${err?'#EF4444':'#E4E6EA'}`, borderRadius:'12px', padding:'12px 14px', fontSize:'14px', outline:'none', fontFamily:'var(--font-body)', boxSizing:'border-box' as any }} />
      {err && <p style={{ color:'#EF4444', fontSize:'12px', marginTop:'4px' }}>{err}</p>}
    </div>
  )

  return (
    <div style={{ minHeight:'100dvh', background:'#F7F8FA', paddingBottom:'32px', fontFamily:'var(--font-body)' }}>
      <style>{`@keyframes rpl{to{transform:scale(4);opacity:0}} .rpl{position:relative;overflow:hidden;}`}</style>

      <header style={{ background:'white', borderBottom:'1px solid #E4E6EA', position:'sticky', top:0, zIndex:30, boxShadow:'0 1px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth:'520px', margin:'0 auto', padding:'14px 16px', display:'flex', alignItems:'center', gap:'12px' }}>
          <button onClick={() => step === 'direccion' ? router.back() : setStep(step === 'confirmar' ? 'pago' : 'direccion')} className="rpl"
            style={{ width:'38px', height:'38px', borderRadius:'50%', background:'#F3F4F6', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', color:'#6B7280', position:'relative' }}>‹</button>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <img src={brandLogo} style={{ width:'28px', height:'28px', borderRadius:'8px', objectFit:'cover' }} alt="" />
            <h1 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'18px', margin:0 }}>Checkout</h1>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'4px' }}>
            {[1,2,3].map((n,i) => (
              <div key={n} style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                <div style={{ width:'28px', height:'28px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:800, background: stepNum >= i+1 ? brandColor : '#F3F4F6', color: stepNum >= i+1 ? 'white' : '#9CA3AF' }}>
                  {stepNum > i+1 ? '✓' : n}
                </div>
                {i < 2 && <div style={{ width:'20px', height:'2px', borderRadius:'2px', background: stepNum > i+1 ? brandColor : '#E4E6EA' }} />}
              </div>
            ))}
          </div>
        </div>
      </header>

      <main style={{ maxWidth:'520px', margin:'0 auto', padding:'16px', display:'flex', flexDirection:'column', gap:'12px' }}>

        {step === 'direccion' && (
          <>
            <div style={{ background:'white', borderRadius:'20px', border:'1px solid #E4E6EA', padding:'20px' }}>
              <h2 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'17px', margin:'0 0 16px' }}>📍 Dirección de entrega</h2>
              {deliveryZone ? (
                <MapPicker brandColor={brandColor} zonaPoligono={deliveryZone.poligono}
                  precioEnvio={deliveryZone.precio_envio} envioGratisUmbral={deliveryZone.envio_gratis_umbral} subtotal={subtotal}
                  onLocationSelected={(lat, lng, address) => {
                    setDeliveryLat(lat); setDeliveryLng(lng); setDireccion(address)
                    const poly = deliveryZone.poligono || []
                    if (poly.length >= 3) {
                      let inside = false
                      for (let i = 0, j = poly.length-1; i < poly.length; j = i++) {
                        const xi = poly[i].lng, yi = poly[i].lat, xj = poly[j].lng, yj = poly[j].lat
                        if (((yi > lat) !== (yj > lat)) && (lng < (xj-xi)*(lat-yi)/(yj-yi)+xi)) inside = !inside
                      }
                      setInDeliveryZone(inside)
                    } else setInDeliveryZone(true)
                  }} />
              ) : (
                <textarea placeholder="Ej: Piantini, Calle Wenceslao Alvarez #32" value={direccion}
                  onChange={e => setDireccion(e.target.value)} rows={3}
                  style={{ width:'100%', border:'2px solid #E4E6EA', borderRadius:'12px', padding:'12px 14px', fontSize:'14px', outline:'none', resize:'none', fontFamily:'var(--font-body)', boxSizing:'border-box' as any }} />
              )}
            </div>
            <div style={{ background:'white', borderRadius:'16px', border:'1px solid #E4E6EA', padding:'16px' }}>
              <label style={{ fontSize:'13px', fontWeight:700, color:'#6B7280', display:'block', marginBottom:'8px' }}>📝 Instrucciones especiales (opcional)</label>
              <textarea placeholder="Sin picante, timbrar al llegar..." value={notasCliente}
                onChange={e => setNotasCliente(e.target.value)} rows={2}
                style={{ width:'100%', border:'2px solid #E4E6EA', borderRadius:'12px', padding:'12px 14px', fontSize:'14px', outline:'none', resize:'none', fontFamily:'var(--font-body)', boxSizing:'border-box' as any }} />
            </div>
            {error && <p style={{ color:'#EF4444', fontSize:'13px', fontWeight:600 }}>{error}</p>}
            <button onClick={() => {
              if (!deliveryLat && direccion.trim().length < 10) { setError('Coloca tu ubicación en el mapa'); return }
              if (inDeliveryZone === false) { setError('Lo sentimos, no llegamos a tu zona'); return }
              setError(''); setStep('pago')
            }} className="rpl"
              style={{ width:'100%', padding:'18px', borderRadius:'16px', border:'none', background:brandColor, color:'white', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'16px', cursor:'pointer', boxShadow:`0 4px 16px ${brandColor}40`, position:'relative' }}>
              Continuar →
            </button>
          </>
        )}

        {step === 'pago' && (
          <>
            <div style={{ background:'white', borderRadius:'20px', border:'1px solid #E4E6EA', padding:'20px' }}>
              <h2 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'17px', margin:'0 0 16px' }}>💳 Método de pago</h2>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                {metodosActivos.tarjeta && (
                  <button onClick={(e) => { ripple(e, `${brandColor}20`); setMetodoPago('TARJETA') }} className="rpl"
                    style={{ padding:'16px', borderRadius:'16px', border:`2px solid ${metodoPago==='TARJETA'?brandColor:'#E4E6EA'}`, background:metodoPago==='TARJETA'?`${brandColor}08`:'white', cursor:'pointer', fontFamily:'var(--font-body)', fontWeight:700, fontSize:'14px', color:metodoPago==='TARJETA'?brandColor:'#6B7280', transition:'all 0.2s', position:'relative' }}>
                    💳 Tarjeta
                  </button>
                )}
                {metodosActivos.transferencia && (
                  <button onClick={(e) => { ripple(e, `${brandColor}20`); setMetodoPago('TRANSFERENCIA') }} className="rpl"
                    style={{ padding:'16px', borderRadius:'16px', border:`2px solid ${metodoPago==='TRANSFERENCIA'?brandColor:'#E4E6EA'}`, background:metodoPago==='TRANSFERENCIA'?`${brandColor}08`:'white', cursor:'pointer', fontFamily:'var(--font-body)', fontWeight:700, fontSize:'14px', color:metodoPago==='TRANSFERENCIA'?brandColor:'#6B7280', transition:'all 0.2s', position:'relative' }}>
                    🏦 Transferencia
                  </button>
                )}
              </div>
            </div>

            {metodoPago === 'TARJETA' && false && (
              <div style={{ background:'white', borderRadius:'16px', border:'1px solid #E4E6EA', padding:'20px', display:'flex', flexDirection:'column', gap:'12px' }}>
                {fld('Nombre en tarjeta','Juan Pérez',cardNombre,setCardNombre,cardErrors.nombre)}
                {fld('Número de tarjeta','0000 0000 0000 0000',cardNumero,(v)=>setCardNumero(formatCardNumber(v)),cardErrors.numero)}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                  {fld('Vencimiento','MM/AA',cardExpiry,(v)=>setCardExpiry(formatCardExpiry(v)),cardErrors.expiry)}
                  {fld('CVV','000',cardCVV,(v)=>setCardCVV(v.replace(/\D/g,'').slice(0,4)),cardErrors.cvv)}
                </div>
              </div>
            )}

            {metodoPago === 'TRANSFERENCIA' && (
              <div style={{ background:'white', borderRadius:'16px', border:'1px solid #E4E6EA', padding:'20px', display:'flex', flexDirection:'column', gap:'16px' }}>
                <BankSelector marca={marca} totalAPagar={total} brandColor={brandColor}
                  onBankSelected={(bank) => setSelectedBank(bank)} selectedBankId={selectedBank?.id} />
                <div>
                  <label style={{ fontSize:'13px', fontWeight:700, color:'#374151', display:'block', marginBottom:'8px' }}>📸 Foto del comprobante *</label>
                  <button onClick={() => fileRef.current?.click()}
                    style={{ width:'100%', border:`2px dashed ${comprobantePreview?brandColor:'#E4E6EA'}`, borderRadius:'16px', padding:'20px', textAlign:'center', cursor:'pointer', background:comprobantePreview?`${brandColor}05`:'white' }}>
                    {comprobantePreview
                      ? <img src={comprobantePreview} alt="" style={{ maxHeight:'120px', borderRadius:'12px', objectFit:'contain', margin:'0 auto', display:'block' }} />
                      : <div style={{ color:'#9CA3AF', fontSize:'14px' }}>📷 Toca para subir foto del comprobante</div>
                    }
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display:'none' }} />
                </div>
              </div>
            )}

            <div style={{ background:'white', borderRadius:'16px', border:'1px solid #E4E6EA', padding:'16px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
                <div style={{ width:'42px', height:'42px', borderRadius:'12px', background:'#EDE9FE', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px' }}>🎟</div>
                <div>
                  <p style={{ fontWeight:800, fontSize:'14px', margin:'0 0 2px' }}>Usar cupón de descuento</p>
                  <p style={{ fontSize:'12px', color:'#9CA3AF', margin:0 }}>Código de referido o influencer</p>
                </div>
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <input placeholder="Ingresa tu código..." value={promoCode}
                  onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoResult(null) }}
                  style={{ flex:1, border:`2px solid ${promoResult?.valid?'#10B981':promoResult?.valid===false?'#EF4444':'#E4E6EA'}`, borderRadius:'12px', padding:'12px 14px', fontSize:'14px', outline:'none', fontFamily:'monospace', boxSizing:'border-box' as any }} />
                <button onClick={(e) => { ripple(e); checkPromoCode() }} disabled={checkingPromo || !promoCode.trim()} className="rpl"
                  style={{ padding:'12px 18px', borderRadius:'12px', border:'none', background:brandColor, color:'white', fontWeight:700, fontSize:'13px', cursor:'pointer', opacity:checkingPromo||!promoCode.trim()?0.5:1, position:'relative', flexShrink:0 }}>
                  {checkingPromo ? '...' : 'Aplicar'}
                </button>
              </div>
              {promoResult && (
                <div style={{ marginTop:'10px', padding:'10px 14px', borderRadius:'10px', fontSize:'13px', fontWeight:700, background:promoResult.valid?'#DCFCE7':'#FEE2E2', color:promoResult.valid?'#15803D':'#DC2626' }}>
                  {promoResult.valid ? `✓ ${promoResult.label}` : `✕ ${promoResult.reason}`}
                </div>
              )}
            </div>

            {hasGift && (
              <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:'16px', padding:'14px 16px', display:'flex', alignItems:'center', gap:'12px' }}>
                <span style={{ fontSize:'26px' }}>🎁</span>
                <div>
                  <p style={{ fontWeight:800, fontSize:'14px', color:'#92400E', margin:'0 0 2px' }}>{giftNombre} gratis activado</p>
                  <p style={{ fontSize:'12px', color:'#B45309', margin:0 }}>Se agrega automáticamente a tu primer pedido</p>
                </div>
              </div>
            )}

            {error && <p style={{ color:'#EF4444', fontSize:'13px', fontWeight:600 }}>{error}</p>}
            <button onClick={() => {
              if (!metodoPago) { setError('Selecciona un método de pago'); return }
              if (metodoPago === 'TRANSFERENCIA' && !selectedBank) { setError('Selecciona un banco'); return }
              if (metodoPago === 'TRANSFERENCIA' && !comprobante) { setError('Sube el comprobante'); return }

              setError(''); setStep('confirmar')
            }} className="rpl"
              style={{ width:'100%', padding:'18px', borderRadius:'16px', border:'none', background:brandColor, color:'white', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'16px', cursor:'pointer', boxShadow:`0 4px 16px ${brandColor}40`, position:'relative' }}>
              Ver resumen →
            </button>
          </>
        )}

        {step === 'confirmar' && (
          <>
            <div style={{ background:'white', borderRadius:'20px', border:'1px solid #E4E6EA', padding:'20px' }}>
              <h2 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'17px', margin:'0 0 16px' }}>✅ Resumen del pedido</h2>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'14px' }}>
                {items.map(i => (
                  <div key={i.product.id} style={{ display:'flex', justifyContent:'space-between', fontSize:'14px', color:'#374151' }}>
                    <span>{i.cantidad}× {i.product.nombre}</span>
                    <span style={{ fontWeight:600 }}>{formatRD((i.product.precio+(i.totalExtras||0))*i.cantidad)}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderTop:'1.5px solid #F3F4F6', paddingTop:'12px', display:'flex', flexDirection:'column', gap:'7px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'14px', color:'#6B7280' }}><span>Subtotal</span><span>{formatRD(subtotal)}</span></div>
                {loyaltyAplicado > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:'14px', fontWeight:700, color:'#7C3AED' }}><span>💰 Puntos Lovers</span><span>−{formatRD(loyaltyAplicado)}</span></div>}
                {promoDiscount > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:'14px', fontWeight:700, color:'#3B82F6' }}><span>🎟 {promoResult?.code}</span><span>−{formatRD(promoDiscount)}</span></div>}
                {hasGift && <div style={{ display:'flex', justifyContent:'space-between', fontSize:'14px', fontWeight:700, color:'#F59E0B' }}><span>🎁 {giftNombre}</span><span>GRATIS</span></div>}
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'14px', color:'#6B7280' }}>
                  <span>Envío</span>
                  <span style={{ color:envio===0?'#10B981':'#6B7280', fontWeight:envio===0?700:400 }}>{envio===0?'GRATIS 🎉':formatRD(envio)}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'20px', paddingTop:'10px', borderTop:'1.5px solid #F3F4F6' }}>
                  <span>Total</span><span style={{ color:brandColor }}>{formatRD(total)}</span>
                </div>
              </div>
            </div>
            <div style={{ background:'#F7F8FA', borderRadius:'16px', padding:'14px 16px', display:'flex', flexDirection:'column', gap:'6px' }}>
              {direccion && <div style={{ fontSize:'13px', color:'#6B7280', display:'flex', gap:'8px' }}><span>📍</span><span>{direccion}</span></div>}
              <div style={{ fontSize:'13px', color:'#6B7280' }}>💳 {metodoPago === 'TARJETA' ? 'Tarjeta' : 'Transferencia bancaria'}</div>
              {notasCliente && <div style={{ fontSize:'13px', color:'#6B7280' }}>📝 {notasCliente}</div>}
            </div>
            {error && <div style={{ background:'#FEE2E2', border:'1px solid #FECACA', borderRadius:'12px', padding:'12px 14px', fontSize:'13px', color:'#DC2626', fontWeight:600 }}>{error}</div>}
            <button onClick={submitOrder} disabled={submitting} className="rpl"
              style={{ width:'100%', padding:'20px', borderRadius:'20px', border:'none', background:submitting?'#E4E6EA':`linear-gradient(135deg, ${brandColor}, ${brandColor}CC)`, color:submitting?'#9CA3AF':'white', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'17px', cursor:submitting?'not-allowed':'pointer', boxShadow:submitting?'none':`0 8px 32px ${brandColor}45`, position:'relative' }}>
              {submitting ? '⏳ Procesando...' : `🎉 Confirmar pedido — ${formatRD(total)}`}
            </button>
            <p style={{ textAlign:'center', fontSize:'12px', color:'#9CA3AF' }}>
              {metodoPago === 'TARJETA' ? '🔒 Pago seguro y encriptado' : '⏳ Tu pedido se activa al verificar la transferencia'}
            </p>
          </>
        )}
      </main>
    </div>
  )
}
