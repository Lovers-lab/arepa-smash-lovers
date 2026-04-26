'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loadActiveOrdersFromCloud } from '@/lib/utils/cart'

type Marca = 'AREPA' | 'SMASH'
interface TopProduct { id: string; nombre: string; precio: number; foto_url: string | null; descuento_pct: number; es_destacado: boolean; marca: Marca }

function formatRD(n: number) { return `RD$${n.toLocaleString('es-DO')}` }

function TopRow({ items, color, onTap }: { items: TopProduct[]; color: string; onTap: () => void }) {
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
            <div style={{ display:'flex', alignItems:'baseline', gap:'5px', marginTop:'4px' }}>
              <div style={{ fontSize:'13px', fontWeight:900, color }}>{p.descuento_pct > 0 ? formatRD(Math.round(p.precio * (1 - p.descuento_pct/100))) : formatRD(p.precio)}</div>
              {p.descuento_pct > 0 && <div style={{ fontSize:'11px', fontWeight:600, color:'#9CA3AF', textDecoration:'line-through' }}>{formatRD(p.precio)}</div>}
            </div>
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
  const [heroArepa, setHeroArepa] = useState<string>('')
  const [heroSmash, setHeroSmash] = useState<string>('')
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [appInstalled, setAppInstalled] = useState(false)
  const [installDismissed, setInstallDismissed] = useState(false)
  const [activeOrders, setActiveOrders] = useState<any[]>([])

  useEffect(() => {
    const stored = localStorage.getItem('lovers_user')
    if (!stored) { router.replace('/auth/login'); return }
    const u = JSON.parse(stored)
    setUser(u)
    loadData()
    loadActiveOrders(u.id)
    // App install
    if (typeof window !== 'undefined') {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setAppInstalled(true)
      }
      const dismissed = localStorage.getItem('install_dismissed')
      if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) {
        setInstallDismissed(true)
      }
      const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e) }
      window.addEventListener('beforeinstallprompt', handler)
      window.addEventListener('appinstalled', async () => {
        setAppInstalled(true); setInstallPrompt(null)
        const stored = localStorage.getItem('lovers_user')
        if (stored) {
          const u = JSON.parse(stored)
          const res = await fetch('/api/app-install', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: u.id, marca: localStorage.getItem('lovers_marca') || 'AREPA', accion: 'install' })
          })
          const data = await res.json()
          if (data.cupon) alert('Tu cupon de RD$100 ya esta en tu billetera')
        }
      })
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(loadActiveOrders, 10000)
    return () => clearInterval(interval)
  }, [])

  async function loadActiveOrders() {
    try {
      const raw = localStorage.getItem('lovers_active_orders')
      if (!raw) { setActiveOrders([]); return }
      const orders = JSON.parse(raw)
      if (!orders.length) { setActiveOrders([]); return }
      // Actualizar estados desde Supabase
      const ids = orders.map((o: any) => o.id)
      const { data } = await supabase.from('orders').select('id, numero_pedido, estado, marca').in('id', ids)
      if (!data) return
      // Filtrar entregados/cancelados
      const updated = orders.map((o: any) => {
        const fresh = data.find((d: any) => d.id === o.id)
        return fresh ? { ...o, estado: fresh.estado, numero: fresh.numero_pedido } : o
      }).filter((o: any) => o.estado !== 'ENTREGADO' && o.estado !== 'CANCELADO')
      localStorage.setItem('lovers_active_orders', JSON.stringify(updated))
      setActiveOrders(updated)
    } catch { setActiveOrders([]) }
  }

  async function loadData() {
    const [{ data: prods }, { data: sA }, { data: sS }] = await Promise.all([
      supabase.from('products').select('id, nombre, precio, foto_url, descuento_pct, es_destacado, marca').eq('activo', true).or('es_destacado.eq.true,descuento_pct.gt.0').order('es_destacado', { ascending: false }).order('descuento_pct', { ascending: false }).limit(12),
      supabase.from('app_settings').select('hero_img_url').eq('marca', 'AREPA').single(),
      supabase.from('app_settings').select('hero_img_url').eq('marca', 'SMASH').single(),
    ])
    if (prods) {
      setTopArepa(prods.filter((p: any) => p.marca === 'AREPA').slice(0, 6) as TopProduct[])
      setTopSmash(prods.filter((p: any) => p.marca === 'SMASH').slice(0, 6) as TopProduct[])
    }
    if (sA?.hero_img_url) setHeroArepa(sA.hero_img_url)
    if (sS?.hero_img_url) setHeroSmash(sS.hero_img_url)
  }

  async function installApp() {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'dismissed') {
      localStorage.setItem('install_dismissed', String(Date.now()))
      setInstallDismissed(true)
    }
    setInstallPrompt(null)
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

        {/* AREPA CARD */}
        <div onClick={() => selectMarca('AREPA')} style={{ borderRadius:'20px', cursor:'pointer', marginBottom:'12px', background:'linear-gradient(135deg,#C41E3A,#E63946)', boxShadow:'0 4px 20px rgba(196,30,58,0.3)', padding:'20px', display:'flex', alignItems:'center', gap:'14px', position:'relative', overflow:'hidden' }}>
          <img src="/logos/logo-arepa.png" style={{ width:'60px', height:'60px', borderRadius:'16px', objectFit:'cover', flexShrink:0, boxShadow:'0 4px 12px rgba(0,0,0,0.2)', position:'relative', zIndex:2 }} alt="Arepa Lovers" />
          <div style={{ flex:1, position:'relative', zIndex:2 }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'22px', fontWeight:800, color:'white' }}>Arepa Lovers</div>
            <div style={{ color:'rgba(255,255,255,0.7)', fontSize:'13px', marginTop:'2px' }}>Comida venezolana auténtica</div>
            <div style={{ background:'rgba(255,255,255,0.18)', color:'white', fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'999px', marginTop:'6px', display:'inline-block' }}>⭐ 4.8 · 1,199 pedidos</div>
          </div>
          <span style={{ color:'rgba(255,255,255,0.5)', fontSize:'24px', position:'relative', zIndex:2 }}>›</span>
          {heroArepa && <img src={heroArepa} alt="" style={{ position:'absolute', right:'-8px', bottom:'-8px', height:'115px', objectFit:'contain', pointerEvents:'none', zIndex:1, filter:'drop-shadow(0 4px 16px rgba(0,0,0,0.3))' }} />}
        </div>

        {/* SMASH CARD */}
        <div onClick={() => selectMarca('SMASH')} style={{ borderRadius:'20px', cursor:'pointer', marginBottom:'24px', background:'linear-gradient(135deg,#0052CC,#0066FF)', boxShadow:'0 4px 20px rgba(0,82,204,0.3)', padding:'20px', display:'flex', alignItems:'center', gap:'14px', position:'relative', overflow:'hidden' }}>
          <img src="/logos/logo-smash.png" style={{ width:'60px', height:'60px', borderRadius:'16px', objectFit:'cover', flexShrink:0, boxShadow:'0 4px 12px rgba(0,0,0,0.2)', position:'relative', zIndex:2 }} alt="Smash Lovers" />
          <div style={{ flex:1, position:'relative', zIndex:2 }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'22px', fontWeight:800, color:'white' }}>Smash Lovers</div>
            <div style={{ color:'rgba(255,255,255,0.7)', fontSize:'13px', marginTop:'2px' }}>Smash burgers de autor</div>
            <div style={{ background:'rgba(255,255,255,0.18)', color:'white', fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'999px', marginTop:'6px', display:'inline-block' }}>🆕 Nuevo · Lanzamiento</div>
          </div>
          <span style={{ color:'rgba(255,255,255,0.5)', fontSize:'24px', position:'relative', zIndex:2 }}>›</span>
          {heroSmash && <img src={heroSmash} alt="" style={{ position:'absolute', right:'-8px', bottom:'-8px', height:'115px', objectFit:'contain', pointerEvents:'none', zIndex:1, filter:'drop-shadow(0 4px 16px rgba(0,0,0,0.3))' }} />}
        </div>

        {/* PEDIDOS ACTIVOS */}
        {activeOrders.length > 0 && (
          <div style={{ marginBottom:'20px' }}>
            <p style={{ fontSize:'11px', fontWeight:800, letterSpacing:'0.8px', color:'#9CA3AF', textTransform:'uppercase', marginBottom:'10px' }}>📦 Pedidos activos</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {activeOrders.map((order: any) => {
                const bc = order.marca === 'SMASH' ? '#0052CC' : '#C41E3A'
                const estadoLabel: Record<string,string> = { PENDIENTE:'⏳ Esperando aprobación', PAGADO:'✅ Confirmado', EN_COCINA:'🍳 En cocina', LISTO:'✓ Listo para envío', ENVIO_SOLICITADO:'📍 Buscando repartidor', EN_CAMINO:'🛵 En camino', ENTREGADO:'🎉 Entregado', CANCELADO:'❌ Cancelado' }
                return (
                  <button key={order.id} onClick={() => router.push('/orders/' + order.id)}
                    style={{ width:'100%', padding:'14px 16px', borderRadius:'16px', border:'none', background:bc, cursor:'pointer', display:'flex', alignItems:'center', gap:'12px', boxShadow:'0 2px 12px ' + bc + '40' }}>
                    <span style={{ fontSize:'22px' }}>{order.marca === 'SMASH' ? '🍔' : '🫓'}</span>
                    <div style={{ flex:1, textAlign:'left' }}>
                      <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'14px', color:'white', margin:'0 0 2px' }}>Pedido #{order.numero}</p>
                      <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.8)', margin:0 }}>{estadoLabel[order.estado] || order.estado} · Toca para ver</p>
                    </div>
                    <span style={{ fontSize:'18px', color:'rgba(255,255,255,0.6)' }}>›</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* INSTALL CARD */}
        {installPrompt && !appInstalled && !installDismissed && (
          <div style={{
            marginBottom:'20px', borderRadius:'20px', overflow:'hidden', position:'relative',
            background:'linear-gradient(135deg, #FFF9E6 0%, #FFF3CC 100%)',
            border:'1.5px solid #FFE082', boxShadow:'0 2px 16px rgba(255,193,7,0.15)'
          }}>
            <style>{`
              @keyframes pulse-gift { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
              .gift-icon { animation: pulse-gift 2s ease-in-out infinite }
            `}</style>
            <div style={{ padding:'16px', display:'flex', alignItems:'center', gap:'14px' }}>
              <div className="gift-icon" style={{ fontSize:'36px', flexShrink:0 }}>🎁</div>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'15px', color:'#1A1A1A' }}>
                  Instala y gana RD$100
                </div>
                <div style={{ fontSize:'12px', color:'#92400E', marginTop:'2px', fontWeight:500 }}>
                  Cupon valido en tu proxima compra · Solo por instalar la app
                </div>
                <div style={{ display:'flex', gap:'8px', marginTop:'10px' }}>
                  <button onClick={installApp} style={{
                    padding:'9px 20px', borderRadius:'999px', border:'none',
                    background:'linear-gradient(135deg,#F59E0B,#D97706)',
                    color:'white', fontSize:'13px', fontWeight:800, cursor:'pointer',
                    boxShadow:'0 3px 12px rgba(245,158,11,0.4)'
                  }}>
                    Instalar gratis
                  </button>
                  <button onClick={() => { localStorage.setItem('install_dismissed', String(Date.now())); setInstallDismissed(true) }}
                    style={{ padding:'9px 14px', borderRadius:'999px', border:'none', background:'rgba(0,0,0,0.06)', color:'#92400E', fontSize:'12px', fontWeight:600, cursor:'pointer' }}>
                    Ahora no
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
