'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order, OrderStatus } from '@/types'

const supabase = createClient()

const ESTADOS: { key: OrderStatus; label: string; icon: string; desc: string }[] = [
  { key: 'PAGADO',         label: 'Confirmado',        icon: '✅', desc: 'Pago recibido. Esperando confirmación.' },
  { key: 'EN_COCINA',      label: 'En cocina',          icon: '🍳', desc: 'Tu orden está siendo preparada.' },
  { key: 'LISTO',          label: 'Listo',              icon: '✓',  desc: 'Tu orden está lista para despacho.' },
  { key: 'ENVIO_SOLICITADO', label: 'Repartidor asignado', icon: '📍', desc: 'Se está asignando un repartidor.' },
  { key: 'EN_CAMINO',      label: 'En camino',          icon: '🛵', desc: '¡Tu pedido está en camino!' },
  { key: 'ENTREGADO',      label: 'Entregado',          icon: '🎉', desc: '¡Pedido entregado! Buen provecho.' },
]

function formatRD(n: number) { return `RD$${n.toLocaleString('es-DO')}` }

export default function OrderTrackingPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const isSuccess = searchParams.get('success') === '1'

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [showReview, setShowReview] = useState(false)
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [reviewSent, setReviewSent] = useState(false)

  useEffect(() => {
    loadOrder()
    const channel = supabase
      .channel(`order_${id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `id=eq.${id}`,
      }, payload => {
        setOrder(prev => prev ? { ...prev, ...payload.new } : null)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  async function loadOrder() {
    const { data } = await supabase
      .from('orders')
      .select('*, user:users(nombre, whatsapp), items:order_items(*, product:products(nombre, precio))')
      .eq('id', id)
      .single()
    setOrder(data as Order)
    setLoading(false)

    // Check if review was already sent
    const { data: review } = await supabase.from('reviews').select('id').eq('order_id', id).single()
    if (review) setReviewSent(true)
  }

  async function submitReview() {
    if (!stars) return
    const user = JSON.parse(localStorage.getItem('lovers_user') || '{}')
    await supabase.from('reviews').insert({
      order_id: id,
      user_id: user.id,
      estrellas: stars,
      comentario: comment.trim() || null,
    })
    setReviewSent(true)
    setShowReview(false)
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="animate-pulse text-center space-y-2">
          <div className="text-4xl">🛵</div>
          <p className="text-gray-400 text-sm">Cargando tu pedido...</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-4xl mb-2">😕</p>
          <p className="text-gray-500">Pedido no encontrado</p>
        </div>
      </div>
    )
  }

  const brandColor = order.marca === 'AREPA' ? '#C41E3A' : '#0052CC'
  const statusIdx = ESTADOS.findIndex(e => e.key === order.estado)
  const currentStatus = ESTADOS[statusIdx]
  const isCancelled = order.estado === 'CANCELADO'
  const isDelivered = order.estado === 'ENTREGADO'

  return (
    <div className="min-h-dvh bg-gray-50 pb-10">
      {/* Success banner */}
      {isSuccess && (
        <div className="sticky top-0 z-20 py-3 px-4 text-center text-white font-bold text-sm animate-fade-in"
          style={{ background: brandColor }}>
          🎉 ¡Pedido confirmado! Te notificaremos por WhatsApp.
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <span className="text-2xl">{order.marca === 'AREPA' ? '🫓' : '🍔'}</span>
          <div>
            <h1 className="font-black text-lg" style={{ fontFamily: 'Syne, serif' }}>Pedido #{order.numero_pedido}</h1>
            <p className="text-xs text-gray-400">{new Date(order.fecha_orden).toLocaleDateString('es-DO', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <div className="ml-auto">
            <span className="text-xs font-bold px-3 py-1.5 rounded-full text-white" style={{ background: brandColor }}>
              {order.metodo_pago === 'TARJETA' ? '💳 Tarjeta' : '🏦 Transferencia'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">

        {/* Status tracker */}
        {!isCancelled ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="text-center mb-6">
              <div className="text-5xl mb-2">{currentStatus?.icon}</div>
              <h2 className="font-black text-xl" style={{ color: brandColor, fontFamily: 'Syne, serif' }}>
                {currentStatus?.label}
              </h2>
              <p className="text-gray-500 text-sm mt-1">{currentStatus?.desc}</p>
            </div>

            {/* Progress bar */}
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                {ESTADOS.map((estado, idx) => (
                  <div key={estado.key} className="flex flex-col items-center gap-1 flex-1">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                      style={idx <= statusIdx
                        ? { background: brandColor, color: '#fff' }
                        : { background: '#F3F4F6', color: '#9CA3AF' }}>
                      {idx < statusIdx ? '✓' : estado.icon}
                    </div>
                    <span className="text-xs text-center text-gray-400 hidden sm:block leading-tight">{estado.label}</span>
                  </div>
                ))}
              </div>
              {/* Connector line */}
              <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-100 -z-10" />
              <div className="absolute top-4 left-4 h-0.5 -z-10 transition-all duration-700"
                style={{ background: brandColor, width: `${Math.max(0, statusIdx / (ESTADOS.length - 1)) * 100}%` }} />
            </div>
          </div>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
            <p className="text-4xl mb-2">❌</p>
            <h2 className="font-black text-xl text-red-700">Pedido cancelado</h2>
            <p className="text-red-500 text-sm mt-1">Si pagaste con tarjeta, el reembolso se procesará en 3-5 días.</p>
          </div>
        )}

        {/* PENDIENTE: waiting for transfer approval */}
        {order.estado === 'PENDIENTE' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex gap-3">
            <span className="text-2xl">⏳</span>
            <div>
              <p className="font-bold text-yellow-800 text-sm">Esperando aprobación</p>
              <p className="text-yellow-700 text-xs mt-0.5">Estamos verificando tu comprobante. Te notificamos por WhatsApp cuando esté confirmado.</p>
            </div>
          </div>
        )}

        {/* Order items */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="font-black text-sm mb-3" style={{ fontFamily: 'Syne, serif' }}>Tu pedido</h3>
          <div className="space-y-2">
            {(order.items as any[] || []).map((item: any) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-700">{item.cantidad}x {item.product?.nombre}</span>
                <span className="font-semibold">{formatRD(item.subtotal)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 mt-3 pt-3 space-y-1">
            {order.descuento > 0 && (
              <div className="flex justify-between text-sm text-green-600 font-semibold">
                <span>Descuento</span><span>−{formatRD(order.descuento)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-gray-500">
              <span>Envío</span>
              <span>{order.costo_envio === 0 ? 'GRATIS' : formatRD(order.costo_envio)}</span>
            </div>
            <div className="flex justify-between font-black text-base pt-1">
              <span>Total pagado</span>
              <span style={{ color: brandColor }}>{formatRD(order.total_pagado)}</span>
            </div>
          </div>
        </div>

        {/* Review section — show after delivered */}
        {isDelivered && !reviewSent && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            {!showReview ? (
              <div className="text-center space-y-2">
                <p className="font-bold text-sm text-gray-700">¿Cómo estuvo tu experiencia?</p>
                <button onClick={() => setShowReview(true)}
                  className="px-6 py-3 rounded-xl text-white font-bold text-sm"
                  style={{ background: brandColor }}>⭐ Calificar pedido</button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="font-bold text-sm text-center">Tu opinión nos importa</p>
                <div className="flex justify-center gap-2">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setStars(n)}
                      className="text-3xl transition-transform hover:scale-125"
                      style={{ filter: n <= stars ? 'none' : 'grayscale(1) opacity(0.4)' }}>⭐</button>
                  ))}
                </div>
                <textarea
                  placeholder="Comentario opcional (máx. 300 caracteres)"
                  value={comment}
                  onChange={e => setComment(e.target.value.slice(0, 300))}
                  rows={3}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none outline-none focus:border-gray-900 transition-colors"
                />
                <button onClick={submitReview} disabled={!stars}
                  className="w-full py-3 rounded-xl text-white font-bold disabled:opacity-40"
                  style={{ background: brandColor }}>
                  Enviar reseña
                </button>
              </div>
            )}
          </div>
        )}

        {reviewSent && isDelivered && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
            <p className="text-2xl mb-1">🙏</p>
            <p className="font-bold text-green-700 text-sm">¡Gracias por tu reseña!</p>
          </div>
        )}

        {/* Order again */}
        {(isDelivered || isCancelled) && (
          <a href="/menu"
            className="block w-full py-4 rounded-2xl text-center text-white font-black text-base"
            style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}CC)` }}>
            {isDelivered ? '🛒 Pedir de nuevo' : '🛒 Ver menú'}
          </a>
        )}
      </main>
    </div>
  )
}
