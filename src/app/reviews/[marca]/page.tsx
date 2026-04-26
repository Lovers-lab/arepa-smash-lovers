export const revalidate = 60
import { createAdminClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: { marca: string } }): Promise<Metadata> {
  const nombre = params.marca === 'arepa' ? 'Arepa Lovers' : 'Smash Lovers'
  return { title: `Reseñas — ${nombre}` }
}

export default async function ReviewsPublicPage({ params }: { params: { marca: string } }) {
  const marcaKey = params.marca.toUpperCase() as 'AREPA' | 'SMASH'
  const nombre = marcaKey === 'AREPA' ? 'Arepa Lovers' : 'Smash Lovers'
  const color = marcaKey === 'AREPA' ? '#C41E3A' : '#0052CC'
  const logo = marcaKey === 'AREPA' ? '/logos/logo-arepa.png' : '/logos/logo-smash.png'

  const supabase = createAdminClient()
  const { data: reviews } = await supabase
    .from('reviews')
    .select('*')
    .eq('marca', marcaKey)
    .eq('visible', true)
    .order('created_at', { ascending: false })
    .limit(50)

  const total = reviews?.length || 0
  const promedio = total > 0
    ? (reviews!.reduce((a, r) => a + r.estrellas, 0) / total).toFixed(1)
    : '0.0'

  const dist = [5,4,3,2,1].map(n => ({
    stars: n,
    count: reviews?.filter(r => r.estrellas === n).length || 0,
    pct: total > 0 ? Math.round((reviews?.filter(r => r.estrellas === n).length || 0) / total * 100) : 0
  }))

  return (
    <main style={{ minHeight:'100dvh', background:'#F7F8FA', fontFamily:'var(--font-body)', paddingBottom:'48px' }}>
      {/* Header */}
      <div style={{ background:`linear-gradient(135deg, ${color}, ${color}DD)`, padding:'32px 20px 48px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', width:'300px', height:'300px', borderRadius:'50%', background:'rgba(255,255,255,0.06)', top:'-100px', right:'-80px' }} />
        <div style={{ maxWidth:'600px', margin:'0 auto', display:'flex', alignItems:'center', gap:'16px', position:'relative', zIndex:1 }}>
          <img src={logo} style={{ width:'64px', height:'64px', borderRadius:'16px', objectFit:'cover', boxShadow:'0 4px 16px rgba(0,0,0,0.2)' }} alt={nombre} />
          <div>
            <h1 style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'24px', color:'white', margin:0 }}>{nombre}</h1>
            <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'14px', margin:'4px 0 0' }}>Reseñas de clientes verificados</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:'600px', margin:'-32px auto 0', padding:'0 16px' }}>
        {/* Score card */}
        <div style={{ background:'white', borderRadius:'20px', padding:'24px', boxShadow:'0 4px 24px rgba(0,0,0,0.08)', marginBottom:'16px', position:'relative', zIndex:2 }}>
          <div style={{ display:'flex', gap:'24px', alignItems:'center' }}>
            <div style={{ textAlign:'center', flexShrink:0 }}>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'56px', color, lineHeight:1 }}>{promedio}</div>
              <div style={{ fontSize:'22px', margin:'6px 0 4px' }}>{'⭐'.repeat(Math.round(Number(promedio)))}</div>
              <div style={{ fontSize:'12px', color:'#9CA3AF' }}>{total} reseña{total !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ flex:1 }}>
              {dist.map(d => (
                <div key={d.stars} style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px' }}>
                  <span style={{ fontSize:'11px', fontWeight:700, color:'#6B7280', width:'12px', textAlign:'right' }}>{d.stars}</span>
                  <span style={{ fontSize:'12px' }}>⭐</span>
                  <div style={{ flex:1, height:'8px', background:'#F3F4F6', borderRadius:'4px', overflow:'hidden' }}>
                    <div style={{ width:`${d.pct}%`, height:'100%', background:color, borderRadius:'4px', transition:'width 0.5s' }} />
                  </div>
                  <span style={{ fontSize:'11px', color:'#9CA3AF', width:'28px' }}>{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Reviews list */}
        {total === 0 ? (
          <div style={{ textAlign:'center', padding:'48px 20px', color:'#9CA3AF' }}>
            <div style={{ fontSize:'48px', marginBottom:'12px' }}>⭐</div>
            <p style={{ fontWeight:600, fontSize:'16px', color:'#374151' }}>Aún no hay reseñas</p>
            <p style={{ fontSize:'14px' }}>¡Sé el primero en opinar!</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            {reviews!.map(r => (
              <div key={r.id} style={{ background:'white', borderRadius:'16px', padding:'18px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'10px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <div style={{ width:'38px', height:'38px', borderRadius:'50%', background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'16px', color, flexShrink:0 }}>
                      {(r.nombre_cliente || 'C').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontWeight:700, fontSize:'14px', margin:0, color:'#0D0F12' }}>{r.nombre_cliente || 'Cliente verificado'}</p>
                      <p style={{ fontSize:'11px', color:'#9CA3AF', margin:0 }}>{new Date(r.created_at).toLocaleDateString('es-DO', { day:'numeric', month:'long', year:'numeric' })}</p>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'1px', flexShrink:0 }}>
                    {[1,2,3,4,5].map(n => (
                      <span key={n} style={{ fontSize:'14px', filter: n <= r.estrellas ? 'none' : 'grayscale(1) opacity(0.3)' }}>⭐</span>
                    ))}
                  </div>
                </div>
                {r.comentario && (
                  <p style={{ fontSize:'14px', color:'#374151', margin:'0 0 10px', lineHeight:1.6 }}>{r.comentario}</p>
                )}
                {r.respuesta_admin && (
                  <div style={{ background:`${color}08`, border:`1px solid ${color}20`, borderRadius:'10px', padding:'10px 14px', marginTop:'10px' }}>
                    <p style={{ fontSize:'11px', fontWeight:700, color, margin:'0 0 4px' }}>💬 Respuesta del restaurante</p>
                    <p style={{ fontSize:'13px', color:'#374151', margin:0, lineHeight:1.5 }}>{r.respuesta_admin}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
