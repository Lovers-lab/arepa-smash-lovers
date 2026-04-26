'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

const STAR_LABELS: Record<number, string> = {
  1: 'Muy malo', 2: 'Malo', 3: 'Regular', 4: 'Bueno', 5: 'Excelente'
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [marcaFilter, setMarcaFilter] = useState<'TODAS'|'AREPA'|'SMASH'>('TODAS')
  const [starsFilter, setStarsFilter] = useState(0)
  const [respondingId, setRespondingId] = useState<string|null>(null)
  const [respuesta, setRespuesta] = useState('')
  const [sendingCupon, setSendingCupon] = useState<string|null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newReview, setNewReview] = useState({ nombre: '', comentario: '', estrellas: 5, marca: 'AREPA' as 'AREPA'|'SMASH' })
  const [savingNew, setSavingNew] = useState(false)

  useEffect(() => { loadReviews() }, [marcaFilter, starsFilter])

  async function loadReviews() {
    setLoading(true)
    let query = supabase
      .from('reviews')
      .select('*, order:orders(numero_pedido)')
      .order('created_at', { ascending: false })
    if (marcaFilter !== 'TODAS') query = query.eq('marca', marcaFilter)
    if (starsFilter > 0) query = query.eq('estrellas', starsFilter)
    const { data } = await query
    setReviews(data || [])
    setLoading(false)
  }

  async function responderReview(id: string) {
    if (!respuesta.trim()) return
    await supabase.from('reviews').update({
      respuesta_admin: respuesta.trim(),
      fecha_respuesta: new Date().toISOString()
    }).eq('id', id)
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
      alert(`✅ Cupón ${codigo} registrado. Agrégalo en la billetera del cliente.`)
      loadReviews()
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setSendingCupon(null) }
  }

  async function addManualReview() {
    if (!newReview.nombre.trim()) return
    setSavingNew(true)
    try {
      await supabase.from('reviews').insert({
        nombre_cliente: newReview.nombre.trim(),
        comentario: newReview.comentario.trim() || null,
        estrellas: newReview.estrellas,
        marca: newReview.marca,
        visible: true,
        user_id: null,
        order_id: null,
      })
      setShowAddModal(false)
      setNewReview({ nombre: '', comentario: '', estrellas: 5, marca: 'AREPA' })
      loadReviews()
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setSavingNew(false) }
  }

  const visible = reviews.filter(r => r.visible)
  const sinResponder = visible.filter(r => !r.respuesta_admin).length
  const promedio = visible.length > 0
    ? (visible.reduce((a, r) => a + r.estrellas, 0) / visible.length).toFixed(1)
    : '—'

  const dist = [5,4,3,2,1].map(n => ({
    n, count: visible.filter(r => r.estrellas === n).length,
    pct: visible.length > 0 ? Math.round(visible.filter(r => r.estrellas === n).length / visible.length * 100) : 0
  }))

  return (
    <div style={{ minHeight:'100dvh', background:'#F4F5F7', fontFamily:'var(--font-body)' }}>
      <style>{`
        .rev-card { transition: box-shadow 0.2s; }
        .rev-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.08) !important; }
        .filter-btn { transition: all 0.15s; }
        .filter-btn:hover { opacity: 0.85; }
        .action-btn { transition: all 0.15s; }
        .action-btn:hover { filter: brightness(0.92); }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes modalIn { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
      `}</style>

      {/* HEADER */}
      <div style={{ background:'white', borderBottom:'1px solid #EAECEF', position:'sticky', top:0, zIndex:30, boxShadow:'0 1px 0 #EAECEF' }}>
        <div style={{ maxWidth:'1000px', margin:'0 auto', padding:'16px 24px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'16px', marginBottom:'14px' }}>
            <div>
              <h1 style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'22px', margin:0, color:'#0D0F12' }}>Reseñas</h1>
              <p style={{ fontSize:'12px', color:'#9CA3AF', margin:'2px 0 0' }}>
                {sinResponder > 0
                  ? <span style={{ color:'#EF4444', fontWeight:600 }}>● {sinResponder} sin responder</span>
                  : <span style={{ color:'#10B981', fontWeight:600 }}>● Todo respondido</span>}
              </p>
            </div>
            <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
              <a href="/reviews/arepa" target="_blank"
                style={{ padding:'8px 14px', background:'#FEF2F2', color:'#C41E3A', borderRadius:'10px', fontSize:'12px', fontWeight:700, textDecoration:'none', display:'flex', alignItems:'center', gap:'5px' }}>
                🫓 Ver pública ↗
              </a>
              <a href="/reviews/smash" target="_blank"
                style={{ padding:'8px 14px', background:'#EFF6FF', color:'#0052CC', borderRadius:'10px', fontSize:'12px', fontWeight:700, textDecoration:'none', display:'flex', alignItems:'center', gap:'5px' }}>
                🍔 Ver pública ↗
              </a>
              <button onClick={() => setShowAddModal(true)}
                style={{ padding:'9px 18px', background:'#C41E3A', color:'white', border:'none', borderRadius:'10px', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'13px', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}>
                + Agregar reseña
              </button>
            </div>
          </div>

          {/* Stats + Filtros */}
          <div style={{ display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
            {/* Score pill */}
            <div style={{ display:'flex', alignItems:'center', gap:'8px', background:'#F9FAFB', border:'1px solid #E4E6EA', borderRadius:'10px', padding:'6px 14px', flexShrink:0 }}>
              <span style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'20px', color:'#0D0F12' }}>{promedio}</span>
              <div>
                <div style={{ fontSize:'12px' }}>{'⭐'.repeat(Math.round(Number(promedio) || 0))}</div>
                <div style={{ fontSize:'10px', color:'#9CA3AF' }}>{visible.length} reseñas</div>
              </div>
            </div>

            {/* Dist bars */}
            <div style={{ display:'flex', gap:'4px', alignItems:'center' }}>
              {dist.map(d => (
                <div key={d.n} title={`${d.n}⭐: ${d.count}`} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'2px' }}>
                  <div style={{ width:'28px', height:'32px', background:'#F3F4F6', borderRadius:'4px', position:'relative', overflow:'hidden' }}>
                    <div style={{ position:'absolute', bottom:0, left:0, right:0, height:`${d.pct}%`, background: d.n >= 4 ? '#10B981' : d.n === 3 ? '#F59E0B' : '#EF4444', transition:'height 0.4s' }} />
                  </div>
                  <span style={{ fontSize:'9px', color:'#9CA3AF', fontWeight:600 }}>{d.n}★</span>
                </div>
              ))}
            </div>

            <div style={{ width:'1px', height:'32px', background:'#E4E6EA', flexShrink:0 }} />

            {/* Filtros marca */}
            {(['TODAS','AREPA','SMASH'] as const).map(m => (
              <button key={m} onClick={() => setMarcaFilter(m)} className="filter-btn"
                style={{ padding:'6px 14px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:600,
                  background: marcaFilter===m ? '#0D0F12' : '#F3F4F6',
                  color: marcaFilter===m ? 'white' : '#6B7280' }}>
                {m === 'AREPA' ? '🫓 Arepa' : m === 'SMASH' ? '🍔 Smash' : 'Todas'}
              </button>
            ))}

            <div style={{ width:'1px', height:'24px', background:'#E4E6EA', flexShrink:0 }} />

            {/* Filtros estrellas */}
            {[0,5,4,3,2,1].map(n => (
              <button key={n} onClick={() => setStarsFilter(n)} className="filter-btn"
                style={{ padding:'6px 12px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:600,
                  background: starsFilter===n ? '#F59E0B' : '#F3F4F6',
                  color: starsFilter===n ? 'white' : '#6B7280' }}>
                {n === 0 ? 'Todas ⭐' : `${'★'.repeat(n)}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <main style={{ maxWidth:'1000px', margin:'0 auto', padding:'20px 24px' }}>
        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ background:'white', borderRadius:'14px', height:'120px', opacity: 1 - i*0.2 }} />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div style={{ textAlign:'center', padding:'80px 20px' }}>
            <div style={{ fontSize:'56px', marginBottom:'16px' }}>⭐</div>
            <p style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'18px', color:'#374151', marginBottom:'6px' }}>Sin reseñas todavía</p>
            <p style={{ fontSize:'14px', color:'#9CA3AF', marginBottom:'20px' }}>Aparecerán cuando los clientes califiquen sus pedidos</p>
            <button onClick={() => setShowAddModal(true)}
              style={{ padding:'10px 20px', background:'#C41E3A', color:'white', border:'none', borderRadius:'10px', fontWeight:700, fontSize:'13px', cursor:'pointer' }}>
              + Agregar primera reseña
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {reviews.map((r, idx) => {
              const oc = r.marca === 'AREPA' ? '#C41E3A' : '#0052CC'
              const isNew = !r.respuesta_admin && r.visible
              return (
                <div key={r.id} className="rev-card"
                  style={{ background:'white', borderRadius:'14px', border:`1px solid ${isNew ? '#FDE68A' : '#EAECEF'}`, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.04)', animation:`fadeIn 0.2s ease ${idx * 0.04}s both` }}>

                  {/* Top strip si pendiente */}
                  {isNew && <div style={{ height:'3px', background:'linear-gradient(90deg, #F59E0B, #FBBF24)' }} />}

                  <div style={{ padding:'16px 20px' }}>
                    {/* Row 1: info + estrellas */}
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'12px', gap:'12px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'12px', minWidth:0 }}>
                        {/* Avatar */}
                        <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:`${oc}12`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:900, fontSize:'17px', color:oc, flexShrink:0 }}>
                          {(r.nombre_cliente || 'C').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ minWidth:0 }}>
                          <p style={{ fontWeight:700, fontSize:'14px', margin:'0 0 3px', color:'#0D0F12', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {r.nombre_cliente || 'Cliente verificado'}
                            {!r.user_id && <span style={{ marginLeft:'6px', fontSize:'10px', background:'#F3F4F6', color:'#9CA3AF', padding:'1px 6px', borderRadius:'4px', fontWeight:500 }}>manual</span>}
                          </p>
                          <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                            <span style={{ fontSize:'10px', fontWeight:700, padding:'2px 8px', borderRadius:'5px', background:r.marca==='AREPA'?'#FEE2E2':'#DBEAFE', color:oc }}>
                              {r.marca === 'AREPA' ? '🫓' : '🍔'} {r.marca}
                            </span>
                            <span style={{ fontSize:'11px', color:'#9CA3AF' }}>
                              {new Date(r.created_at).toLocaleDateString('es-DO', { day:'numeric', month:'short', year:'numeric' })}
                            </span>
                            {r.order?.numero_pedido && (
                              <span style={{ fontSize:'11px', color:'#9CA3AF' }}>· Pedido #{r.order.numero_pedido}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Estrellas + badges */}
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'6px', flexShrink:0 }}>
                        <div style={{ display:'flex', gap:'2px' }}>
                          {[1,2,3,4,5].map(n => (
                            <span key={n} style={{ fontSize:'15px', filter: n <= r.estrellas ? 'none' : 'grayscale(1) opacity(0.2)' }}>⭐</span>
                          ))}
                        </div>
                        <div style={{ display:'flex', gap:'4px' }}>
                          {!r.visible && <span style={{ fontSize:'10px', background:'#F3F4F6', color:'#9CA3AF', padding:'2px 7px', borderRadius:'5px', fontWeight:600 }}>Oculta</span>}
                          {r.cupon_enviado && <span style={{ fontSize:'10px', background:'#DCFCE7', color:'#15803D', padding:'2px 7px', borderRadius:'5px', fontWeight:600 }}>🎟 Cupón</span>}
                          {isNew && <span style={{ fontSize:'10px', background:'#FEF3C7', color:'#92400E', padding:'2px 7px', borderRadius:'5px', fontWeight:700 }}>Sin responder</span>}
                        </div>
                      </div>
                    </div>

                    {/* Comentario */}
                    {r.comentario && (
                      <p style={{ fontSize:'14px', color:'#374151', margin:'0 0 12px', lineHeight:1.65, padding:'12px 14px', background:'#F9FAFB', borderRadius:'10px', borderLeft:`3px solid ${oc}30` }}>
                        "{r.comentario}"
                      </p>
                    )}

                    {/* Respuesta admin */}
                    {r.respuesta_admin && respondingId !== r.id && (
                      <div style={{ background:`${oc}06`, border:`1px solid ${oc}18`, borderRadius:'10px', padding:'10px 14px', marginBottom:'12px' }}>
                        <p style={{ fontSize:'11px', fontWeight:700, color:oc, margin:'0 0 4px', display:'flex', alignItems:'center', gap:'5px' }}>
                          💬 Respuesta del restaurante
                          <span style={{ fontSize:'10px', fontWeight:400, color:'#9CA3AF' }}>
                            · {r.fecha_respuesta ? new Date(r.fecha_respuesta).toLocaleDateString('es-DO', { day:'numeric', month:'short' }) : ''}
                          </span>
                        </p>
                        <p style={{ fontSize:'13px', color:'#374151', margin:0, lineHeight:1.55 }}>{r.respuesta_admin}</p>
                      </div>
                    )}

                    {/* Input respuesta */}
                    {respondingId === r.id && (
                      <div style={{ marginBottom:'12px' }}>
                        <textarea
                          placeholder="Escribe tu respuesta pública al cliente..."
                          value={respuesta}
                          onChange={e => setRespuesta(e.target.value)}
                          rows={3}
                          autoFocus
                          style={{ width:'100%', border:`2px solid ${oc}`, borderRadius:'10px', padding:'11px 14px', fontSize:'13px', outline:'none', resize:'none', fontFamily:'var(--font-body)', boxSizing:'border-box' as any, lineHeight:1.55 }}
                        />
                        <div style={{ display:'flex', gap:'8px', marginTop:'8px' }}>
                          <button onClick={() => responderReview(r.id)} disabled={!respuesta.trim()}
                            style={{ padding:'8px 18px', background: respuesta.trim() ? oc : '#E4E6EA', color: respuesta.trim() ? 'white' : '#9CA3AF', border:'none', borderRadius:'8px', fontWeight:700, fontSize:'13px', cursor: respuesta.trim() ? 'pointer' : 'not-allowed' }}>
                            Publicar respuesta
                          </button>
                          <button onClick={() => { setRespondingId(null); setRespuesta('') }}
                            style={{ padding:'8px 14px', background:'#F3F4F6', color:'#6B7280', border:'none', borderRadius:'8px', fontWeight:600, fontSize:'13px', cursor:'pointer' }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Acciones */}
                    {respondingId !== r.id && (
                      <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', paddingTop:'4px' }}>
                        <button onClick={() => { setRespondingId(r.id); setRespuesta(r.respuesta_admin || '') }}
                          className="action-btn"
                          style={{ padding:'7px 14px', background: isNew ? '#0D0F12' : '#F3F4F6', color: isNew ? 'white' : '#374151', border:'none', borderRadius:'8px', fontWeight:600, fontSize:'12px', cursor:'pointer' }}>
                          {r.respuesta_admin ? '✏️ Editar respuesta' : '💬 Responder'}
                        </button>
                        {!r.cupon_enviado && (
                          <button onClick={() => enviarCupon(r)} disabled={sendingCupon === r.id}
                            className="action-btn"
                            style={{ padding:'7px 14px', background:'#ECFDF5', color:'#059669', border:'none', borderRadius:'8px', fontWeight:600, fontSize:'12px', cursor:'pointer' }}>
                            {sendingCupon === r.id ? '...' : '🎟 Enviar cupón'}
                          </button>
                        )}
                        <button onClick={() => toggleVisible(r.id, r.visible)}
                          className="action-btn"
                          style={{ padding:'7px 14px', background:'#FEF2F2', color:'#DC2626', border:'none', borderRadius:'8px', fontWeight:600, fontSize:'12px', cursor:'pointer' }}>
                          {r.visible ? '🗑 Ocultar' : '👁 Mostrar'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* MODAL AGREGAR RESEÑA */}
      {showAddModal && (
        <>
          <div onClick={() => setShowAddModal(false)}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:50, backdropFilter:'blur(3px)' }} />
          <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:51, width:'100%', maxWidth:'480px', padding:'0 16px', animation:'modalIn 0.2s ease' }}>
            <div style={{ background:'white', borderRadius:'20px', padding:'28px', boxShadow:'0 24px 64px rgba(0,0,0,0.18)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
                <h2 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'19px', margin:0 }}>Agregar reseña</h2>
                <button onClick={() => setShowAddModal(false)}
                  style={{ width:'32px', height:'32px', borderRadius:'8px', border:'none', background:'#F3F4F6', cursor:'pointer', fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center', color:'#6B7280' }}>×</button>
              </div>

              {/* Marca */}
              <div style={{ marginBottom:'16px' }}>
                <label style={{ fontSize:'12px', fontWeight:700, color:'#6B7280', display:'block', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Restaurante</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                  {(['AREPA','SMASH'] as const).map(m => (
                    <button key={m} onClick={() => setNewReview(p => ({ ...p, marca: m }))}
                      style={{ padding:'12px', borderRadius:'10px', border:`2px solid ${newReview.marca === m ? (m==='AREPA'?'#C41E3A':'#0052CC') : '#E4E6EA'}`, background: newReview.marca === m ? (m==='AREPA'?'#FEF2F2':'#EFF6FF') : 'white', cursor:'pointer', fontWeight:700, fontSize:'14px', color: newReview.marca === m ? (m==='AREPA'?'#C41E3A':'#0052CC') : '#6B7280', transition:'all 0.15s' }}>
                      {m === 'AREPA' ? '🫓 Arepa Lovers' : '🍔 Smash Lovers'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nombre */}
              <div style={{ marginBottom:'16px' }}>
                <label style={{ fontSize:'12px', fontWeight:700, color:'#6B7280', display:'block', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Nombre del cliente</label>
                <input
                  type="text"
                  placeholder="Ej: María García"
                  value={newReview.nombre}
                  onChange={e => setNewReview(p => ({ ...p, nombre: e.target.value }))}
                  style={{ width:'100%', border:'2px solid #E4E6EA', borderRadius:'10px', padding:'12px 14px', fontSize:'14px', outline:'none', fontFamily:'var(--font-body)', boxSizing:'border-box' as any, transition:'border-color 0.15s' }}
                  onFocus={e => e.target.style.borderColor = newReview.marca==='AREPA'?'#C41E3A':'#0052CC'}
                  onBlur={e => e.target.style.borderColor = '#E4E6EA'}
                />
              </div>

              {/* Estrellas */}
              <div style={{ marginBottom:'16px' }}>
                <label style={{ fontSize:'12px', fontWeight:700, color:'#6B7280', display:'block', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Calificación</label>
                <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setNewReview(p => ({ ...p, estrellas: n }))}
                      style={{ fontSize:'28px', background:'none', border:'none', cursor:'pointer', transition:'transform 0.1s', transform: newReview.estrellas >= n ? 'scale(1.1)' : 'scale(1)', filter: newReview.estrellas >= n ? 'none' : 'grayscale(1) opacity(0.3)' }}>
                      ⭐
                    </button>
                  ))}
                  <span style={{ fontSize:'13px', color:'#6B7280', fontWeight:600, marginLeft:'4px' }}>
                    {STAR_LABELS[newReview.estrellas]}
                  </span>
                </div>
              </div>

              {/* Comentario */}
              <div style={{ marginBottom:'24px' }}>
                <label style={{ fontSize:'12px', fontWeight:700, color:'#6B7280', display:'block', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                  Comentario <span style={{ fontWeight:400, textTransform:'none' }}>(opcional)</span>
                </label>
                <textarea
                  placeholder="¿Qué dijo el cliente sobre su experiencia?"
                  value={newReview.comentario}
                  onChange={e => setNewReview(p => ({ ...p, comentario: e.target.value }))}
                  rows={3}
                  style={{ width:'100%', border:'2px solid #E4E6EA', borderRadius:'10px', padding:'12px 14px', fontSize:'14px', outline:'none', resize:'none', fontFamily:'var(--font-body)', boxSizing:'border-box' as any, lineHeight:1.55, transition:'border-color 0.15s' }}
                  onFocus={e => e.target.style.borderColor = newReview.marca==='AREPA'?'#C41E3A':'#0052CC'}
                  onBlur={e => e.target.style.borderColor = '#E4E6EA'}
                />
              </div>

              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={addManualReview} disabled={!newReview.nombre.trim() || savingNew}
                  style={{ flex:1, padding:'14px', background: newReview.nombre.trim() ? (newReview.marca==='AREPA'?'#C41E3A':'#0052CC') : '#E4E6EA', color: newReview.nombre.trim() ? 'white' : '#9CA3AF', border:'none', borderRadius:'12px', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'15px', cursor: newReview.nombre.trim() ? 'pointer' : 'not-allowed', transition:'all 0.2s' }}>
                  {savingNew ? 'Guardando...' : 'Publicar reseña'}
                </button>
                <button onClick={() => setShowAddModal(false)}
                  style={{ padding:'14px 20px', background:'#F3F4F6', color:'#6B7280', border:'none', borderRadius:'12px', fontWeight:600, fontSize:'14px', cursor:'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
