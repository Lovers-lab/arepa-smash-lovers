'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'
const supabase = createClient()
function formatRD(n: number) { return 'RD$' + (n||0).toLocaleString('es-DO') }

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loyalty, setLoyalty] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([])
  const [referralCode, setReferralCode] = useState('')
  const [referralStats, setReferralStats] = useState({ usos: 0, credito: 0 })
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'historial'|'pedidos'|'cupones'|'referidos'>('historial')
  const [brandColor, setBrandColor] = useState('#C41E3A')
  const [copied, setCopied] = useState<string|null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('lovers_user')
    if (!stored) { router.replace('/auth/login'); return }
    const u = JSON.parse(stored)
    setUser(u)
    const marca = localStorage.getItem('lovers_marca')
    setBrandColor(marca === 'SMASH' ? '#0052CC' : '#C41E3A')
    loadAll(u.id)
  }, [])

  async function loadAll(userId: string) {
    setLoading(true)
    const [
      { data: loy },
      { data: txs },
      { data: orders },
      { data: refCode },
      { data: coupons },
    ] = await Promise.all([
      supabase.from('loyalty_balances').select('*').eq('user_id', userId).single(),
      supabase.from('loyalty_transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
      supabase.from('orders').select('id, numero_pedido, estado, marca, total_pagado, fecha_orden').eq('user_id', userId).order('fecha_orden', { ascending: false }).limit(15),
      supabase.from('referral_codes').select('codigo, usos, credito_acumulado').eq('user_id', userId).single(),
      supabase.from('user_coupons').select('*, coupon:coupons(*)').eq('user_id', userId).eq('usado', false).order('created_at', { ascending: false }),
    ])
    setLoyalty(loy)
    setTransactions(txs || [])
    setRecentOrders(orders || [])
    setAvailableCoupons(coupons || [])
    if (refCode) {
      setReferralCode(refCode.codigo)
      setReferralStats({ usos: refCode.usos || 0, credito: refCode.credito_acumulado || 0 })
    } else {
      const code = userId.substring(0, 6).toUpperCase()
      const { data: newCode } = await supabase.from('referral_codes')
        .insert({ user_id: userId, codigo: code, usos: 0, credito_acumulado: 0 })
        .select('codigo').single()
      if (newCode) setReferralCode(newCode.codigo)
    }
    setLoading(false)
  }

  function copyCode(code: string, key: string) {
    navigator.clipboard.writeText(code)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const estadoColor: Record<string,string> = {
    PENDIENTE:'#F59E0B', CONFIRMADO:'#3B82F6', EN_COCINA:'#8B5CF6',
    LISTO:'#10B981', EN_CAMINO:'#0EA5E9', ENTREGADO:'#10B981', CANCELADO:'#EF4444'
  }
  const estadoLabel: Record<string,string> = {
    PENDIENTE:'Pendiente', CONFIRMADO:'Confirmado', EN_COCINA:'🍳 En cocina',
    LISTO:'✓ Listo', EN_CAMINO:'🛵 En camino', ENTREGADO:'✅ Entregado', CANCELADO:'❌ Cancelado'
  }

  if (loading) return (
    <div style={{ minHeight:'100dvh', background:'#F7F8FA', display:'flex', flexDirection:'column' }}>
      <div style={{ background:brandColor, padding:'24px 20px 60px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', right:'-30px', top:'-30px', width:'160px', height:'160px', borderRadius:'50%', background:'rgba(255,255,255,0.08)' }} />
        <button onClick={() => router.back()} style={{ width:'36px', height:'36px', borderRadius:'50%', border:'none', background:'rgba(255,255,255,0.2)', cursor:'pointer', fontSize:'20px', color:'white', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'16px' }}>‹</button>
        <p style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'22px', color:'white', margin:0 }}>Mi cuenta</p>
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', paddingTop:'60px' }}>
        <p style={{ color:'#9CA3AF', fontFamily:'var(--font-body)' }}>Cargando...</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100dvh', background:'#F7F8FA', paddingBottom:'40px', fontFamily:'var(--font-body)' }}>
      <style>{`
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes ripple-anim{to{transform:scale(4);opacity:0}}
        .rpl{position:relative;overflow:hidden;}
      `}</style>

      {/* HEADER ROJO */}
      <div style={{ background:brandColor, padding:'20px 20px 56px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', right:'-40px', top:'-40px', width:'200px', height:'200px', borderRadius:'50%', background:'rgba(255,255,255,0.07)' }} />
        <div style={{ position:'absolute', left:'-20px', bottom:'-20px', width:'120px', height:'120px', borderRadius:'50%', background:'rgba(255,255,255,0.05)' }} />
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px', position:'relative', zIndex:1 }}>
          <button onClick={() => router.back()} style={{ width:'36px', height:'36px', borderRadius:'50%', border:'none', background:'rgba(255,255,255,0.2)', cursor:'pointer', fontSize:'20px', color:'white', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
          <button onClick={() => { localStorage.clear(); router.push('/auth/login') }}
            style={{ padding:'6px 14px', borderRadius:'999px', border:'1.5px solid rgba(255,255,255,0.4)', background:'transparent', fontSize:'12px', fontWeight:700, color:'rgba(255,255,255,0.9)', cursor:'pointer' }}>
            Salir
          </button>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'14px', position:'relative', zIndex:1 }}>
          <div style={{ width:'52px', height:'52px', borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'22px', color:'white', flexShrink:0, border:'2px solid rgba(255,255,255,0.3)' }}>
            {user?.nombre?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'20px', color:'white', margin:'0 0 2px' }}>{user?.nombre}</p>
            <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.7)', margin:0 }}>📱 {user?.whatsapp}</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:'520px', margin:'0 auto', padding:'0 16px' }}>

        {/* CARD PUNTOS — flota sobre el header */}
        <div style={{ margin:'-36px 0 16px', background:'white', borderRadius:'24px', padding:'20px', boxShadow:'0 8px 32px rgba(0,0,0,0.12)', position:'relative', zIndex:2 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
            <div>
              <p style={{ fontSize:'11px', color:'#9CA3AF', margin:'0 0 4px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px' }}>Puntos Lovers</p>
              <p style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'42px', color:brandColor, margin:0, lineHeight:1 }}>{loyalty?.saldo || 0}</p>
              <p style={{ fontSize:'12px', color:'#9CA3AF', margin:'4px 0 0' }}>= {formatRD(loyalty?.saldo || 0)} en descuentos</p>
            </div>
            <div style={{ fontSize:'52px', animation:'float 3s ease-in-out infinite', flexShrink:0 }}>🪙</div>
          </div>
          <div style={{ borderTop:'1px solid #F3F4F6', paddingTop:'14px', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px' }}>
            {[
              { val: loyalty?.total_ganado || 0, label:'pts ganados' },
              { val: loyalty?.total_gastado || 0, label:'pts usados' },
              { val: loyalty?.total_compras || 0, label:'pedidos' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign:'center', padding:'10px 4px', background:'#F7F8FA', borderRadius:'12px' }}>
                <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'18px', color:'#0D0F12', margin:'0 0 2px' }}>{s.val}</p>
                <p style={{ fontSize:'10px', color:'#9CA3AF', margin:0 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* REGLA DE PUNTOS */}
        <div style={{ background:'white', borderRadius:'16px', border:'1px solid #F3F4F6', padding:'12px 16px', marginBottom:'16px', display:'flex', alignItems:'center', gap:'12px' }}>
          <span style={{ fontSize:'20px', flexShrink:0 }}>📐</span>
          <p style={{ fontSize:'13px', color:'#6B7280', margin:0, lineHeight:1.5 }}>
            Por cada <strong style={{ color:'#0D0F12' }}>RD$10</strong> que gastas ganas <strong style={{ color:brandColor }}>1 Punto Lover</strong>. Cada punto equivale a <strong style={{ color:'#0D0F12' }}>RD$1</strong>.
          </p>
        </div>

        {/* TABS */}
        <div style={{ display:'flex', gap:'6px', marginBottom:'14px', overflowX:'auto', paddingBottom:'2px' }}>
          {([
            { k:'historial', l:'💰 Historial' },
            { k:'pedidos',   l:'📦 Pedidos' },
            { k:'cupones',   l:'🎟 Cupones' },
            { k:'referidos', l:'👥 Referidos' },
          ] as const).map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              style={{ padding:'10px 16px', borderRadius:'999px', border:'none', background:tab===t.k?brandColor:'white', color:tab===t.k?'white':'#6B7280', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'12px', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, boxShadow:tab===t.k?'none':'0 1px 4px rgba(0,0,0,0.08)', transition:'all 0.2s' }}>
              {t.l}
            </button>
          ))}
        </div>

        {/* TAB: HISTORIAL */}
        {tab === 'historial' && (
          <div style={{ background:'white', borderRadius:'20px', border:'1px solid #F3F4F6', overflow:'hidden' }}>
            {transactions.length === 0 ? (
              <div style={{ padding:'48px 20px', textAlign:'center', color:'#9CA3AF' }}>
                <p style={{ fontSize:'40px', margin:'0 0 8px' }}>💰</p>
                <p style={{ fontWeight:600, fontSize:'14px', margin:0 }}>Haz tu primer pedido para ganar puntos</p>
              </div>
            ) : transactions.map((tx, idx) => (
              <div key={tx.id} style={{ padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:idx < transactions.length-1?'1px solid #F9FAFB':'none' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  <div style={{ width:'40px', height:'40px', borderRadius:'12px', background: tx.tipo==='GANADO'?'#DCFCE7':'#EDE9FE', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0 }}>
                    {tx.tipo === 'GANADO' ? '💰' : '🛒'}
                  </div>
                  <div>
                    <p style={{ fontSize:'13px', fontWeight:600, color:'#0D0F12', margin:'0 0 2px' }}>{tx.descripcion}</p>
                    <p style={{ fontSize:'11px', color:'#9CA3AF', margin:0 }}>
                      {new Date(tx.created_at).toLocaleDateString('es-DO', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'15px', color: tx.tipo==='GANADO'?'#15803D':'#7C3AED', margin:'0 0 2px' }}>
                    {tx.tipo === 'GANADO' ? '+' : '−'}{tx.puntos} pts
                  </p>
                  <p style={{ fontSize:'11px', color:'#9CA3AF', margin:0 }}>Saldo: {tx.saldo_resultante} pts</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB: PEDIDOS */}
        {tab === 'pedidos' && (
          <div style={{ background:'white', borderRadius:'20px', border:'1px solid #F3F4F6', overflow:'hidden' }}>
            {recentOrders.length === 0 ? (
              <div style={{ padding:'48px 20px', textAlign:'center', color:'#9CA3AF' }}>
                <p style={{ fontSize:'40px', margin:'0 0 8px' }}>📦</p>
                <p style={{ fontWeight:600, fontSize:'14px', margin:0 }}>No tienes pedidos aún</p>
              </div>
            ) : recentOrders.map((order, idx) => (
              <button key={order.id} onClick={() => router.push('/orders/' + order.id)} className="rpl"
                style={{ width:'100%', padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', background:'none', border:'none', cursor:'pointer', borderBottom:idx < recentOrders.length-1?'1px solid #F9FAFB':'none', textAlign:'left' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:order.marca==='AREPA'?'#FEE2E2':'#DBEAFE', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', flexShrink:0 }}>
                    {order.marca === 'AREPA' ? '🫓' : '🍔'}
                  </div>
                  <div>
                    <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'14px', color:'#0D0F12', margin:'0 0 4px' }}>Pedido #{order.numero_pedido}</p>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                      <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'999px', background:(estadoColor[order.estado]||'#9CA3AF')+'20', color:estadoColor[order.estado]||'#9CA3AF' }}>
                        {estadoLabel[order.estado] || order.estado}
                      </span>
                      <span style={{ fontSize:'11px', color:'#9CA3AF' }}>
                        {new Date(order.fecha_orden).toLocaleDateString('es-DO', { day:'numeric', month:'short' })}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'15px', color:'#0D0F12', margin:'0 0 2px' }}>{formatRD(order.total_pagado)}</p>
                  <p style={{ fontSize:'11px', color:'#9CA3AF', margin:0 }}>Ver →</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* TAB: CUPONES */}
        {tab === 'cupones' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {availableCoupons.length === 0 ? (
              <div style={{ background:'white', borderRadius:'20px', border:'1.5px dashed #E4E6EA', padding:'48px 20px', textAlign:'center', color:'#9CA3AF' }}>
                <p style={{ fontSize:'40px', margin:'0 0 8px' }}>🎟</p>
                <p style={{ fontWeight:600, fontSize:'14px', margin:'0 0 4px', color:'#6B7280' }}>Sin cupones disponibles</p>
                <p style={{ fontSize:'12px', margin:0 }}>Instala la app o haz pedidos para ganar cupones</p>
              </div>
            ) : availableCoupons.map((uc: any) => (
              <div key={uc.id} style={{ background:'white', borderRadius:'20px', border:'1px solid #E4E6EA', padding:'20px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'14px' }}>
                  <div>
                    <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'24px', color:brandColor, margin:'0 0 2px' }}>{formatRD(uc.coupon?.valor)}</p>
                    <p style={{ fontSize:'12px', color:'#9CA3AF', margin:0 }}>{uc.coupon?.descripcion}</p>
                  </div>
                  <div style={{ background:brandColor+'15', borderRadius:'10px', padding:'6px 12px', textAlign:'center' }}>
                    <p style={{ fontSize:'10px', fontWeight:700, color:brandColor, margin:'0 0 2px' }}>Min. compra</p>
                    <p style={{ fontSize:'13px', fontWeight:800, color:brandColor, margin:0 }}>{formatRD(uc.coupon?.minimo_compra || 0)}</p>
                  </div>
                </div>
                <div style={{ background:'#F7F8FA', border:'2px dashed #E4E6EA', borderRadius:'12px', padding:'10px 14px', display:'flex', alignItems:'center', gap:'10px' }}>
                  <span style={{ fontFamily:'var(--font-display)', fontSize:'16px', fontWeight:800, color:'#374151', letterSpacing:'2px', flex:1 }}>{uc.coupon?.codigo}</span>
                  <button onClick={() => copyCode(uc.coupon?.codigo, uc.id)}
                    style={{ padding:'8px 14px', borderRadius:'8px', border:'none', background:copied===uc.id?'#10B981':brandColor, color:'white', fontWeight:700, fontSize:'12px', cursor:'pointer', flexShrink:0, transition:'background 0.2s' }}>
                    {copied === uc.id ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>
                {uc.coupon?.expira_at && (
                  <p style={{ fontSize:'11px', color:'#9CA3AF', margin:'8px 0 0' }}>
                    Vence: {new Date(uc.coupon.expira_at).toLocaleDateString('es-DO')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TAB: REFERIDOS */}
        {tab === 'referidos' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              <div style={{ background:'white', borderRadius:'16px', border:'1px solid #E4E6EA', padding:'16px', textAlign:'center' }}>
                <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'28px', color:'#7C3AED', margin:'0 0 4px' }}>{referralStats.usos}</p>
                <p style={{ fontSize:'12px', color:'#9CA3AF', margin:0 }}>Amigos referidos</p>
              </div>
              <div style={{ background:'white', borderRadius:'16px', border:'1px solid #E4E6EA', padding:'16px', textAlign:'center' }}>
                <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'28px', color:'#15803D', margin:'0 0 4px' }}>{referralStats.credito}</p>
                <p style={{ fontSize:'12px', color:'#9CA3AF', margin:0 }}>Puntos ganados</p>
              </div>
            </div>
            <div style={{ background:'white', borderRadius:'20px', border:'1px solid #E4E6EA', padding:'20px' }}>
              <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'16px', margin:'0 0 14px' }}>Tu código de referido</p>
              <div style={{ background:'#F7F8FA', border:'2px dashed #E4E6EA', borderRadius:'14px', padding:'14px 16px', display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
                <span style={{ fontFamily:'var(--font-display)', fontSize:'22px', fontWeight:800, color:'#7C3AED', letterSpacing:'3px', flex:1, textAlign:'center' }}>{referralCode || '...'}</span>
                <button onClick={() => copyCode(referralCode, 'ref')}
                  style={{ padding:'10px 18px', borderRadius:'10px', border:'none', background:copied==='ref'?'#10B981':'#7C3AED', color:'white', fontWeight:700, fontSize:'13px', cursor:'pointer', flexShrink:0, transition:'background 0.2s' }}>
                  {copied === 'ref' ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
              <div style={{ background:'#F5F3FF', borderRadius:'12px', padding:'12px 14px', fontSize:'13px', color:'#7C3AED', lineHeight:1.6 }}>
                🎁 Tu amigo recibe el regalo de bienvenida · Tú recibes <strong>100 Puntos Lovers</strong> (= RD$100) cuando complete su primera compra.
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
