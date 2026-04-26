'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export default function ReviewPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const searchParams = useSearchParams()
  const token = searchParams.get('t')

  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stars, setStars] = useState(0)
  const [hoveredStar, setHoveredStar] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [alreadyReviewed, setAlreadyReviewed] = useState(false)

  useEffect(() => { loadOrder() }, [orderId])

  async function loadOrder() {
    const { data: orderData } = await supabase
      .from('orders')
      .select('*, user:users(nombre, whatsapp)')
      .eq('id', orderId)
      .single()

    if (!orderData || orderData.estado !== 'ENTREGADO') {
      setError('Este link no es válido o el pedido no ha sido entregado.')
      setLoading(false)
      return
    }

    // Verificar token
    if (token !== btoa(orderId).slice(0, 16)) {
      setError('Link inválido.')
      setLoading(false)
      return
    }

    // Verificar si ya tiene reseña
    const { data: existing } = await supabase.from('reviews').select('id').eq('order_id', orderId).single()
    if (existing) { setAlreadyReviewed(true) }

    setOrder(orderData)
    setLoading(false)
  }

  async function submitReview() {
    if (!stars) return
    setSubmitting(true)
    try {
      const { error: err } = await supabase.from('reviews').insert({
        order_id: orderId,
        user_id: order.user_id,
        estrellas: stars,
        comentario: comment.trim() || null,
        marca: order.marca,
        nombre_cliente: order.user?.nombre,
        visible: true,
      })
      if (err) throw err
      setDone(true)
    } catch {
      setError('Error al enviar. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  const color = order?.marca === 'SMASH' ? '#0052CC' : '#C41E3A'
  const logo = order?.marca === 'SMASH' ? '/logos/logo-smash.png' : '/logos/logo-arepa.png'
  const nombre = order?.marca === 'SMASH' ? 'Smash Lovers' : 'Arepa Lovers'

  if (loading) return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F7F8FA', fontFamily:'var(--font-body)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:'40px', marginBottom:'12px' }}>⭐</div>
        <p style={{ color:'#9CA3AF' }}>Cargando...</p>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F7F8FA', fontFamily:'var(--font-body)', padding:'24px' }}>
      <div style={{ textAlign:'center', maxWidth:'320px' }}>
        <div style={{ fontSize:'48px', marginBottom:'16px' }}>😕</div>
        <p style={{ fontWeight:700, fontSize:'16px', color:'#374151', marginBottom:'8px' }}>Link inválido</p>
        <p style={{ fontSize:'14px', color:'#9CA3AF' }}>{error}</p>
      </div>
    </div>
  )

  if (done) return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F7F8FA', fontFamily:'var(--font-body)', padding:'24px' }}>
      <div style={{ textAlign:'center', maxWidth:'320px' }}>
        <div style={{ fontSize:'64px', marginBottom:'16px' }}>🙏</div>
        <h2 style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'24px', color:'#0D0F12', marginBottom:'8px' }}>¡Gracias, {order?.user?.nombre}!</h2>
        <p style={{ fontSize:'14px', color:'#6B7280', lineHeight:1.6 }}>Tu opinión nos ayuda a mejorar y a que más personas conozcan {nombre}.</p>
        <div style={{ marginTop:'24px', padding:'16px', background:`${color}10`, borderRadius:'16px', border:`1px solid ${color}20` }}>
          <p style={{ fontSize:'13px', color, fontWeight:600, margin:0 }}>⭐ {'★'.repeat(stars)}{'☆'.repeat(5-stars)}</p>
        </div>
      </div>
    </div>
  )

  if (alreadyReviewed) return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F7F8FA', fontFamily:'var(--font-body)', padding:'24px' }}>
      <div style={{ textAlign:'center', maxWidth:'320px' }}>
        <div style={{ fontSize:'48px', marginBottom:'16px' }}>✅</div>
        <p style={{ fontWeight:700, fontSize:'16px', color:'#374151' }}>Ya enviaste tu reseña</p>
        <p style={{ fontSize:'14px', color:'#9CA3AF' }}>¡Gracias por tu opinión!</p>
      </div>
    </div>
  )

  return (
    <main style={{ minHeight:'100dvh', background:'#F7F8FA', fontFamily:'var(--font-body)', paddingBottom:'48px' }}>
      {/* Header */}
      <div style={{ background:`linear-gradient(135deg, ${color}, ${color}DD)`, padding:'32px 20px 48px' }}>
        <div style={{ maxWidth:'480px', margin:'0 auto', textAlign:'center' }}>
          <img src={logo} style={{ width:'64px', height:'64px', borderRadius:'16px', objectFit:'cover', boxShadow:'0 4px 16px rgba(0,0,0,0.2)', marginBottom:'12px' }} alt={nombre} />
          <h1 style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'22px', color:'white', margin:'0 0 6px' }}>
            ¿Cómo estuvo tu pedido?
          </h1>
          <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'14px', margin:0 }}>
            Hola {order?.user?.nombre} — Pedido #{order?.numero_pedido}
          </p>
        </div>
      </div>

      <div style={{ maxWidth:'480px', margin:'-32px auto 0', padding:'0 16px' }}>
        <div style={{ background:'white', borderRadius:'20px', padding:'28px', boxShadow:'0 4px 24px rgba(0,0,0,0.08)', position:'relative', zIndex:2 }}>

          {/* Estrellas */}
          <p style={{ textAlign:'center', fontWeight:700, fontSize:'15px', color:'#374151', marginBottom:'20px' }}>
            Toca para calificar
          </p>
          <div style={{ display:'flex', justifyContent:'center', gap:'12px', marginBottom:'24px' }}>
            {[1,2,3,4,5].map(n => (
              <button key={n}
                onMouseEnter={() => setHoveredStar(n)}
                onMouseLeave={() => setHoveredStar(0)}
                onClick={() => setStars(n)}
                style={{ fontSize:'44px', background:'none', border:'none', cursor:'pointer', transition:'transform 0.1s', transform: (hoveredStar || stars) >= n ? 'scale(1.15)' : 'scale(1)', filter: (hoveredStar || stars) >= n ? 'none' : 'grayscale(1) opacity(0.25)' }}>
                ⭐
              </button>
            ))}
          </div>

          {stars > 0 && (
            <p style={{ textAlign:'center', fontSize:'14px', fontWeight:600, color, marginBottom:'20px' }}>
              {stars === 1 ? 'Muy malo 😞' : stars === 2 ? 'Malo 😐' : stars === 3 ? 'Regular 🙂' : stars === 4 ? 'Bueno 😊' : '¡Excelente! 🤩'}
            </p>
          )}

          {/* Comentario */}
          <div style={{ marginBottom:'20px' }}>
            <label style={{ fontSize:'13px', fontWeight:700, color:'#6B7280', display:'block', marginBottom:'8px' }}>
              Comentario <span style={{ fontWeight:400, color:'#9CA3AF' }}>(opcional)</span>
            </label>
            <textarea
              placeholder="¿Qué te pareció el pedido? Tu opinión nos ayuda a mejorar..."
              value={comment}
              onChange={e => setComment(e.target.value.slice(0, 400))}
              rows={4}
              style={{ width:'100%', border:'2px solid #E4E6EA', borderRadius:'12px', padding:'12px 14px', fontSize:'14px', outline:'none', resize:'none', fontFamily:'var(--font-body)', boxSizing:'border-box', lineHeight:1.6 }}
            />
            <p style={{ fontSize:'11px', color:'#9CA3AF', textAlign:'right', margin:'4px 0 0' }}>{comment.length}/400</p>
          </div>

          {error && <p style={{ color:'#EF4444', fontSize:'13px', marginBottom:'12px' }}>{error}</p>}

          <button onClick={submitReview} disabled={!stars || submitting}
            style={{ width:'100%', padding:'18px', background: !stars ? '#E4E6EA' : `linear-gradient(135deg, ${color}, ${color}CC)`, color: !stars ? '#9CA3AF' : 'white', border:'none', borderRadius:'14px', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'16px', cursor: !stars ? 'not-allowed' : 'pointer', boxShadow: stars ? `0 4px 20px ${color}40` : 'none', transition:'all 0.2s' }}>
            {submitting ? 'Enviando...' : stars ? 'Enviar reseña ✓' : 'Selecciona una calificación'}
          </button>
        </div>
      </div>
    </main>
  )
}
