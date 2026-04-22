'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
function formatRD(n: number) { return `RD$${n.toLocaleString('es-DO')}` }

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loyalty, setLoyalty] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [referralCode, setReferralCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'loyalty' | 'pedidos' | 'referidos'>('loyalty')
  const [brandColor, setBrandColor] = useState('#C41E3A')

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
    const [{ data: loy }, { data: txs }, { data: orders }, { data: refCode }] = await Promise.all([
      supabase.from('loyalty_balances').select('*').eq('user_id', userId).single(),
      supabase.from('loyalty_transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
      supabase.from('orders').select('id, numero_pedido, estado, marca, total_pagado, fecha_orden').eq('user_id', userId).order('fecha_orden', { ascending: false }).limit(10),
      supabase.from('referral_codes').select('codigo').eq('user_id', userId).single(),
    ])
    setLoyalty(loy); setTransactions(txs || []); setRecentOrders(orders || [])
    if (refCode) { setReferralCode(refCode.codigo) } else {
      const code = userId.substring(0, 6).toUpperCase()
      const { data: newCode } = await supabase.from('referral_codes').insert({ user_id: userId, codigo: code, usos: 0, credito_acumulado: 0 }).select('codigo').single()
      if (newCode) setReferralCode(newCode.codigo)
    }
    setLoading(false)
  }

  const estadoColor: Record<string, string> = {
    PENDIENTE: '#F59E0B', CONFIRMADO: '#3B82F6', EN_COCINA: '#8B5CF6',
    LISTO: '#10B981', EN_CAMINO: '#0EA5E9', ENTREGADO: '#10B981', CANCELADO: '#EF4444'
  }
  const estadoLabel: Record<string, string> = {
    PENDIENTE: 'Pendiente', CONFIRMADO: 'Confirmado', EN_COCINA: '🍳 En cocina',
    LISTO: '✓ Listo', EN_CAMINO: '🛵 En camino', ENTREGADO: '✅ Entregado', CANCELADO: '❌ Cancelado'
  }

  if (loading) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F8FA' }}>
      <p style={{ color: '#9CA3AF', fontSize: '14px', fontFamily: 'var(--font-body)' }}>Cargando...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', background: '#F7F8FA', paddingBottom: '32px', fontFamily: 'var(--font-body)' }}>
      <style>{`.md-ripple{position:relative;overflow:hidden;} @keyframes ripple-anim{to{transform:scale(4);opacity:0}}`}</style>

      {/* Header */}
      <header style={{ background: 'white', borderBottom: '1px solid #E4E6EA', boxShadow: '0 1px 8px rgba(0,0,0,0.06)', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: '520px', margin: '0 auto', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => router.back()}
            style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#F3F4F6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: '#6B7280' }}>‹</button>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', margin: 0 }}>Mi cuenta</h1>
        </div>
      </header>

      <main style={{ maxWidth: '520px', margin: '0 auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* User card */}
        <div style={{ background: 'white', borderRadius: '20px', border: '1px solid #E4E6EA', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: `linear-gradient(135deg, ${brandColor}, ${brandColor}CC)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '22px', color: 'white', flexShrink: 0 }}>
            {user?.nombre?.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18px', margin: '0 0 2px', color: '#0D0F12' }}>{user?.nombre}</p>
            <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>📱 +1 {user?.whatsapp?.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')}</p>
          </div>
          <button onClick={() => { localStorage.clear(); router.push('/auth/login') }}
            style={{ padding: '8px 14px', borderRadius: '999px', border: '1px solid #E4E6EA', background: 'white', fontSize: '12px', fontWeight: 600, color: '#9CA3AF', cursor: 'pointer' }}>
            Salir
          </button>
        </div>

        {/* Loyalty hero */}
        <div style={{ borderRadius: '20px', padding: '24px', background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}DD 100%)`, position: 'relative', overflow: 'hidden', boxShadow: `0 8px 32px ${brandColor}40` }}>
          <div style={{ position: 'absolute', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', top: '-40px', right: '-40px' }} />
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 600, margin: '0 0 4px', position: 'relative', zIndex: 1 }}>Puntos Lovers disponibles</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '48px', fontWeight: 800, color: 'white', margin: '0 0 4px', letterSpacing: '-1px', lineHeight: 1, position: 'relative', zIndex: 1 }}>
            {loyalty?.saldo || 0}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: 600, margin: '0 0 16px', position: 'relative', zIndex: 1 }}>
            Puntos Lovers = {formatRD(loyalty?.saldo || 0)}
          </p>
          <div style={{ display: 'flex', gap: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.15)', position: 'relative', zIndex: 1 }}>
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18px', color: 'white', margin: 0 }}>{loyalty?.total_ganado || 0}</p>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>pts ganados</p>
            </div>
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18px', color: 'white', margin: 0 }}>{loyalty?.total_gastado || 0}</p>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>pts usados</p>
            </div>
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18px', color: 'white', margin: 0 }}>{loyalty?.total_compras || 0}</p>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>pedidos</p>
            </div>
          </div>
        </div>

        {/* Rule */}
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E4E6EA', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: `${brandColor}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>📐</div>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
            Por cada <strong style={{ color: '#0D0F12' }}>RD$10</strong> que gastas ganas <strong style={{ color: brandColor }}>1 Punto Lover</strong>. Cada punto equivale a <strong style={{ color: '#0D0F12' }}>RD$1</strong>.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: '#F3F4F6', borderRadius: '14px', padding: '4px' }}>
          {([{ key: 'loyalty', label: '💰 Historial' }, { key: 'pedidos', label: '📦 Pedidos' }, { key: 'referidos', label: '👥 Referidos' }] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ flex: 1, padding: '10px 8px', borderRadius: '10px', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'var(--font-body)', background: tab === t.key ? 'white' : 'transparent', color: tab === t.key ? '#0D0F12' : '#9CA3AF', boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* LOYALTY TAB */}
        {tab === 'loyalty' && (
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E4E6EA', overflow: 'hidden' }}>
            {transactions.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9CA3AF' }}>
                <p style={{ fontSize: '36px', marginBottom: '8px' }}>💰</p>
                <p style={{ fontSize: '14px', fontWeight: 600 }}>Aún no tienes movimientos</p>
              </div>
            ) : transactions.map((tx, idx) => (
              <div key={tx.id} style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: idx < transactions.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: tx.tipo === 'GANADO' ? '#DCFCE7' : '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
                    {tx.tipo === 'GANADO' ? '💰' : '🛒'}
                  </div>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#0D0F12', margin: '0 0 2px' }}>{tx.descripcion}</p>
                    <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>{new Date(tx.created_at).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '15px', color: tx.tipo === 'GANADO' ? '#15803D' : '#7C3AED', margin: '0 0 2px' }}>
                    {tx.tipo === 'GANADO' ? '+' : '−'}{tx.puntos} pts
                  </p>
                  <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>Saldo: {tx.saldo_resultante} pts</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PEDIDOS TAB */}
        {tab === 'pedidos' && (
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E4E6EA', overflow: 'hidden' }}>
            {recentOrders.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9CA3AF' }}>
                <p style={{ fontSize: '36px', marginBottom: '8px' }}>📦</p>
                <p style={{ fontSize: '14px', fontWeight: 600 }}>No tienes pedidos aún</p>
              </div>
            ) : recentOrders.map((order, idx) => (
              <button key={order.id} onClick={() => router.push(`/orders/${order.id}`)}
                style={{ width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', borderBottom: idx < recentOrders.length - 1 ? '1px solid #F3F4F6' : 'none', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: order.marca === 'AREPA' ? '#FEE2E2' : '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                    {order.marca === 'AREPA' ? '🫓' : '🍔'}
                  </div>
                  <div>
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '14px', color: '#0D0F12', margin: '0 0 2px' }}>Pedido #{order.numero_pedido}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: `${estadoColor[order.estado] || '#9CA3AF'}20`, color: estadoColor[order.estado] || '#9CA3AF' }}>
                        {estadoLabel[order.estado] || order.estado}
                      </span>
                      <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{new Date(order.fecha_orden).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '15px', color: '#0D0F12', margin: '0 0 2px' }}>{formatRD(order.total_pagado)}</p>
                  <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>Ver →</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* REFERIDOS TAB */}
        {tab === 'referidos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E4E6EA', padding: '20px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '16px', margin: '0 0 12px' }}>👥 Tu código de referido</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#F7F8FA', border: '2px dashed #E4E6EA', borderRadius: '14px', padding: '14px 16px', marginBottom: '12px' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 800, color: brandColor, letterSpacing: '3px', flex: 1, textAlign: 'center' }}>{referralCode}</span>
                <button onClick={() => { navigator.clipboard.writeText(referralCode); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                  style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', background: copied ? '#10B981' : brandColor, color: 'white', fontWeight: 700, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}>
                  {copied ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
              <div style={{ background: '#EFF6FF', borderRadius: '12px', padding: '14px', fontSize: '13px', color: '#1E40AF', lineHeight: 1.6 }}>
                🎁 Tu amigo recibe el <strong>regalo de bienvenida</strong> en su primera compra · Tú recibes <strong>100 Puntos Lovers</strong> (= RD$100) cuando complete su compra
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
