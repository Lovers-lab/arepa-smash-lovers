import ClientNav from '@/components/ClientNav'
'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
function formatRD(n: number) { return 'RD$' + (n||0).toLocaleString('es-DO') }

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
      supabase.from('user_coupons').select('*, coupon:coupons(*)').eq('user_id', userId).eq('usado', false).order('created_at', { ascending: false }),
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

    setAvailableCoupons(coupons || [])
    setLoading(false)
  }

  function copyCode(code: string, id: string) {
    navigator.clipboard.writeText(code)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F7F8FA' }}>
      <ClientNav showBack={true} showHome={true} />
      <p style={{ color:'#9CA3AF', fontFamily:'var(--font-body)' }}>Cargando billetera...</p>
    </div>
  )

  return (
    <div style={{ minHeight:'100dvh', background:'#F7F8FA', paddingBottom:'32px', fontFamily:'var(--font-body)' }}>
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`}</style>

      {/* Header */}
      <div style={{ background:brandColor, padding:'24px 20px 40px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', right:'-30px', top:'-30px', width:'160px', height:'160px', borderRadius:'50%', background:'rgba(255,255,255,0.08)' }} />
        <h1 style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'22px', color:'white', margin:'0 0 4px' }}>Mi Billetera</h1>
        <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.75)', margin:0 }}>{user?.nombre}</p>
      </div>

      {/* Points card */}
      <div style={{ margin:'-24px 16px 0', background:'white', borderRadius:'20px', padding:'20px', boxShadow:'0 4px 24px rgba(0,0,0,0.10)', position:'relative', zIndex:2 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <p style={{ fontSize:'12px', color:'#9CA3AF', margin:'0 0 4px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>Puntos Lovers</p>
            <p style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'36px', color:brandColor, margin:0, lineHeight:1 }}>{loyalty?.saldo || 0}</p>
            <p style={{ fontSize:'12px', color:'#9CA3AF', margin:'4px 0 0' }}>= {formatRD(loyalty?.saldo || 0)} en descuentos</p>
          </div>
          <div style={{ fontSize:'48px', animation:'float 3s ease-in-out infinite' }}>🪙</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'8px', padding:'20px 16px 0', overflowX:'auto' }}>
        {([{ k:'puntos', l:'⭐ Puntos' }, { k:'cupones', l:'🎟 Cupones' }, { k:'referidos', l:'👥 Referidos' }] as const).map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{ padding:'10px 18px', borderRadius:'999px', border:'none', background:tab===t.k?brandColor:'white', color:tab===t.k?'white':'#6B7280', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'13px', cursor:'pointer', whiteSpace:'nowrap', boxShadow:tab===t.k?'none':'0 1px 4px rgba(0,0,0,0.08)', flexShrink:0 }}>
            {t.l}
          </button>
        ))}
      </div>

      <div style={{ padding:'16px' }}>

        {/* PUNTOS TAB */}
        {tab === 'puntos' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            <div style={{ background:'white', borderRadius:'16px', padding:'16px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
              <p style={{ fontWeight:800, fontSize:'14px', margin:'0 0 12px' }}>Historial de puntos</p>
              {transactions.length === 0 ? (
                <p style={{ fontSize:'13px', color:'#9CA3AF', textAlign:'center', padding:'20px 0' }}>Haz tu primer pedido para ganar puntos</p>
              ) : transactions.map((tx: any) => (
                <div key={tx.id} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #F3F4F6' }}>
                  <div>
                    <p style={{ fontSize:'13px', fontWeight:600, margin:0 }}>{tx.descripcion}</p>
                    <p style={{ fontSize:'11px', color:'#9CA3AF', margin:'2px 0 0' }}>{new Date(tx.created_at).toLocaleDateString('es-DO')}</p>
                  </div>
                  <p style={{ fontWeight:800, fontSize:'14px', color: tx.tipo === 'earned' ? '#10B981' : '#EF4444', margin:0 }}>
                    {tx.tipo === 'earned' ? '+' : '-'}{tx.puntos} pts
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CUPONES TAB */}
        {tab === 'cupones' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {availableCoupons.length === 0 ? (
              <div style={{ background:'#F7F8FA', borderRadius:'16px', border:'1.5px dashed #E4E6EA', padding:'30px 20px', textAlign:'center', color:'#9CA3AF' }}>
                <p style={{ fontSize:'28px', margin:'0 0 8px' }}>🎟</p>
                <p style={{ fontWeight:600, fontSize:'14px', margin:'0 0 4px', color:'#6B7280' }}>Sin cupones disponibles</p>
                <p style={{ fontSize:'12px', margin:0 }}>Instala la app o haz pedidos para ganar cupones</p>
              </div>
            ) : (
              availableCoupons.map((uc: any) => (
                <div key={uc.id} style={{ background:'white', borderRadius:'20px', border:'1px solid #E4E6EA', padding:'20px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px' }}>
                    <div>
                      <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'22px', color:brandColor, margin:0 }}>{formatRD(uc.coupon?.valor)}</p>
                      <p style={{ fontSize:'12px', color:'#9CA3AF', margin:'3px 0 0' }}>{uc.coupon?.descripcion}</p>
                    </div>
                    <div style={{ background:brandColor + '15', borderRadius:'10px', padding:'6px 12px', textAlign:'center' }}>
                      <p style={{ fontSize:'10px', fontWeight:700, color:brandColor, margin:0 }}>Min. compra</p>
                      <p style={{ fontSize:'13px', fontWeight:800, color:brandColor, margin:0 }}>{formatRD(uc.coupon?.minimo_compra || 0)}</p>
                    </div>
                  </div>
                  <div style={{ background:'#F7F8FA', border:'2px dashed #E4E6EA', borderRadius:'12px', padding:'10px 14px', display:'flex', alignItems:'center', gap:'10px' }}>
                    <span style={{ fontFamily:'var(--font-display)', fontSize:'16px', fontWeight:800, color:'#374151', letterSpacing:'2px', flex:1 }}>{uc.coupon?.codigo}</span>
                    <button onClick={() => copyCode(uc.coupon?.codigo, uc.id)}
                      style={{ padding:'8px 14px', borderRadius:'8px', border:'none', background:copied===uc.id?'#10B981':brandColor, color:'white', fontWeight:700, fontSize:'12px', cursor:'pointer', flexShrink:0 }}>
                      {copied === uc.id ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  {uc.coupon?.expira_at && (
                    <p style={{ fontSize:'11px', color:'#9CA3AF', margin:'8px 0 0' }}>
                      Vence: {new Date(uc.coupon.expira_at).toLocaleDateString('es-DO')}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* REFERIDOS TAB */}
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
              <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'16px', margin:'0 0 14px' }}>Tu codigo de referido</p>
              <div style={{ background:'#F7F8FA', border:'2px dashed #E4E6EA', borderRadius:'14px', padding:'14px 16px', display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
                <span style={{ fontFamily:'var(--font-display)', fontSize:'22px', fontWeight:800, color:'#7C3AED', letterSpacing:'3px', flex:1, textAlign:'center' }}>{referralCode || '...'}</span>
                <button onClick={() => copyCode(referralCode, 'ref')}
                  style={{ padding:'10px 18px', borderRadius:'10px', border:'none', background:copied==='ref'?'#10B981':'#7C3AED', color:'white', fontWeight:700, fontSize:'13px', cursor:'pointer', flexShrink:0 }}>
                  {copied === 'ref' ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <div style={{ background:'#F5F3FF', borderRadius:'12px', padding:'12px 14px', fontSize:'13px', color:'#7C3AED', lineHeight:1.6 }}>
                Tu amigo recibe bienvenida. Tu recibes 100 Puntos cuando complete su primera compra.
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
