'use client'

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
  const [referralCode, setReferralCode] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'loyalty' | 'pedidos' | 'referidos'>('loyalty')

  useEffect(() => {
    const stored = localStorage.getItem('lovers_user')
    if (!stored) { router.replace('/auth/login'); return }
    const u = JSON.parse(stored)
    setUser(u)
    loadAll(u.id)
  }, [])

  async function loadAll(userId: string) {
    setLoading(true)
    const [
      { data: loy },
      { data: txs },
      { data: orders },
      { data: refCode },
    ] = await Promise.all([
      supabase.from('loyalty_balances').select('*').eq('user_id', userId).single(),
      supabase.from('loyalty_transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
      supabase.from('orders').select('numero_pedido, estado, marca, total_pagado, fecha_orden').eq('user_id', userId).order('fecha_orden', { ascending: false }).limit(10),
      supabase.from('referral_codes').select('codigo').eq('user_id', userId).single(),
    ])

    setLoyalty(loy)
    setTransactions(txs || [])
    setRecentOrders(orders || [])

    if (refCode) {
      setReferralCode(refCode.codigo)
    } else {
      // Auto-create referral code if none exists
      const code = `${userId.substring(0, 6).toUpperCase()}`
      const { data: newCode } = await supabase.from('referral_codes').insert({
        user_id: userId, codigo: code, usos: 0, credito_acumulado: 0
      }).select('codigo').single()
      if (newCode) setReferralCode(newCode.codigo)
    }

    setLoading(false)
  }

  function copyReferral() {
    navigator.clipboard.writeText(referralCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const brandColor = (localStorage.getItem('lovers_marca') === 'SMASH') ? '#0052CC' : '#C41E3A'

  if (loading) {
    return <div className="min-h-dvh flex items-center justify-center"><p className="text-gray-400 text-sm">Cargando...</p></div>
  }

  return (
    <div className="min-h-dvh bg-gray-50 pb-10">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-500 text-xl">←</button>
          <h1 className="font-black text-lg" style={{ fontFamily: 'Syne, serif' }}>Mi cuenta</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* User card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center font-black text-2xl text-white shrink-0"
            style={{ background: brandColor }}>
            {user?.nombre?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-black text-lg" style={{ fontFamily: 'Syne, serif' }}>{user?.nombre}</p>
            <p className="text-sm text-gray-400">+1 {user?.whatsapp?.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')}</p>
            {loyalty?.total_compras > 10 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">⭐ Cliente VIP</span>
            )}
          </div>
        </div>

        {/* Loyalty summary */}
        <div className="rounded-2xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}CC)` }}>
          <p className="text-sm font-semibold opacity-80">Loyalty Cash disponible</p>
          <p className="text-4xl font-black mt-1">{formatRD(loyalty?.saldo || 0)}</p>
          <div className="flex gap-4 mt-3 text-xs opacity-75">
            <span>Ganado: {formatRD(loyalty?.total_ganado || 0)}</span>
            <span>Gastado: {formatRD(loyalty?.total_gastado || 0)}</span>
          </div>
          <p className="text-xs opacity-60 mt-2">Por cada RD$10 gastados ganas RD$1 en Loyalty Cash</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {([
            { key: 'loyalty', label: '💰 Historial' },
            { key: 'pedidos', label: '📦 Pedidos' },
            { key: 'referidos', label: '👥 Referidos' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
              style={tab === t.key ? { background: '#fff', color: '#1A1A1A', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: '#9CA3AF' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* LOYALTY TRANSACTIONS */}
        {tab === 'loyalty' && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {transactions.length === 0 ? (
              <div className="py-10 text-center text-gray-400">
                <p className="text-3xl mb-2">💰</p>
                <p className="text-sm">Aún no tienes movimientos</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {transactions.map(tx => (
                  <div key={tx.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{tx.descripcion}</p>
                      <p className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-sm ${tx.tipo === 'GANADO' ? 'text-green-600' : 'text-red-500'}`}>
                        {tx.tipo === 'GANADO' ? '+' : '-'}{formatRD(tx.puntos)}
                      </p>
                      <p className="text-xs text-gray-400">Saldo: {formatRD(tx.saldo_resultante)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ORDERS */}
        {tab === 'pedidos' && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {recentOrders.length === 0 ? (
              <div className="py-10 text-center text-gray-400">
                <p className="text-3xl mb-2">📦</p>
                <p className="text-sm">No tienes pedidos aún</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentOrders.map(order => (
                  <button key={order.id} onClick={() => router.push(`/orders/${order.id}`)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">#{order.numero_pedido}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${order.marca === 'AREPA' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                          {order.marca === 'AREPA' ? '🫓' : '🍔'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(order.fecha_orden).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })} · {order.estado}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">{formatRD(order.total_pagado)}</p>
                      <p className="text-xs text-gray-400">Ver →</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* REFERRALS */}
        {tab === 'referidos' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
              <h3 className="font-black text-sm" style={{ fontFamily: 'Syne, serif' }}>Tu código de referido</h3>
              <div className="flex items-center gap-3">
                <code className="flex-1 bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 font-black text-lg text-center tracking-widest">
                  {referralCode}
                </code>
                <button onClick={copyReferral}
                  className="px-4 py-3 rounded-xl text-white font-bold text-sm shrink-0 transition-all"
                  style={{ background: copied ? '#10B981' : brandColor }}>
                  {copied ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
                <p className="font-semibold text-gray-700">¿Cómo funciona?</p>
                <p className="text-gray-500">Comparte tu código con amigos. Cuando hagan su primera compra:</p>
                <ul className="space-y-1 text-gray-500">
                  <li>✅ Ellos obtienen <strong>15% de descuento</strong> en su primer pedido</li>
                  <li>✅ Tú ganas <strong>RD$100 en Loyalty Cash</strong> (válido 60 días)</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={() => { localStorage.clear(); router.push('/auth/login') }}
          className="w-full py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors">
          Cerrar sesión
        </button>
      </main>
    </div>
  )
}
