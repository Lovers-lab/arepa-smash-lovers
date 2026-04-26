'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [marcaFilter, setMarcaFilter] = useState('TODAS')
  const [starsFilter, setStarsFilter] = useState(0)
  const [respondingId, setRespondingId] = useState<string|null>(null)
  const [respuesta, setRespuesta] = useState('')
  const [sendingCupon, setSendingCupon] = useState<string|null>(null)

  useEffect(() => { loadReviews() }, [marcaFilter, starsFilter])

  async function loadReviews() {
    setLoading(true)
    let query = supabase.from('reviews').select('*, order:orders(numero_pedido)').order('created_at', { ascending: false })
    if (marcaFilter !== 'TODAS') query = query.eq('marca', marcaFilter)
    if (starsFilter > 0) query = query.eq('estrellas', starsFilter)
    const { data } = await query
    setReviews(data || [])
    setLoading(false)
  }

  async function responderReview(id: string) {
    if (!respuesta.trim()) return
    await supabase.from('reviews').update({ respuesta_admin: respuesta.trim(), fecha_respuesta: new Date().toISOString() }).eq('id', id)
    setRespondingId(null); setRespuesta(''); loadReviews()
  }

  async function toggleVisible(id: string, visible: boolean) {
    await supabase.from('reviews').update({ visible: !visible }).eq('id', id)
    loadReviews()
  }

  async function enviarCupon(review: any) {
    setSendingCupon(review.id)
    try {
      const codigo = `DISC-${review.id.substring(0,6).toUpperCase()}`
      await supabase.from('reviews').update({ cupon_enviado: true, cupon_codigo: codigo }).eq('id', review.id)
      alert(`✅ Cupón ${codigo} marcado como enviado. Agrégalo manualmente en la billetera del cliente.`)
      loadReviews()
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setSendingCupon(null) }
  }

  const sinResponder = reviews.filter(r => !r.respuesta_admin && r.visible).length
  const promedio = reviews.length > 0 ? (reviews.reduce((a,r) => a + r.estrellas, 0) / reviews.length).toFixed(1) : '—'

  return (
    <div style={{ minHeight:'100dvh', background:'#F7F8FA', fontFamily:'var(--font-body)' }}>
      <header style={{ background:'white', borderBottom:'1px solid #E4E6EA', position:'sticky', top:0, zIndex:20, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth:'900px', margin:'0 auto', padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
          <div>
            <h1 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'20px', margin:0 }}>⭐ Reseñas</h1>
            {sinResponder > 0 && <p style={{ fontSize:'12px', color:'#EF4444', fontWeight:600, margin:'2px 0 0' }}>{sinResponder} sin responder</p>}
          </div>
          <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ background:'#F3F4F6', borderRadius:'10px', padding:'6px 14px', fontSize:'13px', fontWeight:700, color:'#374151' }}>
              ⭐ {promedio} · {reviews.length} reseñas
            </div>
            <a href="/reviews/arepa" target="_blank" style={{ padding:'8px 14px', background:'#FEE2E2', color:'#C41E3A', borderRadius:'10px', fontSize:'12px', fontWeight:700, textDecoration:'none' }}>
              Ver pública Arepa ↗
            </a>
            <a href="/reviews/smash" target="_blank" style={{ padding:'8px 14px', background:'#DBEAFE', color:'#0052CC', borderRadius:'10px', fontSize:'12px', fontWeight:700, textDecoration:'none' }}>
              Ver pública Smash ↗
            </a>
          </div>
        </div>
        <div style={{ maxWidth:'900px', margin:'0 auto', padding:'0 20px 12px', display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {['TODAS','AREPA','SMASH'].map(m => (
            <button key={m} onClick={() => setMarcaFilter(m)}
              style={{ padding:'6px 14px', borderRadius:'999px', border:'none', background: marcaFilter===m ? '#0D0F12' : '#F3F4F6', color: marcaFilter===m ? 'white' : '#6B7280', fontSize:'12px', fontWeight:600, cursor:'pointer' }}>
              {m === 'AREPA' ? '🫓 Arepa' : m === 'SMASH' ? '🍔 Smash' : 'Todas'}
            </button>
          ))}
          <div style={{ width:'1px', background:'#E4E6EA' }} />
          {[0,5,4,3,2,1].map(n => (
            <button key={n} onClick={() => setStarsFilter(n)}
              style={{ padding:'6px 14px', borderRadius:'999px', border:'none', background: starsFilter===n ? '#F59E0B' : '#F3F4F6', color: starsFilter===n ? 'white' : '#6B7280', fontSize:'12px', fontWeight:600, cursor:'pointer' }}>
              {n === 0 ? 'Todas' : '⭐'.repeat(n)}
            </button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth:'900px', margin:'0 auto', padding:'16px 20px' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:'48px', color:'#9CA3AF' }}>Cargando reseñas...</div>
        ) : reviews.length === 0 ? (
          <div style={{ textAlign:'center', padding:'48px', color:'#9CA3AF' }}>
            <p style={{ fontSize:'36px', marginBottom:'8px' }}>⭐</p>
            <p style={{ fontWeight:600 }}>No hay reseñas todavía</p>
            <p style={{ fontSize:'13px' }}>Aparecerán aquí cuando los clientes califiquen sus pedidos</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            {reviews.map(r => {
              const oc = r.marca === 'AREPA' ? '#C41E3A' : '#0052CC'
              return (
                <div key={r.id} style={{ background:'white', borderRadius:'16px', border:`1.5px solid ${!r.respuesta_admin && r.visible ? '#FDE68A' : '#E4E6EA'}`, padding:'18px', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'12px', flexWrap:'wrap', gap:'8px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <div style={{ width:'38px', height:'38px', borderRadius:'50%', background:`${oc}15`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'16px', color:oc }}>
                        {(r.nombre_cliente || 'C').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontWeight:700, fontSize:'14px', margin:0 }}>{r.nombre_cliente || 'Cliente'}</p>
                        <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                          <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'6px', background:r.marca==='AREPA'?'#FEE2E2':'#DBEAFE', color:oc }}>{r.marca}</span>
                          <span style={{ fontSize:'11px', color:'#9CA3AF' }}>{new Date(r.created_at).toLocaleDateString('es-DO', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                          {r.order?.numero_pedido && <span style={{ fontSize:'11px', color:'#9CA3AF' }}>· Pedido #{r.order.numero_pedido}</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <div style={{ display:'flex', gap:'2px' }}>
                        {[1,2,3,4,5].map(n => <span key={n} style={{ fontSize:'16px', filter: n <= r.estrellas ? 'none' : 'grayscale(1) opacity(0.3)' }}>⭐</span>)}
                      </div>
                      {!r.visible && <span style={{ fontSize:'11px', background:'#F3F4F6', color:'#9CA3AF', padding:'2px 8px', borderRadius:'6px' }}>Oculta</span>}
                      {r.cupon_enviado && <span style={{ fontSize:'11px', background:'#DCFCE7', color:'#15803D', padding:'2px 8px', borderRadius:'6px' }}>🎟 Cupón</span>}
                    </div>
                  </div>

                  {r.comentario && (
                    <p style={{ fontSize:'14px', color:'#374151', margin:'0 0 12px', lineHeight:1.6, background:'#F9FAFB', borderRadius:'10px', padding:'10px 14px' }}>
                      "{r.comentario}"
                    </p>
                  )}

                  {r.respuesta_admin && (
                    <div style={{ background:`${oc}08`, border:`1px solid ${oc}20`, borderRadius:'10px', padding:'10px 14px', marginBottom:'12px' }}>
                      <p style={{ fontSize:'11px', fontWeight:700, color:oc, margin:'0 0 4px' }}>💬 Tu respuesta</p>
                      <p style={{ fontSize:'13px', color:'#374151', margin:0 }}>{r.respuesta_admin}</p>
                    </div>
                  )}

                  {respondingId === r.id && (
                    <div style={{ marginBottom:'12px' }}>
                      <textarea
                        placeholder="Escribe tu respuesta al cliente..."
                        value={respuesta}
                        onChange={e => setRespuesta(e.target.value)}
                        rows={3}
                        autoFocus
                        style={{ width:'100%', border:'2px solid #E4E6EA', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', outline:'none', resize:'none', fontFamily:'var(--font-body)', boxSizing:'border-box' as any }}
                      />
                      <div style={{ display:'flex', gap:'8px', marginTop:'8px' }}>
                        <button onClick={() => responderReview(r.id)} disabled={!respuesta.trim()}
                          style={{ padding:'8px 18px', background:oc, color:'white', border:'none', borderRadius:'8px', fontWeight:700, fontSize:'13px', cursor:'pointer' }}>
                          Publicar respuesta
                        </button>
                        <button onClick={() => { setRespondingId(null); setRespuesta('') }}
                          style={{ padding:'8px 14px', background:'#F3F4F6', color:'#6B7280', border:'none', borderRadius:'8px', fontWeight:600, fontSize:'13px', cursor:'pointer' }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                    {respondingId !== r.id && (
                      <button onClick={() => { setRespondingId(r.id); setRespuesta(r.respuesta_admin || '') }}
                        style={{ padding:'7px 14px', background:'#F3F4F6', color:'#374151', border:'none', borderRadius:'8px', fontWeight:600, fontSize:'12px', cursor:'pointer' }}>
                        {r.respuesta_admin ? '✏️ Editar respuesta' : '💬 Responder'}
                      </button>
                    )}
                    {!r.cupon_enviado && (
                      <button onClick={() => enviarCupon(r)} disabled={sendingCupon === r.id}
                        style={{ padding:'7px 14px', background:'#DCFCE7', color:'#15803D', border:'none', borderRadius:'8px', fontWeight:600, fontSize:'12px', cursor:'pointer' }}>
                        {sendingCupon === r.id ? 'Enviando...' : '🎟 Enviar cupón'}
                      </button>
                    )}
                    <button onClick={() => toggleVisible(r.id, r.visible)}
                      style={{ padding:'7px 14px', background:'#FEE2E2', color:'#DC2626', border:'none', borderRadius:'8px', fontWeight:600, fontSize:'12px', cursor:'pointer' }}>
                      {r.visible ? '🗑 Ocultar' : '👁 Restaurar'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
