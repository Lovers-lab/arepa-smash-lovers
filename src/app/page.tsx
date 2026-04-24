'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Marca = 'AREPA' | 'SMASH'
interface TopProduct { id: string; nombre: string; precio: number; foto_url: string | null; descuento_pct: number; es_destacado: boolean; marca: Marca }

function TopRow({ items, color, onTap }: { items: TopProduct[]; color: string; onTap: () => void }) {
  function formatRD(n: number) { return `RD$${n.toLocaleString('es-DO')}` }
  return (
    <div style={{ display:'flex', gap:'10px', overflowX:'auto', paddingBottom:'4px', scrollbarWidth:'none' }}>
      {items.map((p) => (
        <div key={p.id} onClick={onTap} style={{ flex:'0 0 130px', background:'white', borderRadius:'14px', overflow:'hidden', cursor:'pointer', boxShadow:'0 2px 8px rgba(0,0,0,0.07)' }}>
          <div style={{ height:'88px', background: p.marca==='AREPA'?'#FFF0F0':'#F0F4FF', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'40px', position:'relative', overflow:'hidden' }}>
            {p.foto_url
              ? <img src={p.foto_url} alt={p.nombre} style={{ width:'100%', height:'100%', objectFit:'cover', position:'absolute', inset:0 }} />
              : <span>{p.marca==='AREPA'?'🫓':'🍔'}</span>
            }
            {p.descuento_pct > 0 && (
              <div style={{ position:'absolute', top:'6px', left:'6px', background:'#FFD600', borderRadius:'50px', padding:'2px 7px', fontSize:'9px', fontWeight:900, color:'#1A1A1A', zIndex:1 }}>{p.descuento_pct}% OFF</div>
            )}
            {p.es_destacado && p.descuento_pct === 0 && (
              <div style={{ position:'absolute', top:'6px', left:'6px', background:color, borderRadius:'50px', padding:'2px 7px', fontSize:'9px', fontWeight:900, color:'white', zIndex:1 }}>⭐ Top</div>
            )}
          </div>
          <div style={{ padding:'8px 10px' }}>
            <div style={{ fontSize:'11px', fontWeight:800, color:'#1A1A1A', lineHeight:1.3 }}>{p.nombre}</div>
            <div style={{ fontSize:'13px', fontWeight:900, color, marginTop:'4px' }}>{formatRD(p.precio)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<{ nombre: string } | null>(null)
  const [topArepa, setTopArepa] = useState<TopProduct[]>([])
  const [topSmash, setTopSmash] = useState<TopProduct[]>([])

  useEffect(() => {
    const stored = localStorage.getItem('lovers_user')
    if (!stored) { router.replace('/auth/login'); return }
    setUser(JSON.parse(stored))
    loadTop()
  }, [])

  async function loadTop() {
    const { data } = await supabase
      .from('products')
      .select('id, nombre, precio, foto_url, descuento_pct, es_destacado, marca')
      .eq('activo', true)
      .or('es_destacado.eq.true,descuento_pct.gt.0')
      .order('es_destacado', { ascending: false })
      .order('descuento_pct', { ascending: false })
      .limit(12)
    if (data) {
      setTopArepa(data.filter((p: any) => p.marca === 'AREPA').slice(0, 6) as TopProduct[])
      setTopSmash(data.filter((p: any) => p.marca === 'SMASH').slice(0, 6) as TopProduct[])
    }
  }

  function selectMarca(marca: Marca) {
    const current = localStorage.getItem('lovers_marca') as Marca | null
    if (current && current !== marca) {
      const ok = confirm('¿Cambiar de restaurante? Se limpiará el carrito.')
      if (!ok) return
      localStorage.removeItem('lovers_cart')
    }
    localStorage.setItem('lovers_marca', marca)
    router.push('/menu')
  }

  if (!user) return null

  return (
    <main style={{ minHeight:'100dvh', background:'#F4F4F6', fontFamily:'var(--font-body)', paddingBottom:'32px' }}>
      <div style={{ background:'white', padding:'20px 20px 16px', borderBottom:'1px solid #EBEBEB' }}>
        <p style={{ fontSize:'13px', color:'#9CA3AF', fontWeight:500, margin:0 }}>¡Hola, {user.nombre}! 👋</p>
        <p style={{ fontSize:'15px', color:'#6B7280', margin:'2px 0 0', fontWeight:500 }}>¿Qué te provoca hoy?</p>
      </div>
      <div style={{ padding:'20px 16px 0' }}>
        <p style={{ fontSize:'11px', fontWeight:800, letterSpacing:'0.8px', color:'#9CA3AF', textTransform:'uppercase', marginBottom:'12px' }}>Elige tu restaurante</p>
        <div onClick={() => selectMarca('AREPA')} style={{ borderRadius:'20px', cursor:'pointer', marginBottom:'12px', background:'linear-gradient(135deg,#C41E3A,#E63946)', boxShadow:'0 4px 20px rgba(196,30,58,0.3)', padding:'20px', display:'flex', alignItems:'center', gap:'14px' }}>
          <img src="/logos/logo-arepa.png" style={{ width:'60px', height:'60px', borderRadius:'16px', objectFit:'cover', flexShrink:0, boxShadow:'0 4px 12px rgba(0,0,0,0.2)' }} alt="Arepa Lovers" />
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'22px', fontWeight:800, color:'white' }}>Arepa Lovers</div>
            <div style={{ color:'rgba(255,255,255,0.7)', fontSize:'13px', marginTop:'2px' }}>Comida venezolana auténtica</div>
            <div style={{ background:'rgba(255,255,255,0.18)', color:'white', fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'999px', marginTop:'6px', display:'inline-block' }}>⭐ 4.8 · 1,199 pedidos</div>
          </div>
          <span style={{ color:'rgba(255,255,255,0.5)', fontSize:'24px' }}>›</span>
        </div>
        <div onClick={() => selectMarca('SMASH')} style={{ borderRadius:'20px', cursor:'pointer', marginBottom:'24px', background:'linear-gradient(135deg,#0052CC,#0066FF)', boxShadow:'0 4px 20px rgba(0,82,204,0.3)', padding:'20px', display:'flex', alignItems:'center', gap:'14px' }}>
          <img src="/logos/logo-smash.png" style={{ width:'60px', height:'60px', borderRadius:'16px', objectFit:'cover', flexShrink:0, boxShadow:'0 4px 12px rgba(0,0,0,0.2)' }} alt="Smash Lovers" />
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'22px', fontWeight:800, color:'white' }}>Smash Lovers</div>
            <div style={{ color:'rgba(255,255,255,0.7)', fontSize:'13px', marginTop:'2px' }}>Smash burgers de autor</div>
            <div style={{ background:'rgba(255,255,255,0.18)', color:'white', fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'999px', marginTop:'6px', display:'inline-block' }}>🆕 Nuevo · Lanzamiento</div>
          </div>
          <span style={{ color:'rgba(255,255,255,0.5)', fontSize:'24px' }}>›</span>
        </div>

        {topArepa.length > 0 && (
          <div style={{ marginBottom:'24px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <div style={{ width:'28px', height:'28px', background:'#C41E3A', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px' }}>🫓</div>
                <span style={{ fontSize:'13px', fontWeight:800, color:'#1A1A1A' }}>Los más pedidos · Arepa Lovers</span>
              </div>
              <span onClick={() => selectMarca('AREPA')} style={{ fontSize:'12px', color:'#C41E3A', fontWeight:700, cursor:'pointer' }}>Ver todo ›</span>
            </div>
            <TopRow items={topArepa} color="#C41E3A" onTap={() => selectMarca('AREPA')} />
          </div>
        )}

        {topSmash.length > 0 && (
          <div style={{ marginBottom:'24px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <div style={{ width:'28px', height:'28px', background:'#0052CC', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px' }}>🍔</div>
                <span style={{ fontSize:'13px', fontWeight:800, color:'#1A1A1A' }}>Los más pedidos · Smash Lovers</span>
              </div>
              <span onClick={() => selectMarca('SMASH')} style={{ fontSize:'12px', color:'#0052CC', fontWeight:700, cursor:'pointer' }}>Ver todo ›</span>
            </div>
            <TopRow items={topSmash} color="#0052CC" onTap={() => selectMarca('SMASH')} />
          </div>
        )}

        <p style={{ textAlign:'center', fontSize:'12px', color:'#9CA3AF', margin:'0 0 12px' }}>💰 Gana Puntos Lovers con cada pedido · RD$10 = 1 punto</p>
        <button onClick={() => { localStorage.clear(); router.push('/auth/login') }} style={{ display:'block', margin:'0 auto', background:'none', border:'none', color:'#D1D5DB', fontSize:'12px', cursor:'pointer', fontFamily:'var(--font-body)' }}>Cerrar sesión</button>
      </div>
    </main>
  )
}
