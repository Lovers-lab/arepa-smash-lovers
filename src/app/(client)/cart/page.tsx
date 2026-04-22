'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CartItem, Marca } from '@/types'

function formatRD(n: number) {
  return `RD$${n.toLocaleString('es-DO')}`
}

const ENVIO_COSTO = 50
const ENVIO_GRATIS_UMBRAL = 1000

export default function CartPage() {
  const router = useRouter()
  const [marca, setMarca] = useState<Marca>('AREPA')
  const [items, setItems] = useState<CartItem[]>([])
  const [loyaltySaldo, setLoyaltySaldo] = useState(0)
  const [usarLoyalty, setUsarLoyalty] = useState(false)
  const [loyaltyAplicado, setLoyaltyAplicado] = useState(0)
  const [has2x1, setHas2x1] = useState(false)
  const [descuento2x1, setDescuento2x1] = useState(0)
  const [brandColors, setBrandColors] = useState({ primary: '#C41E3A' })

  useEffect(() => {
    const storedMarca = localStorage.getItem('lovers_marca') as Marca || 'AREPA'
    const storedCart = localStorage.getItem('lovers_cart')
    const storedUser = localStorage.getItem('lovers_user')

    if (!storedUser) { router.replace('/auth/login'); return }
    if (!storedCart) { router.replace('/menu'); return }

    const cart = JSON.parse(storedCart)
    setMarca(storedMarca)
    setItems(cart.items || [])
    setBrandColors(storedMarca === 'AREPA'
      ? { primary: '#C41E3A' } : { primary: '#0052CC' })

    // Check 2x1 offer
    checkWelcomeOffer(JSON.parse(storedUser).id)
    loadLoyalty(JSON.parse(storedUser).id)
  }, [])

  async function checkWelcomeOffer(userId: string) {
    const res = await fetch(`/api/welcome-offers/check?userId=${userId}`)
    const data = await res.json()
    if (data.hasOffer) {
      setHas2x1(true)
      // Calculate 2x1 discount: cheapest of 2 main dishes
      // (simplified — full logic in checkout API)
    }
  }

  async function loadLoyalty(userId: string) {
    const res = await fetch(`/api/loyalty/balance?userId=${userId}`)
    const data = await res.json()
    setLoyaltySaldo(data.saldo || 0)
  }

  function updateQty(productId: string, delta: number) {
    setItems(prev => {
      const updated = prev
        .map(i => i.product.id === productId ? { ...i, cantidad: i.cantidad + delta } : i)
        .filter(i => i.cantidad > 0)
      localStorage.setItem('lovers_cart', JSON.stringify({ marca, items: updated }))
      return updated
    })
  }

  const subtotal = items.reduce((acc, i) => acc + i.product.precio * i.cantidad, 0)
  const totalPost2x1 = subtotal - descuento2x1
  const totalPostLoyalty = totalPost2x1 - (usarLoyalty ? loyaltyAplicado : 0)
  const envio = totalPostLoyalty >= ENVIO_GRATIS_UMBRAL ? 0 : ENVIO_COSTO
  const total = totalPostLoyalty + envio

  function handleUsarLoyalty(checked: boolean) {
    setUsarLoyalty(checked)
    if (checked) {
      // Apply max loyalty = min(saldo, totalPost2x1)
      setLoyaltyAplicado(Math.min(loyaltySaldo, totalPost2x1))
    } else {
      setLoyaltyAplicado(0)
    }
  }

  if (!items.length) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6">
        <span className="text-6xl">🛒</span>
        <p className="text-gray-500 font-medium">Tu carrito está vacío</p>
        <button onClick={() => router.push('/menu')} className="px-6 py-3 rounded-xl font-bold text-white" style={{ background: brandColors.primary }}>
          Ver menú
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gray-50 pb-40">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900 transition-colors text-xl">←</button>
          <h1 className="font-black text-lg" style={{ fontFamily: 'Syne, serif' }}>Tu carrito</h1>
          <span className="ml-auto text-sm text-gray-400">{marca === 'AREPA' ? '🫓 Arepa Lovers' : '🍔 Smash Lovers'}</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* Items */}
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
          {items.map(item => (
            <div key={item.product.id} className="p-4 flex items-center gap-3">
              {item.product.foto_url && (
                <img src={item.product.foto_url} alt={item.product.nombre} className="w-14 h-14 rounded-xl object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900 truncate">{item.product.nombre}</p>
                <p className="text-sm font-bold" style={{ color: brandColors.primary }}>{formatRD(item.product.precio)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => updateQty(item.product.id, -1)} className="w-7 h-7 rounded-full border-2 flex items-center justify-center font-bold text-sm" style={{ borderColor: brandColors.primary, color: brandColors.primary }}>−</button>
                <span className="font-bold text-sm w-4 text-center">{item.cantidad}</span>
                <button onClick={() => updateQty(item.product.id, 1)} className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm text-white" style={{ background: brandColors.primary }}>+</button>
              </div>
            </div>
          ))}
        </div>

        {/* 2x1 Welcome Offer */}
        {has2x1 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-2xl">🎁</span>
            <div>
              <p className="font-bold text-yellow-800 text-sm">¡Tienes un 2x1 de bienvenida!</p>
              <p className="text-yellow-700 text-xs mt-0.5">Elige 2 platos fuertes y paga solo 1. El descuento se aplica automáticamente en el checkout.</p>
            </div>
          </div>
        )}

        {/* Loyalty Cash */}
        {loyaltySaldo > 0 && !has2x1 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">💰</span>
                <div>
                  <p className="font-semibold text-sm text-gray-900">Loyalty Cash</p>
                  <p className="text-xs text-gray-500">{formatRD(loyaltySaldo)} disponibles</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={usarLoyalty} onChange={e => handleUsarLoyalty(e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-green-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
              </label>
            </div>
            {usarLoyalty && (
              <p className="text-green-600 text-sm font-semibold mt-2">
                −{formatRD(loyaltyAplicado)} aplicado ✓
              </p>
            )}
          </div>
        )}

        {/* Summary */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>{formatRD(subtotal)}</span>
          </div>
          {descuento2x1 > 0 && (
            <div className="flex justify-between text-sm text-yellow-600 font-semibold">
              <span>Descuento 2x1</span>
              <span>−{formatRD(descuento2x1)}</span>
            </div>
          )}
          {usarLoyalty && loyaltyAplicado > 0 && (
            <div className="flex justify-between text-sm text-green-600 font-semibold">
              <span>Loyalty Cash</span>
              <span>−{formatRD(loyaltyAplicado)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-gray-600">
            <span>Envío</span>
            <span className={envio === 0 ? 'text-green-600 font-semibold' : ''}>
              {envio === 0 ? 'GRATIS 🎉' : formatRD(envio)}
            </span>
          </div>
          {envio > 0 && totalPostLoyalty < ENVIO_GRATIS_UMBRAL && (
            <p className="text-xs text-gray-400">Agrega {formatRD(ENVIO_GRATIS_UMBRAL - totalPostLoyalty)} más para envío gratis</p>
          )}
          <div className="border-t border-gray-100 pt-2 flex justify-between font-black text-base">
            <span>Total</span>
            <span style={{ color: brandColors.primary }}>{formatRD(total)}</span>
          </div>
        </div>
      </main>

      {/* Checkout button */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-4">
        <button
          onClick={() => router.push('/checkout')}
          className="w-full py-4 rounded-2xl text-white font-black text-base shadow-2xl transition-transform hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: `linear-gradient(135deg, ${brandColors.primary}, ${brandColors.primary}CC)` }}
        >
          Ir al checkout → {formatRD(total)}
        </button>
      </div>
    </div>
  )
}
