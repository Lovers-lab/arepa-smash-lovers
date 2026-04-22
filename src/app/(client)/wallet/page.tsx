'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
function formatRD(n: number) { return `RD$${n.toLocaleString('es-DO')}` }

export default function WalletPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loyalty, setLoyalty] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [referralCode, setReferralCode] = useState('')
  const [referralStats, setReferralStats] = useState({ usos: 0, credito: 0 })
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'puntos' | 'cupones' | 'referidos'>('puntos')
  const [brandColor, setBrandColor] = useState('#C41E3A')
  const [copied, setCopied] = useState<string | null>(null)

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
      { data: refCode },
      { data: refStats },
      { data: coupons },
    ] = await Promise.all([
      supabase.from('loyalty_balances').select('*').eq('user_id', userId).single(),
      supabase.from('loyalty_transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
      supabase.from('referral_codes').select('codigo, usos, credito_acumulado').eq('user_id', userId).single(),
      supabase.from('referral_codes').select('usos, credito_acumulado').eq('user_id', userId).single(),
      supabase.from('influencer_codes').select('*').eq('activo', true).limit(5),
    ])

    setLoyalty(loy)
    setTransactions(txs || [])

    if (refCode) {
      setReferralCode(refCode.codigo)
      setReferralStats({ usos: refStats?.usos || 0, credito: refStats?.credito_acumulado || 0 })
    } else {
      const code = userId.substring(0, 6).toUpperCase()
      const { data: newCode } = await supabase.from('referral_codes')
        .insert({ user_id: userId, codigo: code, usos: 0, credito_acumulado: 0 })
        .select('codigo').single()
      if (newCode) setReferralCode(newCode.codigo)
    }

    // Build available coupons list
    const cups = []
    // Referral coupon
    if (referralCode || refCode?.codigo) {
      cups.push({
        id: 'referral',
        tipo: 'REFERIDO',
        codigo: refCode?.codigo || userId.substring(0, 6).toUpperCase(),
        descripcion: 'Comparte y gana 100 pts por cada amigo',
        icono: '👥',
        color: '#7C3AED',
        bg: '#EDE9FE',
      })
    }
    setAvailableCoupons(cups)
    setLoading(false)
  }

  function copyCode(code: string, id: string) {
    navigator.clipboard.writeText(code)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const brandLogo = "/logos/logo-arepa.png"

  if (loading) return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F7F8FA' }}>
      <p style={{ color:'#9CA3AF', fontFamily:'var(--font-body)' }}>Cargando billetera...</p>
    </div>
  )

  return (
    <div style={{ minHeight:'100dvh', background:'#F7F8FA', paddingBottom:'32px', fontFamily:'var(--font-body)' }}>
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`}</style>

      {/* HEADER */}
      <header style={{ background:'white', borderBottom:'1px solid #E4E6EA', position:'sticky', top:0, zIndex:20, boxShadow:'0 1px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth:'520px', margin:'0 auto', padding:'14px 16px', display:'flex', alignItems:'center', gap:'12px' }}>
          <button onClick={() => router.back()}
            style={{ width:'38px', height:'38px', borderRadius:'50%', background:'#F3F4F6', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', color:'#6B7280' }}>‹</button>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <span style={{ fontSize:'22px' }}>💰</span>
            <h1 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'20px', margin:0 }}>Mi Billetera</h1>
          </div>
          <button onClick={() => router.push('/menu')}
            style={{ marginLeft:'auto', padding:'8px 16px', borderRadius:'999px', border:'none', background:brandColor, color:'white', fontSize:'12px', fontWeight:700, cursor:'pointer' }}>
            Pedir ahora
          </button>
        </div>
      </header>

      <main style={{ maxWidth:'520px', margin:'0 auto', padding:'16px', display:'flex', flexDirection:'column', gap:'12px' }}>

        {/* HERO BALANCE */}
        <div style={{ borderRadius:'24px', padding:'28px 24px', background:`linear-gradient(135deg, ${brandColor} 0%, ${brandColor}DD 100%)`, position:'relative', overflow:'hidden', boxShadow:`0 8px 32px ${brandColor}40` }}>
          <div style={{ position:'absolute', width:'180px', height:'180px', borderRadius:'50%', background:'rgba(255,255,255,0.06)', top:'-50px', right:'-50px' }} />
          <div style={{ position:'absolute', width:'100px', height:'100px', borderRadius:'50%', background:'rgba(255,255,255,0.04)', bottom:'-20px', left:'20px' }} />

          <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'13px', fontWeight:600, margin:'0 0 6px', position:'relative', zIndex:1 }}>
            💰 Puntos Lovers disponibles
          </p>
          <div style={{ display:'flex', alignItems:'flex-end', gap:'8px', marginBottom:'4px', position:'relative', zIndex:1 }}>
            <span style={{ fontFamily:'var(--font-display)', fontSize:'56px', fontWeight:800, color:'white', lineHeight:1, letterSpacing:'-2px' }}>
              {loyalty?.saldo || 0}
            </span>
            <span style={{ color:'rgba(255,255,255,0.6)', fontSize:'15px', fontWeight:600, marginBottom:'8px' }}>pts</span>
          </div>
          <p style={{ color:'rgba(255,255,255,0.55)', fontSize:'13px', margin:'0 0 20px', position:'relative', zIndex:1 }}>
            = {formatRD(loyalty?.saldo || 0)} · 1 punto = RD$1
          </p>

          <div style={{ display:'flex', gap:'20px', paddingTop:'16px', borderTop:'1px solid rgba(255,255,255,0.15)', position:'relative', zIndex:1 }}>
            {[
              { v: loyalty?.total_ganado || 0, l: 'Total ganado', u: 'pts' },
              { v: loyalty?.total_gastado || 0, l: 'Total usado', u: 'pts' },
              { v: loyalty?.total_compras || 0, l: 'Pedidos', u: '' },
            ].map(s => (
              <div key={s.l}>
                <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'18px', color:'white', margin:'0 0 2px' }}>{s.v}{s.u ? ` ${s.u}` : ''}</p>
                <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.55)', margin:0 }}>{s.l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* HOW IT WORKS */}
        <div style={{ background:'white', borderRadius:'16px', border:'1px solid #E4E6EA', padding:'14px 16px', display:'flex', alignItems:'center', gap:'12px' }}>
          <div style={{ width:'44px', height:'44px', borderRadius:'14px', background:`${brandColor}12`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', flexShrink:0 }}>📐</div>
          <div>
            <p style={{ fontWeight:700, fontSize:'14px', margin:'0 0 3px' }}>¿Cómo funciono mis puntos?</p>
            <p style={{ fontSize:'12px', color:'#6B7280', margin:0, lineHeight:1.5 }}>
              Por cada <strong>RD$10</strong> que gastas ganas <strong>1 Punto Lover</strong>. Cada punto vale <strong>RD$1</strong> y puedes usarlos en tu próximo pedido.
            </p>
          </div>
        </div>

        {/* TABS */}
        <div style={{ display:'flex', gap:'4px', background:'#F3F4F6', borderRadius:'14px', padding:'4px' }}>
          {([
            { k:'puntos', l:'💰 Historial' },
            { k:'cupones', l:'🎟 Cupones' },
            { k:'referidos', l:'👥 Referidos' },
          ] as const).map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              style={{ flex:1, padding:'10px 8px', borderRadius:'10px', border:'none', fontSize:'12px', fontWeight:700, cursor:'pointer', transition:'all 0.2s', fontFamily:'var(--font-body)', background:tab===t.k?'white':'transparent', color:tab===t.k?'#0D0F12':'#9CA3AF', boxShadow:tab===t.k?'0 1px 4px rgba(0,0,0,0.08)':'none' }}>
              {t.l}
            </button>
          ))}
        </div>

        {/* ===== PUNTOS TAB ===== */}
        {tab === 'puntos' && (
          <div style={{ background:'white', borderRadius:'16px', border:'1px solid #E4E6EA', overflow:'hidden' }}>
            {transactions.length === 0 ? (
              <div style={{ padding:'48px 20px', textAlign:'center', color:'#9CA3AF' }}>
                <p style={{ fontSize:'40px', marginBottom:'8px' }}>💰</p>
                <p style={{ fontWeight:600, fontSize:'15px' }}>Aún no tienes movimientos</p>
                <p style={{ fontSize:'13px', marginTop:'4px' }}>Haz tu primer pedido para empezar a ganar puntos</p>
                <button onClick={() => router.push('/menu')}
                  style={{ marginTop:'16px', padding:'12px 24px', borderRadius:'999px', border:'none', background:brandColor, color:'white', fontWeight:700, fontSize:'14px', cursor:'pointer' }}>
                  Ver menú
                </button>
              </div>
            ) : (
              transactions.map((tx, idx) => (
                <div key={tx.id} style={{ padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:idx<transactions.length-1?'1px solid #F3F4F6':'none' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                    <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:tx.tipo==='GANADO'?'#DCFCE7':'#EDE9FE', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px' }}>
                      {tx.tipo === 'GANADO' ? '💰' : '🛒'}
                    </div>
                    <div>
                      <p style={{ fontWeight:600, fontSize:'13px', color:'#0D0F12', margin:'0 0 2px' }}>{tx.descripcion}</p>
                      <p style={{ fontSize:'11px', color:'#9CA3AF', margin:0 }}>
                        {new Date(tx.created_at).toLocaleDateString('es-DO', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'16px', color:tx.tipo==='GANADO'?'#15803D':'#7C3AED', margin:'0 0 2px' }}>
                      {tx.tipo === 'GANADO' ? '+' : '−'}{tx.puntos} pts
                    </p>
                    <p style={{ fontSize:'11px', color:'#9CA3AF', margin:0 }}>Saldo: {tx.saldo_resultante} pts</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ===== CUPONES TAB ===== */}
        {tab === 'cupones' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {/* Gift first order */}
            <div style={{ background:'linear-gradient(135deg, #FFFBEB, #FEF3C7)', border:'1px solid #FDE68A', borderRadius:'20px', padding:'20px', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', right:'-20px', top:'-20px', fontSize:'80px', opacity:0.15 }}>🎁</div>
              <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px' }}>
                <span style={{ fontSize:'28px' }}>🎁</span>
                <div>
                  <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'16px', color:'#92400E', margin:0 }}>Regalo de Bienvenida</p>
                  <p style={{ fontSize:'12px', color:'#B45309', margin:'3px 0 0' }}>Primera compra con plato fuerte</p>
                </div>
              </div>
              <div style={{ background:'white', borderRadius:'12px', padding:'12px 14px' }}>
                <p style={{ fontSize:'13px', color:'#92400E', margin:0, lineHeight:1.5 }}>
                  🫓 <strong>Arepa Lovers:</strong> Tequeños gratis en tu primera compra<br/>
                  🍔 <strong>Smash Lovers:</strong> Papas gratis en tu primera compra
                </p>
              </div>
              <div style={{ marginTop:'10px', display:'inline-flex', alignItems:'center', gap:'6px', background:'#F59E0B', color:'white', padding:'6px 14px', borderRadius:'999px', fontSize:'12px', fontWeight:700 }}>
                ✓ Automático — no necesitas código
              </div>
            </div>

            {/* Referral coupon */}
            <div style={{ background:'white', borderRadius:'20px', border:'1px solid #E4E6EA', padding:'20px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'14px' }}>
                <div style={{ width:'48px', height:'48px', borderRadius:'14px', background:'#EDE9FE', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px' }}>👥</div>
                <div>
                  <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'16px', margin:0 }}>Cupón de Referido</p>
                  <p style={{ fontSize:'12px', color:'#9CA3AF', margin:'3px 0 0' }}>Comparte tu código con amigos</p>
                </div>
              </div>

              <div style={{ background:'#F7F8FA', border:'2px dashed #E4E6EA', borderRadius:'14px', padding:'14px 16px', display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
                <span style={{ fontFamily:'var(--font-display)', fontSize:'22px', fontWeight:800, color:'#7C3AED', letterSpacing:'3px', flex:1, textAlign:'center' }}>{referralCode || '...'}</span>
                <button onClick={() => copyCode(referralCode, 'ref')}
                  style={{ padding:'10px 18px', borderRadius:'10px', border:'none', background:copied==='ref'?'#10B981':'#7C3AED', color:'white', fontWeight:700, fontSize:'13px', cursor:'pointer', transition:'all 0.2s', flexShrink:0 }}>
                  {copied === 'ref' ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>

              <div style={{ background:'#F5F3FF', borderRadius:'12px', padding:'12px 14px', fontSize:'13px', color:'#7C3AED', lineHeight:1.6 }}>
                🎁 Tu amigo recibe el <strong>regalo de bienvenida</strong> · Tú recibes <strong>100 Puntos Lovers (= RD$100)</strong> cuando complete su primera compra
              </div>
            </div>

            {/* More coupons coming */}
            <div style={{ background:'#F7F8FA', borderRadius:'16px', border:'1.5px dashed #E4E6EA', padding:'20px', textAlign:'center', color:'#9CA3AF' }}>
              <p style={{ fontSize:'28px', marginBottom:'6px' }}>🎟</p>
              <p style={{ fontWeight:600, fontSize:'14px', marginBottom:'4px', color:'#6B7280' }}>Más cupones próximamente</p>
              <p style={{ fontSize:'12px' }}>Sigue comprando para desbloquear descuentos especiales</p>
            </div>
          </div>
        )}

        {/* ===== REFERIDOS TAB ===== */}
        {tab === 'referidos' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            {/* Stats */}
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

            {/* Code */}
            <div style={{ background:'white', borderRadius:'20px', border:'1px solid #E4E6EA', padding:'20px' }}>
              <h3 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'16px', margin:'0 0 14px' }}>Tu código de referido</h3>
              <div style={{ background:'#F7F8FA', border:'2px dashed #E4E6EA', borderRadius:'14px', padding:'16px', display:'flex', alignItems:'center', gap:'10px', marginBottom:'14px' }}>
                <span style={{ fontFamily:'var(--font-display)', fontSize:'24px', fontWeight:800, color:brandColor, letterSpacing:'3px', flex:1, textAlign:'center' }}>{referralCode}</span>
                <button onClick={() => copyCode(referralCode, 'ref2')}
                  style={{ padding:'10px 18px', borderRadius:'10px', border:'none', background:copied==='ref2'?'#10B981':brandColor, color:'white', fontWeight:700, fontSize:'13px', cursor:'pointer', transition:'all 0.2s', flexShrink:0 }}>
                  {copied === 'ref2' ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>

              {/* Share buttons */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                <button onClick={() => {
                  const msg = `¡Prueba Arepa Lovers y Smash Lovers! Usa mi código ${referralCode} y recibe un regalo en tu primera compra 🎁 ${window.location.origin}`
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
                }}
                  style={{ padding:'12px', borderRadius:'12px', border:'none', background:'#DCFCE7', color:'#15803D', fontWeight:700, fontSize:'13px', cursor:'pointer' }}>
                  📱 Compartir WhatsApp
                </button>
                <button onClick={() => copyCode(`¡Usa mi código ${referralCode} en Lovers Kitchen y recibe un regalo gratis! 🎁`, 'share')}
                  style={{ padding:'12px', borderRadius:'12px', border:'none', background:'#EFF6FF', color:'#1D4ED8', fontWeight:700, fontSize:'13px', cursor:'pointer' }}>
                  {copied === 'share' ? '✓ Copiado' : '📋 Copiar mensaje'}
                </button>
              </div>
            </div>

            {/* How it works */}
            <div style={{ background:'#F5F3FF', borderRadius:'16px', padding:'16px', fontSize:'13px', color:'#7C3AED', lineHeight:1.8 }}>
              <p style={{ fontWeight:800, marginBottom:'8px', fontSize:'14px' }}>¿Cómo funciona?</p>
              <p style={{ margin:0 }}>
                1️⃣ Comparte tu código con amigos<br/>
                2️⃣ Tu amigo se registra y hace su primera compra<br/>
                3️⃣ Tú recibes <strong>100 Puntos Lovers (= RD$100)</strong> automáticamente<br/>
                4️⃣ Tu amigo recibe el <strong>regalo de bienvenida</strong> gratis
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
