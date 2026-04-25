'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order, OrderStatus } from '@/types'

const supabase = createClient()

const ESTADOS: { key: OrderStatus; label: string; icon: string; desc: string }[] = [
  { key: 'PAGADO',           label: 'Confirmado',        icon: '✅', desc: 'Pago recibido.' },
  { key: 'EN_COCINA',        label: 'En cocina',          icon: '🍳', desc: 'Preparando tu orden.' },
  { key: 'LISTO',            label: 'Listo',              icon: '✓',  desc: 'Listo para despacho.' },
  { key: 'ENVIO_SOLICITADO', label: 'Repartidor',         icon: '📍', desc: 'Asignando repartidor.' },
  { key: 'EN_CAMINO',        label: 'En camino',          icon: '🛵', desc: '¡Va en camino!' },
  { key: 'ENTREGADO',        label: 'Entregado',          icon: '🎉', desc: '¡Buen provecho!' },
]

function formatRD(n: number) { return `RD$${n.toLocaleString('es-DO')}` }

export default function OrderTrackingPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const isSuccess = searchParams.get('success') === '1'

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [showReview, setShowReview] = useState(false)
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [reviewSent, setReviewSent] = useState(false)

  useEffect(() => {
    loadOrder()
    const channel = supabase.channel(`order_${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        payload => setOrder(prev => prev ? { ...prev, ...payload.new } : null))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  async function loadOrder() {
    const { data } = await supabase.from('orders')
      .select('*, user:users(nombre, whatsapp), items:order_items(*, product:products(nombre, precio))')
      .eq('id', id).single()
    setOrder(data as Order)
    setLoading(false)
    const { data: review } = await supabase.from('reviews').select('id').eq('order_id', id).single()
    if (review) setReviewSent(true)
  }

  async function submitReview() {
    if (!stars) return
    const user = JSON.parse(localStorage.getItem('lovers_user') || '{}')
    await supabase.from('reviews').insert({ order_id: id, user_id: user.id, estrellas: stars, comentario: comment.trim() || null })
    setReviewSent(true); setShowReview(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F8FA', fontFamily: 'var(--font-body)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px', animation: 'bounce 1s infinite' }}>🛵</div>
        <p style={{ color: '#9CA3AF', fontSize: '14px' }}>Cargando tu pedido...</p>
      </div>
    </div>
  )

  if (!order) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', fontFamily: 'var(--font-body)' }}>
      <div>
        <p style={{ fontSize: '48px', marginBottom: '12px' }}>😕</p>
        <p style={{ color: '#6B7280', fontWeight: 600 }}>Pedido no encontrado</p>
      </div>
    </div>
  )

  const brandColor = order.marca === 'AREPA' ? '#C41E3A' : '#0052CC'
  const brandLogo = order.marca === 'AREPA' ? '/logos/logo-arepa.png' : '/logos/logo-smash.png'
  const statusIdx = ESTADOS.findIndex(e => e.key === order.estado)
  const currentStatus = ESTADOS[Math.max(0, statusIdx)]
  const isCancelled = order.estado === 'CANCELADO'
  const isDelivered = order.estado === 'ENTREGADO'
  const isPending = order.estado === 'PENDIENTE'

  return (
    <div style={{ minHeight: '100dvh', background: '#F7F8FA', paddingBottom: '32px', fontFamily: 'var(--font-body)' }}>
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>

      {/* Success banner */}
      {isSuccess && (
        <div style={{ background: brandColor, padding: '14px 20px', textAlign: 'center', color: 'white', fontWeight: 700, fontSize: '14px' }}>
          🎉 ¡Pedido confirmado! Te notificaremos por WhatsApp.
        </div>
      )}

      {/* Header */}
      <header style={{ background: 'white', borderBottom: '1px solid #E4E6EA', boxShadow: '0 1px 8px rgba(0,0,0,0.06)', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: '520px', margin: '0 auto', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => router.back()}
            style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#F3F4F6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: '#6B7280' }}>‹</button>
          <img src={brandLogo} style={{ width: '36px', height: '36px', borderRadius: '10px', objectFit: 'cover' }} alt="" />
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18px', margin: 0 }}>Pedido #{order.numero_pedido}</h1>
            <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>
              {new Date(order.fecha_orden).toLocaleDateString('es-DO', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '999px', background: `${brandColor}15`, color: brandColor }}>
            {order.metodo_pago === 'TARJETA' ? '💳' : '🏦'} {order.metodo_pago === 'TARJETA' ? 'Tarjeta' : 'Transferencia'}
          </span>
        </div>
      </header>

      <main style={{ maxWidth: '520px', margin: '0 auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Botón volver al menú mientras pedido activo */}
        {!isDelivered && !isCancelled && (
          <button onClick={() => router.push('/')}
            style={{ display:'flex', alignItems:'center', gap:'8px', padding:'12px 16px', background:'white', border:'1px solid #E4E6EA', borderRadius:'14px', cursor:'pointer', fontSize:'13px', fontWeight:700, color:'#6B7280', width:'100%' }}>
            <span style={{ fontSize:'16px' }}>🛒</span>
            <span>Seguir comprando mientras esperas</span>
            <span style={{ marginLeft:'auto', fontSize:'16px' }}>›</span>
          </button>
        )}

        {/* Status card */}
        {!isCancelled && !isPending ? (
          <div style={{ background: 'white', borderRadius: '20px', border: '1px solid #E4E6EA', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '56px', marginBottom: '12px', animation: !isDelivered ? 'bounce 2s ease-in-out infinite' : 'none' }}>{currentStatus?.icon}</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 800, color: brandColor, margin: '0 0 8px' }}>{currentStatus?.label}</h2>
              <p style={{ color: '#6B7280', fontSize: '14px', margin: 0 }}>{currentStatus?.desc}</p>
            </div>

            {/* Progress steps */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: '8px' }}>
              {/* Line background */}
              <div style={{ position: 'absolute', top: '27px', left: '5%', right: '5%', height: '3px', background: '#F0F2F5', borderRadius: '2px', zIndex: 0 }} />
              {/* Line progress */}
              <div style={{ position: 'absolute', top: '27px', left: '5%', height: '3px', background: brandColor, borderRadius: '2px', zIndex: 0, transition: 'width 0.6s ease', width: `${Math.max(0, statusIdx / (ESTADOS.length - 1)) * 90}%` }} />

              {ESTADOS.map((estado, idx) => (
                <div key={estado.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1, position: 'relative', zIndex: 1 }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, transition: 'all 0.3s', background: idx <= statusIdx ? brandColor : 'white', color: idx <= statusIdx ? 'white' : '#9CA3AF', border: `2px solid ${idx <= statusIdx ? brandColor : '#E4E6EA'}`, boxShadow: idx === statusIdx ? `0 0 0 4px ${brandColor}20` : 'none' }}>
                    {idx < statusIdx ? '✓' : estado.icon}
                  </div>
                  <span style={{ fontSize: '9px', fontWeight: 600, color: idx <= statusIdx ? brandColor : '#9CA3AF', textAlign: 'center', lineHeight: 1.2, maxWidth: '48px' }}>{estado.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : isPending ? (
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '20px', padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px', animation: 'pulse 1.5s ease-in-out infinite' }}>⏳</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', color: '#92400E', margin: '0 0 8px' }}>Esperando aprobación</h2>
            <p style={{ color: '#B45309', fontSize: '13px', margin: 0 }}>Estamos verificando tu comprobante. Te notificamos por WhatsApp.</p>
          </div>
        ) : (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '20px', padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>❌</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', color: '#DC2626', margin: '0 0 8px' }}>Pedido cancelado</h2>
            <p style={{ color: '#EF4444', fontSize: '13px', margin: 0 }}>Si pagaste con tarjeta, el reembolso se procesará en 3-5 días.</p>
          </div>
        )}

        {/* Order items */}
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E4E6EA', padding: '16px 20px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '16px', margin: '0 0 14px' }}>Tu pedido</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
            {(order.items as any[] || []).map((item: any) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#374151' }}>
                <span>{item.cantidad}× {item.product?.nombre}</span>
                <span style={{ fontWeight: 600 }}>{formatRD(item.subtotal)}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1.5px solid #F3F4F6', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {order.descuento > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#10B981', fontWeight: 700 }}>
                <span>Descuento</span><span>−{formatRD(order.descuento)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#6B7280' }}>
              <span>Envío</span>
              <span style={{ color: order.costo_envio === 0 ? '#10B981' : '#6B7280', fontWeight: order.costo_envio === 0 ? 700 : 400 }}>
                {order.costo_envio === 0 ? 'GRATIS 🎉' : formatRD(order.costo_envio)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18px', paddingTop: '8px', borderTop: '1px solid #F3F4F6' }}>
              <span>Total pagado</span>
              <span style={{ color: brandColor }}>{formatRD(order.total_pagado)}</span>
            </div>
          </div>
        </div>

        {/* Delivery address */}
        {(order as any).direccion_texto && (
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E4E6EA', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '22px' }}>📍</span>
            <div>
              <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 2px', fontWeight: 600 }}>Dirección de entrega</p>
              <p style={{ fontSize: '13px', color: '#374151', margin: 0, fontWeight: 500 }}>{(order as any).direccion_texto}</p>
            </div>
          </div>
        )}

        {/* Review */}
        {isDelivered && !reviewSent && (
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E4E6EA', padding: '20px' }}>
            {!showReview ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 700, fontSize: '15px', marginBottom: '12px', color: '#374151' }}>¿Cómo estuvo tu experiencia?</p>
                <button onClick={() => setShowReview(true)}
                  style={{ padding: '12px 28px', borderRadius: '999px', border: 'none', background: brandColor, color: 'white', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', cursor: 'pointer', boxShadow: `0 4px 16px ${brandColor}40` }}>
                  ⭐ Calificar pedido
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontWeight: 700, fontSize: '15px', textAlign: 'center', margin: 0 }}>Tu opinión nos importa</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setStars(n)}
                      style={{ fontSize: '32px', background: 'none', border: 'none', cursor: 'pointer', filter: n <= stars ? 'none' : 'grayscale(1) opacity(0.35)', transition: 'all 0.15s' }}>⭐</button>
                  ))}
                </div>
                <textarea placeholder="Comentario opcional..." value={comment} onChange={e => setComment(e.target.value.slice(0, 300))} rows={3}
                  style={{ border: '2px solid #E4E6EA', borderRadius: '12px', padding: '10px 14px', fontSize: '14px', outline: 'none', resize: 'none', fontFamily: 'var(--font-body)' }} />
                <button onClick={submitReview} disabled={!stars}
                  style={{ width: '100%', padding: '14px', borderRadius: '999px', border: 'none', background: !stars ? '#E4E6EA' : brandColor, color: !stars ? '#9CA3AF' : 'white', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', cursor: !stars ? 'not-allowed' : 'pointer' }}>
                  Enviar reseña
                </button>
              </div>
            )}
          </div>
        )}

        {reviewSent && isDelivered && (
          <div style={{ background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: '16px', padding: '16px', textAlign: 'center' }}>
            <p style={{ fontSize: '28px', marginBottom: '4px' }}>🙏</p>
            <p style={{ fontWeight: 700, color: '#15803D', fontSize: '14px', margin: 0 }}>¡Gracias por tu reseña!</p>
          </div>
        )}

        {/* Order again */}
        {(isDelivered || isCancelled) && (
          <button onClick={() => router.push('/menu')}
            style={{ width: '100%', padding: '18px', borderRadius: '20px', border: 'none', background: `linear-gradient(135deg, ${brandColor}, ${brandColor}CC)`, color: 'white', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '16px', cursor: 'pointer', boxShadow: `0 8px 32px ${brandColor}40` }}>
            {isDelivered ? '🛒 Pedir de nuevo' : '🛒 Ver menú'}
          </button>
        )}
      </main>
    </div>
  )
}
