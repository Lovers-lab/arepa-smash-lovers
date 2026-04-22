'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order, OrderStatus } from '@/types'
import { generateComandaPDF } from '@/lib/utils/comanda'

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDIENTE: 'Pendiente',
  PAGADO: 'Pagado ✅',
  EN_COCINA: 'En Cocina 🍳',
  LISTO: 'Listo ✓',
  ENVIO_SOLICITADO: 'Envío solicitado',
  EN_CAMINO: 'En Camino 🛵',
  ENTREGADO: 'Entregado ✅',
  CANCELADO: 'Cancelado ❌',
}

function formatRD(n: number) { return `RD$${n.toLocaleString('es-DO')}` }
function timeAgo(ts: string) {
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `Hace ${mins}m`
  return `Hace ${Math.floor(mins / 60)}h`
}

export default function AdminDashboard() {
  const supabase = createClient()
  const [tab, setTab] = useState<'resumen' | 'activos' | 'historial' | 'config'>('activos')
  const [orders, setOrders] = useState<Order[]>([])
  const [todayStats, setTodayStats] = useState({ pedidos: 0, ingresos: 0, nuevos: 0, rating: 0 })
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set())
  const audioRef = useRef<any>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [adminUser, setAdminUser] = useState<{ nombre: string; rol: string } | null>(null)

  // Load Howler lazily
  useEffect(() => {
    import('howler').then(({ Howl }) => {
      audioRef.current = new Howl({
        src: ['/sounds/alarm.mp3'],
        volume: 1.0,
        loop: false,
      })
    })
  }, [])

  useEffect(() => {
    checkAdminAuth()
    loadOrders()
    loadTodayStats()
    subscribeToOrders()
  }, [])

  async function checkAdminAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/auth/login'; return }
    const { data } = await supabase.from('admin_users').select('nombre, rol').eq('id', user.id).single()
    if (data) setAdminUser(data)
  }

  async function loadOrders() {
    const { data } = await supabase
      .from('orders')
      .select('*, user:users(nombre, whatsapp), items:order_items(*, product:products(nombre, precio))')
      .not('estado', 'in', '(ENTREGADO,CANCELADO)')
      .order('fecha_orden', { ascending: false })
      .limit(50)
    if (data) setOrders(data as Order[])
  }

  async function loadTodayStats() {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('orders')
      .select('total_pagado, user_id, estado')
      .gte('fecha_orden', today)
      .neq('estado', 'CANCELADO')
    if (data) {
      setTodayStats({
        pedidos: data.length,
        ingresos: data.reduce((acc, o) => acc + (o.total_pagado || 0), 0),
        nuevos: new Set(data.map(o => o.user_id)).size,
        rating: 4.7, // placeholder — join with reviews
      })
    }
  }

  function subscribeToOrders() {
    const channel = supabase
      .channel('admin_orders')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'orders'
      }, (payload) => {
        const newOrder = payload.new as Order
        setOrders(prev => [newOrder, ...prev])
        setNewOrderIds(prev => new Set([...prev, newOrder.id]))
        if (soundEnabled && audioRef.current) {
          audioRef.current.play()
        }
        // Browser notification
        if (Notification.permission === 'granted') {
          new Notification(`🔔 Nuevo pedido #${newOrder.numero_pedido}`, {
            body: `${formatRD(newOrder.total_pagado)} — ${newOrder.metodo_pago}`,
            icon: '/logos/logo-arepa.png',
          })
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders'
      }, (payload) => {
        setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }

  async function updateOrderStatus(orderId: string, newStatus: OrderStatus) {
    await supabase.from('orders').update({
      estado: newStatus,
      ...(newStatus === 'EN_COCINA' ? { hora_pago_confirmado: new Date().toISOString() } : {}),
      ...(newStatus === 'LISTO' ? { hora_listo: new Date().toISOString() } : {}),
      ...(newStatus === 'ENTREGADO' ? { hora_entregado: new Date().toISOString() } : {}),
    }).eq('id', orderId)
    // In production: trigger WhatsApp notification via Edge Function
  }

  async function printComanda(order: Order) {
    const doc = generateComandaPDF(order)
    doc.autoPrint()
    window.open(doc.output('bloburl'), '_blank')
  }

  const activeOrders = orders.filter(o => !['ENTREGADO', 'CANCELADO'].includes(o.estado))

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🫓🍔</span>
            <div>
              <h1 className="font-black text-base" style={{ fontFamily: 'Syne, serif' }}>Admin Panel</h1>
              {adminUser && <p className="text-xs text-gray-400">{adminUser.nombre} · {adminUser.rol}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Active orders badge */}
            {activeOrders.length > 0 && (
              <span className="bg-red-500 text-white text-xs font-black px-2 py-1 rounded-full animate-pulse-badge">
                {activeOrders.length}
              </span>
            )}
            <button
              onClick={() => setSoundEnabled(p => !p)}
              className="text-xl" title={soundEnabled ? 'Silenciar' : 'Activar sonido'}
            >{soundEnabled ? '🔔' : '🔕'}</button>
            <button onClick={() => supabase.auth.signOut().then(() => window.location.href = '/auth/login')}
              className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
              Salir
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 flex gap-1 pb-0">
          {(['resumen', 'activos', 'historial', 'config'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-2.5 text-sm font-semibold capitalize border-b-2 transition-colors"
              style={tab === t
                ? { borderColor: '#C41E3A', color: '#C41E3A' }
                : { borderColor: 'transparent', color: '#6B7280' }
              }>
              {t === 'activos' ? `Activos (${activeOrders.length})` : t === 'resumen' ? 'Resumen' : t === 'historial' ? 'Historial' : 'Config'}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4">

        {/* RESUMEN */}
        {tab === 'resumen' && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Pedidos hoy', value: todayStats.pedidos, icon: '📦' },
              { label: 'Ingresos hoy', value: formatRD(todayStats.ingresos), icon: '💰' },
              { label: 'Clientes nuevos', value: todayStats.nuevos, icon: '👤' },
              { label: 'Rating promedio', value: `⭐ ${todayStats.rating}`, icon: '⭐' },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-2xl mb-1">{stat.icon}</p>
                <p className="font-black text-xl">{stat.value}</p>
                <p className="text-xs text-gray-400">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ACTIVOS */}
        {tab === 'activos' && (
          <div className="space-y-3">
            {activeOrders.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-2">😴</p>
                <p>No hay pedidos activos</p>
              </div>
            )}
            {activeOrders.map(order => (
              <div key={order.id}
                className={`bg-white rounded-2xl border overflow-hidden transition-all ${newOrderIds.has(order.id) ? 'border-red-400 order-flash' : 'border-gray-100'}`}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-lg" style={{ fontFamily: 'Syne, serif' }}>
                        #{order.numero_pedido}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${order.marca === 'AREPA' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                        {order.marca === 'AREPA' ? '🫓 Arepa' : '🍔 Smash'}
                      </span>
                      <span className={`badge-${order.estado.toLowerCase().replace('_', '-')} badge-${order.estado === 'PAGADO' ? 'pagado' : order.estado === 'EN_COCINA' ? 'cocina' : order.estado === 'LISTO' ? 'listo' : 'camino'}`}>
                        {STATUS_LABELS[order.estado]}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-black" style={{ color: order.marca === 'AREPA' ? '#C41E3A' : '#0052CC' }}>
                        {formatRD(order.total_pagado)}
                      </p>
                      <p className="text-xs text-gray-400">{timeAgo(order.fecha_orden)}</p>
                    </div>
                  </div>

                  {order.user && (
                    <p className="text-sm text-gray-500 mt-1">
                      {(order.user as any).nombre} · {(order.user as any).whatsapp}
                    </p>
                  )}

                  {/* Items list */}
                  {order.items && (
                    <div className="mt-2 text-sm text-gray-600 space-y-0.5">
                      {order.items.map((item: any) => (
                        <p key={item.id}>• {item.cantidad}x {item.product?.nombre}</p>
                      ))}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {order.estado === 'PAGADO' && (
                      <>
                        <button onClick={() => updateOrderStatus(order.id, 'EN_COCINA')}
                          className="px-4 py-2 bg-green-500 text-white text-xs font-bold rounded-xl hover:bg-green-600 transition-colors">
                          ✅ Aceptar
                        </button>
                        <button onClick={() => updateOrderStatus(order.id, 'CANCELADO')}
                          className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-colors">
                          ❌ Cancelar
                        </button>
                      </>
                    )}
                    {order.estado === 'EN_COCINA' && (
                      <button onClick={() => updateOrderStatus(order.id, 'LISTO')}
                        className="px-4 py-2 bg-blue-500 text-white text-xs font-bold rounded-xl hover:bg-blue-600 transition-colors">
                        ✓ Marcar Listo
                      </button>
                    )}
                    {order.estado === 'LISTO' && (
                      <button onClick={() => updateOrderStatus(order.id, 'ENVIO_SOLICITADO')}
                        className="px-4 py-2 bg-purple-500 text-white text-xs font-bold rounded-xl hover:bg-purple-600 transition-colors">
                        🛵 Pedir Repartidor
                      </button>
                    )}
                    {/* Transfer: show approve/reject if pending */}
                    {order.metodo_pago === 'TRANSFERENCIA' && order.estado === 'PENDIENTE' && (
                      <>
                        <a href={order.comprobante_url} target="_blank" className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-200 transition-colors">
                          🖼 Ver Comprobante
                        </a>
                        <button onClick={() => updateOrderStatus(order.id, 'PAGADO')}
                          className="px-4 py-2 bg-green-500 text-white text-xs font-bold rounded-xl hover:bg-green-600 transition-colors">
                          ✅ Aprobar
                        </button>
                        <button onClick={() => updateOrderStatus(order.id, 'CANCELADO')}
                          className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-colors">
                          ❌ Rechazar
                        </button>
                      </>
                    )}
                    {/* Print button — always visible */}
                    <button onClick={() => printComanda(order)}
                      className="px-4 py-2 text-white text-xs font-bold rounded-xl transition-colors"
                      style={{ background: order.marca === 'AREPA' ? '#C41E3A' : '#0052CC' }}>
                      🖨️ Imprimir Comanda
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* HISTORIAL placeholder */}
        {tab === 'historial' && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-3xl mb-2">📋</p>
            <p>Historial de pedidos</p>
            <p className="text-sm mt-1">Filtros por fecha, estado, cliente próximamente</p>
          </div>
        )}

        {/* CONFIG placeholder */}
        {tab === 'config' && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-3xl mb-2">⚙️</p>
            <p>Configuración</p>
            <p className="text-sm mt-1">Datos bancarios, horarios, mensajes WhatsApp</p>
          </div>
        )}
      </main>
    </div>
  )
}
