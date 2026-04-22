'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Marca, CartItem } from '@/types'
import { validateCardNumber, validateCardExpiry, formatCardNumber, formatCardExpiry } from '@/lib/utils/validators'
import { formatRD, calculateShipping } from '@/lib/utils/formatters'

type Step = 'direccion' | 'pago' | 'confirmar'
type MetodoPago = 'TARJETA' | 'TRANSFERENCIA'

interface PromoResult {
  valid: boolean
  type?: 'INFLUENCER' | 'REFERRAL'
  code?: string
  discount_pct?: number
  label?: string
  reason?: string
}

export default function CheckoutPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('direccion')
  const [marca, setMarca] = useState<Marca>('AREPA')
  const [user, setUser] = useState<any>(null)
  const [items, setItems] = useState<CartItem[]>([])
  const [brandColor, setBrandColor] = useState('#C41E3A')

  const [direccion, setDireccion] = useState('')
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'ok' | 'fail'>('idle')
  const [notasCliente, setNotasCliente] = useState('')

  const [metodoPago, setMetodoPago] = useState<MetodoPago | null>(null)
  const [bankInfo, setBankInfo] = useState<any>(null)
  const [metodosActivos, setMetodosActivos] = useState({ tarjeta: true, transferencia: true })
  const [comprobante, setComprobante] = useState<File | null>(null)
  const [selectedBank, setSelectedBank] = useState<any>(null)
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null)
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null)
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [inDeliveryZone, setInDeliveryZone] = useState<boolean | null>(null)
  const [deliveryZone, setDeliveryZone] = useState<any>(null)
  const [comprobantePreview, setComprobantePreview] = useState('')

  const [cardNombre, setCardNombre] = useState('')
  const [cardNumero, setCardNumero] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCVV, setCardCVV] = useState('')
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({})

  const [promoCode, setPromoCode] = useState('')
  const [promoResult, setPromoResult] = useState<PromoResult | null>(null)
  const [checkingPromo, setCheckingPromo] = useState(false)
  const [loyaltyAplicado, setLoyaltyAplicado] = useState(0)
  const [has2x1, setHas2x1] = useState(false)
  const [discount2x1, setDiscount2x1] = useState(0)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const storedUser = localStorage.getItem('lovers_user')
    const storedCart = localStorage.getItem('lovers_cart')
    const storedMarca = localStorage.getItem('lovers_marca') as Marca || 'AREPA'
    const storedLoyalty = Number(localStorage.getItem('lovers_checkout_loyalty') || 0)

    if (!storedUser || !storedCart) { router.replace('/menu'); return }

    const u = JSON.parse(storedUser)
    const cart = JSON.parse(storedCart)
    setUser(u)
    setItems(cart.items || [])
    setMarca(storedMarca)
    setBrandColor(storedMarca === 'SMASH' ? '#0052CC' : '#C41E3A')
    setLoyaltyAplicado(storedLoyalty)

    loadSettings(storedMarca)
    checkWelcome(u.id, cart.items || [])
  }, [])

  async function loadSettings(m: Marca) {
    const res = await fetch(`/api/settings/bank?marca=${m}`)
    const data = await res.json()
    if (data.bankInfo) setBankInfo(data.bankInfo)

    // Load delivery zone
    const { data: zoneData } = await supabase.from('delivery_zones').select('*').eq('activo', true).single()
    if (zoneData) setDeliveryZone(zoneData)
    if (data.metodoPagoActivo) setMetodosActivos(data.metodoPagoActivo)
  }

  async function checkWelcome(userId: string, cartItems: CartItem[]) {
    const res = await fetch(`/api/welcome-offers/check?userId=${userId}`)
    const data = await res.json()
    if (data.hasOffer) {
      setHas2x1(true)
      const sorted = [...cartItems].sort((a, b) => b.product.precio - a.product.precio)
      if (sorted.length >= 2) setDiscount2x1(sorted[1].product.precio)
    }
  }

  async function checkPromoCode() {
    if (!promoCode.trim() || !user) return
    setCheckingPromo(true)
    const res = await fetch(`/api/codes/validate?code=${encodeURIComponent(promoCode.trim())}&userId=${user.id}`)
    const data = await res.json()
    setPromoResult(data)
    setCheckingPromo(false)
  }

  function requestGPS() {
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const res = await fetch(`/api/delivery-zones/check?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`)
        const data = await res.json()
        setGpsStatus(data.dentro ? 'ok' : 'fail')
        setGpsLoading(false)
      },
      () => { setGpsStatus('fail'); setGpsLoading(false) },
      { timeout: 10000 }
    )
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setError('La foto debe pesar menos de 2MB'); return }
    setComprobante(file)
    setComprobantePreview(URL.createObjectURL(file))
    setError('')
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

  const subtotal = items.reduce((a, i) => a + i.product.precio * i.cantidad, 0)
  const promoDiscount = promoResult?.valid ? Math.round(subtotal * (promoResult.discount_pct || 0) / 100) : 0
  const totalPostDescuentos = Math.max(0, subtotal - discount2x1 - loyaltyAplicado - promoDiscount)
  const envio = calculateShipping(totalPostDescuentos)
  const total = totalPostDescuentos + envio
  const stepNum = step === 'direccion' ? 1 : step === 'pago' ? 2 : 3

  async function submitOrder() {
    if (metodoPago === 'TARJETA' && !validateCard()) return
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
      formData.append('items', JSON.stringify(items.map(i => ({
        productId: i.product.id, cantidad: i.cantidad, notas: i.notas
      }))))
      if (metodoPago === 'TARJETA') {
        formData.append('cardData', JSON.stringify({ nombre: cardNombre, numero: cardNumero.replace(/\s/g,''), expiry: cardExpiry, cvv: cardCVV }))
      }
      if (comprobante) formData.append('comprobante', comprobante)

      const res = await fetch('/api/orders/create', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error procesando el pedido'); setSubmitting(false); return }

      localStorage.removeItem('lovers_cart')
      localStorage.removeItem('lovers_checkout_loyalty')
      router.push(`/orders/${data.orderId}?success=1`)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-dvh bg-gray-50 pb-32">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => step === 'direccion' ? router.back() : setStep(step === 'confirmar' ? 'pago' : 'direccion')} className="text-gray-500 text-xl">←</button>
          <h1 className="font-black text-lg" style={{ fontFamily:'Syne,serif' }}>Checkout</h1>
          <div className="ml-auto flex items-center gap-1">
            {[1,2,3].map((n,i) => (
              <div key={n} className="flex items-center gap-1">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={stepNum >= i+1 ? { background: brandColor, color:'#fff' } : { background:'#E5E7EB', color:'#9CA3AF' }}>
                  {stepNum > i+1 ? '✓' : n}
                </div>
                {i < 2 && <div className="w-6 h-0.5" style={{ background: stepNum > i+1 ? brandColor : '#E5E7EB' }} />}
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">

        {step === 'direccion' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
              <h2 className="font-black text-base" style={{ fontFamily:'Syne,serif' }}>📍 Dirección de entrega</h2>
              <textarea placeholder="Ej: Ensanche La Paz, Calle 5 #32, Apt 3B, frente al parque" value={direccion}
                onChange={e => setDireccion(e.target.value)} rows={3}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-gray-900 transition-colors text-sm resize-none" />
              <button onClick={requestGPS} disabled={gpsLoading}
                className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border-2 transition-colors"
                style={{ borderColor: brandColor, color: brandColor }}>
                {gpsLoading ? '⏳ Verificando...' : '📍 Verificar mi ubicación GPS'}
              </button>
              {gpsStatus === 'fail' && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">⚠️ Fuera de zona. Escribe tu dirección completa y verificamos.</div>}
              {gpsStatus === 'ok' && <p className="text-green-600 text-sm font-semibold">✓ Dentro de zona de entrega</p>}
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
              <label className="text-sm font-semibold text-gray-700">📝 Instrucciones especiales (opcional)</label>
              <textarea placeholder="Sin picante, timbrar al llegar..." value={notasCliente}
                onChange={e => setNotasCliente(e.target.value)} rows={2}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-gray-900 text-sm resize-none transition-colors" />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button onClick={() => { if (direccion.trim().length < 10) { setError('Escribe una dirección más detallada'); return }; setError(''); setStep('pago') }}
              className="w-full py-4 rounded-xl text-white font-bold transition-all" style={{ background: brandColor }}>
              Continuar →
            </button>
          </div>
        )}

        {step === 'pago' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <h2 className="font-black text-base" style={{ fontFamily:'Syne,serif' }}>💳 Método de pago</h2>
              {!metodosActivos.tarjeta && !metodosActivos.transferencia && (
                <p className="text-red-600 text-sm font-semibold">⚠️ No aceptamos pedidos en este momento.</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                {metodosActivos.tarjeta && (
                  <button onClick={() => setMetodoPago('TARJETA')}
                    className="py-4 rounded-xl border-2 font-bold text-sm transition-all"
                    style={metodoPago === 'TARJETA' ? { borderColor: brandColor, background:`${brandColor}15`, color: brandColor } : { borderColor:'#E5E7EB', color:'#6B7280' }}>
                    💳 Tarjeta
                  </button>
                )}
                {metodosActivos.transferencia && (
                  <button onClick={() => setMetodoPago('TRANSFERENCIA')}
                    className="py-4 rounded-xl border-2 font-bold text-sm transition-all"
                    style={metodoPago === 'TRANSFERENCIA' ? { borderColor: brandColor, background:`${brandColor}15`, color: brandColor } : { borderColor:'#E5E7EB', color:'#6B7280' }}>
                    🏦 Transferencia
                  </button>
                )}
              </div>
            </div>

            {metodoPago === 'TARJETA' && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                {[
                  { label:'Nombre en tarjeta', ph:'Juan Pérez', val:cardNombre, set:setCardNombre, err:cardErrors.nombre, fmt:(v:string)=>v },
                  { label:'Número de tarjeta', ph:'0000 0000 0000 0000', val:cardNumero, set:(v:string)=>setCardNumero(formatCardNumber(v)), err:cardErrors.numero, fmt:(v:string)=>v },
                ].map(f => (
                  <div key={f.label} className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">{f.label}</label>
                    <input placeholder={f.ph} value={f.val} onChange={e => f.set(e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors" />
                    {f.err && <p className="text-red-500 text-xs">{f.err}</p>}
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Vencimiento</label>
                    <input placeholder="MM/AA" value={cardExpiry} onChange={e => setCardExpiry(formatCardExpiry(e.target.value))} maxLength={5} inputMode="numeric"
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-gray-900 transition-colors" />
                    {cardErrors.expiry && <p className="text-red-500 text-xs">{cardErrors.expiry}</p>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">CVV</label>
                    <input placeholder="000" value={cardCVV} onChange={e => setCardCVV(e.target.value.replace(/\D/g,'').slice(0,4))} maxLength={4} inputMode="numeric"
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-gray-900 transition-colors" />
                    {cardErrors.cvv && <p className="text-red-500 text-xs">{cardErrors.cvv}</p>}
                  </div>
                </div>
              </div>
            )}

            {metodoPago === 'TRANSFERENCIA' && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
                <BankSelector
                  marca={marca}
                  totalAPagar={total}
                  brandColor={brandColor}
                  onBankSelected={(bank) => setSelectedBank(bank)}
                  selectedBankId={selectedBank?.id}
                />
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">📸 Foto del comprobante *</label>
                  <button onClick={() => fileRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-300 rounded-xl p-6 text-center text-sm text-gray-400 hover:border-gray-400 transition-colors">
                    {comprobantePreview ? <img src={comprobantePreview} alt="" className="mx-auto max-h-40 rounded-xl object-contain" /> : '📷 Toca para subir foto'}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </div>
              </div>
            )}

            {!has2x1 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                <h3 className="font-bold text-sm text-gray-700">🎟 Código promocional</h3>
                <div className="flex gap-2">
                  <input placeholder="Código referido o influencer" value={promoCode}
                    onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoResult(null) }}
                    className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-gray-900 transition-colors" />
                  <button onClick={checkPromoCode} disabled={checkingPromo || !promoCode.trim()}
                    className="px-4 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-40"
                    style={{ background: brandColor }}>
                    {checkingPromo ? '...' : 'Aplicar'}
                  </button>
                </div>
                {promoResult && (
                  <p className={`text-sm font-semibold px-3 py-2 rounded-xl ${promoResult.valid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                    {promoResult.valid ? `✓ ${promoResult.label}` : `✕ ${promoResult.reason}`}
                  </p>
                )}
              </div>
            )}

            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button onClick={() => {
              if (!metodoPago) { setError('Selecciona un método de pago'); return }
              if (!deliveryLat || !deliveryLng) { setError('Coloca tu ubicación en el mapa'); return }
              if (inDeliveryZone === false) { setError('Lo sentimos, no llegamos a tu zona'); return }
              if (metodoPago === 'TRANSFERENCIA' && !selectedBank) { setError('Selecciona un banco'); return }
              if (metodoPago === 'TRANSFERENCIA' && !comprobante) { setError('Sube el comprobante de transferencia'); return }
              if (metodoPago === 'TARJETA' && !validateCard()) return
              setError(''); setStep('confirmar')
            }} disabled={!metodoPago}
              className="w-full py-4 rounded-xl text-white font-bold disabled:opacity-40 transition-all" style={{ background: brandColor }}>
              Ver resumen →
            </button>
          </div>
        )}

        {step === 'confirmar' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <h2 className="font-black text-base" style={{ fontFamily:'Syne,serif' }}>✅ Resumen</h2>
              <div className="space-y-2">
                {items.map(i => (
                  <div key={i.product.id} className="flex justify-between text-sm">
                    <span className="text-gray-700">{i.cantidad}x {i.product.nombre}</span>
                    <span className="font-semibold">{formatRD(i.product.precio * i.cantidad)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{formatRD(subtotal)}</span></div>
                {discount2x1 > 0 && <div className="flex justify-between text-yellow-600 font-semibold"><span>🎁 2x1 Bienvenida</span><span>−{formatRD(discount2x1)}</span></div>}
                {loyaltyAplicado > 0 && <div className="flex justify-between text-green-600 font-semibold"><span>💰 Loyalty Cash</span><span>−{formatRD(loyaltyAplicado)}</span></div>}
                {promoDiscount > 0 && <div className="flex justify-between text-blue-600 font-semibold"><span>🎟 {promoResult?.code}</span><span>−{formatRD(promoDiscount)}</span></div>}
                <div className="flex justify-between text-gray-500"><span>Envío</span><span className={envio === 0 ? 'text-green-600 font-semibold' : ''}>{envio === 0 ? 'GRATIS 🎉' : formatRD(envio)}</span></div>
                <div className="flex justify-between font-black text-base pt-1 border-t border-gray-100">
                  <span>Total</span><span style={{ color: brandColor }}>{formatRD(total)}</span>
                </div>
              </div>
              <div className="text-xs text-gray-400 border-t border-gray-100 pt-3 space-y-1">
                <p>📍 {direccion}</p>
                <p>💳 {metodoPago === 'TARJETA' ? 'Tarjeta (MIO)' : 'Transferencia bancaria'}</p>
                {notasCliente && <p>📝 {notasCliente}</p>}
              </div>
            </div>
            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}
            <button onClick={submitOrder} disabled={submitting}
              className="w-full py-4 rounded-2xl text-white font-black text-base shadow-xl transition-all disabled:opacity-60 hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}CC)` }}>
              {submitting ? '⏳ Procesando...' : `🎉 Confirmar pedido — ${formatRD(total)}`}
            </button>
            <p className="text-center text-xs text-gray-400">
              {metodoPago === 'TARJETA' ? 'Pago procesado por MIO · Seguro y encriptado' : 'Tu pedido se activa al verificar la transferencia'}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
