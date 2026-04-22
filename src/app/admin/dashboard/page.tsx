'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order, OrderStatus } from '@/types'
import { generateComandaPDF } from '@/lib/utils/comanda'

const supabase = createClient()

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: '⏳ Pendiente', PAGADO: '✅ Pagado', EN_COCINA: '🍳 En Cocina',
  LISTO: '✓ Listo', ENVIO_SOLICITADO: '📍 Repartidor', EN_CAMINO: '🛵 En Camino',
  ENTREGADO: '✅ Entregado', CANCELADO: '❌ Cancelado',
}

const STATUS_COLORS: Record<string, string> = {
  PENDIENTE: '#F59E0B', PAGADO: '#10B981', EN_COCINA: '#8B5CF6',
  LISTO: '#3B82F6', ENVIO_SOLICITADO: '#6366F1', EN_CAMINO: '#0EA5E9',
  ENTREGADO: '#10B981', CANCELADO: '#EF4444',
}

function formatRD(n: number) { return `RD$${n.toLocaleString('es-DO')}` }
function timeAgo(ts: string) {
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (mins < 1) return 'Ahora mismo'
  if (mins < 60) return `Hace ${mins}m`
  return `Hace ${Math.floor(mins / 60)}h`
}

function createRipple(e: React.MouseEvent<HTMLButtonElement>, color = 'rgba(255,255,255,0.4)') {
  const btn = e.currentTarget
  const circle = document.createElement('span')
  const d = Math.max(btn.clientWidth, btn.clientHeight)
  const rect = btn.getBoundingClientRect()
  circle.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX-rect.left-d/2}px;top:${e.clientY-rect.top-d/2}px;position:absolute;border-radius:50%;background:${color};transform:scale(0);animation:ripple-anim 0.5s linear;pointer-events:none;`
  btn.appendChild(circle)
  setTimeout(() => circle.remove(), 600)
}

// Play alert sound using Web Audio API (no file needed)
function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const times = [0, 0.15, 0.3]
    times.forEach(t => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = 880
      osc.type = 'sine'
      gain.gain.setValueAtTime(0, ctx.currentTime + t)
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + t + 0.05)
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + t + 0.15)
      osc.start(ctx.currentTime + t)
      osc.stop(ctx.currentTime + t + 0.2)
    })
  } catch {}
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<'activos' | 'resumen' | 'historial'>('activos')
  const [orders, setOrders] = useState<Order[]>([])
  const [historialOrders, setHistorialOrders] = useState<Order[]>([])
  const [todayStats, setTodayStats] = useState({ pedidos: 0, ingresos: 0, nuevos: 0, rating: 4.8 })
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set())
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [adminUser, setAdminUser] = useState<{ nombre: string; rol: string } | null>(null)
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())
  const soundRef = useRef(soundEnabled)
  soundRef.current = soundEnabled

  useEffect(() => {
    checkAdminAuth()
    loadOrders()
    loadTodayStats()
    const unsub = subscribeToOrders()
    // Request notification permission
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    return unsub
  }, [])

  async function checkAdminAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/auth/login/admin'; return }
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

  async function loadHistorial() {
    const { data } = await supabase
      .from('orders')
      .select('*, user:users(nombre, whatsapp), items:order_items(*, product:products(nombre))')
      .in('estado', ['ENTREGADO', 'CANCELADO'])
      .order('fecha_orden', { ascending: false })
      .limit(30)
    if (data) setHistorialOrders(data as Order[])
  }

  async function loadTodayStats() {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('orders').select('total_pagado, user_id, estado').gte('fecha_orden', today).neq('estado', 'CANCELADO')
    if (data) setTodayStats({ pedidos: data.length, ingresos: data.reduce((a, o) => a + (o.total_pagado || 0), 0), nuevos: new Set(data.map(o => o.user_id)).size, rating: 4.8 })
  }

  function subscribeToOrders() {
    const channel = supabase.channel('admin_orders_v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
        const newOrder = payload.new as Order
        setOrders(prev => [newOrder, ...prev])
        setNewOrderIds(prev => new Set([...prev, newOrder.id]))
        loadTodayStats()
        if (soundRef.current) playAlertSound()
        if (Notification.permission === 'granted') {
          new Notification(`🔔 Nuevo pedido #${newOrder.numero_pedido}`, {
            body: `${formatRD(newOrder.total_pagado)} · ${newOrder.metodo_pago === 'TRANSFERENCIA' ? 'Transferencia' : 'Tarjeta'}`,
            icon: '/logos/logo-arepa.png',
          })
        }
        // Auto-clear new badge after 8s
        setTimeout(() => setNewOrderIds(prev => { const n = new Set(prev); n.delete(newOrder.id); return n }), 8000)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
        setOrders(prev => {
          const updated = prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o)
          return updated.filter(o => !['ENTREGADO', 'CANCELADO'].includes(o.estado))
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }

  async function updateStatus(orderId: string, newStatus: OrderStatus) {
    await supabase.from('orders').update({
      estado: newStatus,
      ...(newStatus === 'EN_COCINA' ? { hora_pago_confirmado: new Date().toISOString() } : {}),
      ...(newStatus === 'LISTO' ? { hora_listo: new Date().toISOString() } : {}),
      ...(newStatus === 'ENTREGADO' ? { hora_entregado: new Date().toISOString() } : {}),
    }).eq('id', orderId)
  }

  function printComanda(order: Order) {
    try {
      const doc = generateComandaPDF(order)
      doc.autoPrint()
      window.open(doc.output('bloburl'), '_blank')
    } catch { alert('Error al imprimir. Revisa que jsPDF esté instalado.') }
  }

  function toggleExpand(id: string) {
    setExpandedOrders(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const activeOrders = orders.filter(o => !['ENTREGADO', 'CANCELADO'].includes(o.estado))
  const brandColor = '#C41E3A'

  return (
    <div style={{ minHeight: '100dvh', background: '#F7F8FA', fontFamily: 'var(--font-body)' }}>
      <style>{`
        @keyframes ripple-anim { to { transform:scale(4); opacity:0; } }
        @keyframes flash-new { 0%,100%{background:white} 50%{background:#FEF2F2} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        .md-ripple { position:relative; overflow:hidden; }
        .order-new { animation: flash-new 1s ease 4; border-color: #EF4444 !important; }
        .scrollbar-hide::-webkit-scrollbar{display:none} .scrollbar-hide{scrollbar-width:none}
      `}</style>

      {/* HEADER */}
      <header style={{ background: 'white', borderBottom: '1px solid #E4E6EA', position: 'sticky', top: 0, zIndex: 30, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <img src="/logos/logo-arepa.png" style={{ width: '30px', height: '30px', borderRadius: '8px' }} alt="" />
              <img src="/logos/logo-smash.png" style={{ width: '30px', height: '30px', borderRadius: '8px' }} alt="" />
            </div>
            <div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '17px', margin: 0, lineHeight: 1 }}>Admin Panel</h1>
              {adminUser && <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>{adminUser.nombre} · {adminUser.rol}</p>}
            </div>
            {activeOrders.length > 0 && (
              <div style={{ background: '#EF4444', color: 'white', borderRadius: '999px', padding: '3px 10px', fontSize: '12px', fontWeight: 800, animation: 'pulse 1.5s infinite' }}>
                {activeOrders.length} activo{activeOrders.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={() => setSoundEnabled(p => !p)} className="md-ripple"
              style={{ width: '36px', height: '36px', borderRadius: '50%', background: soundEnabled ? '#DCFCE7' : '#F3F4F6', border: 'none', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {soundEnabled ? '🔔' : '🔕'}
            </button>
            <button onClick={() => supabase.auth.signOut().then(() => window.location.href = '/auth/login/admin')}
              style={{ padding: '7px 14px', borderRadius: '999px', border: '1px solid #E4E6EA', background: 'white', fontSize: '12px', fontWeight: 600, color: '#6B7280', cursor: 'pointer' }}>
              Salir
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', borderTop: '1px solid #F3F4F6' }}>
          {([
            { key: 'activos', label: `📦 Activos${activeOrders.length > 0 ? ` (${activeOrders.length})` : ''}` },
            { key: 'resumen', label: '📊 Resumen' },
            { key: 'historial', label: '📋 Historial' },
          ] as const).map(t => (
            <button key={t.key}
              onClick={() => { setTab(t.key); if (t.key === 'historial') loadHistorial() }}
              style={{ flex: 1, padding: '12px 8px', border: 'none', background: 'none', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', borderBottom: `2px solid ${tab === t.key ? brandColor : 'transparent'}`, color: tab === t.key ? brandColor : '#9CA3AF', transition: 'all 0.2s' }}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}>

        {/* ===== ACTIVOS ===== */}
        {tab === 'activos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activeOrders.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '48px', marginBottom: '12px' }}>😴</p>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px', color: '#374151', marginBottom: '4px' }}>Sin pedidos activos</p>
                <p style={{ fontSize: '14px' }}>Los nuevos pedidos aparecerán aquí en tiempo real</p>
              </div>
            )}

            {activeOrders.map(order => {
              const isNew = newOrderIds.has(order.id)
              const isExpanded = expandedOrders.has(order.id)
              const orderColor = order.marca === 'AREPA' ? '#C41E3A' : '#0052CC'
              const statusColor = STATUS_COLORS[order.estado] || '#9CA3AF'

              return (
                <div key={order.id} className={isNew ? 'order-new' : ''}
                  style={{ background: 'white', borderRadius: '20px', border: `1.5px solid ${isNew ? '#EF4444' : '#E4E6EA'}`, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', transition: 'border-color 0.3s' }}>

                  {/* Order top bar */}
                  <div style={{ background: '#F7F8FA', padding: '10px 16px', borderBottom: '1px solid #F0F2F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18px' }}>#{order.numero_pedido}</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', background: order.marca === 'AREPA' ? '#FEE2E2' : '#DBEAFE', color: orderColor }}>
                        {order.marca === 'AREPA' ? '🫓 Arepa' : '🍔 Smash'}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', background: `${statusColor}18`, color: statusColor }}>
                        {STATUS_LABELS[order.estado]}
                      </span>
                      {isNew && <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '999px', background: '#FEE2E2', color: '#DC2626' }}>🔴 NUEVO</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18px', color: orderColor }}>{formatRD(order.total_pagado)}</div>
                        <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{timeAgo(order.fecha_orden)}</div>
                      </div>
                      <button onClick={() => toggleExpand(order.id)}
                        style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#F0F2F5', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                        ▾
                      </button>
                    </div>
                  </div>

                  {/* Order body */}
                  <div style={{ padding: '14px 16px' }}>
                    {/* Client info */}
                    {order.user && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `${orderColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '14px', color: orderColor, flexShrink: 0 }}>
                          {(order.user as any).nombre?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontWeight: 700, fontSize: '14px', margin: '0 0 1px', color: '#0D0F12' }}>{(order.user as any).nombre}</p>
                          <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>📱 {(order.user as any).whatsapp}</p>
                        </div>
                        <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', background: order.metodo_pago === 'TARJETA' ? '#EDE9FE' : '#DCFCE7', color: order.metodo_pago === 'TARJETA' ? '#7C3AED' : '#15803D' }}>
                          {order.metodo_pago === 'TARJETA' ? '💳 Tarjeta' : '🏦 Transferencia'}
                        </span>
                      </div>
                    )}

                    {/* Items */}
                    <div style={{ background: '#F7F8FA', borderRadius: '12px', padding: '10px 14px', marginBottom: '12px' }}>
                      {(order.items as any[] || []).slice(0, isExpanded ? undefined : 3).map((item: any) => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                          <span>{item.cantidad}× {item.product?.nombre}</span>
                          <span style={{ fontWeight: 600 }}>{formatRD(item.subtotal)}</span>
                        </div>
                      ))}
                      {!isExpanded && (order.items as any[] || []).length > 3 && (
                        <button onClick={() => toggleExpand(order.id)} style={{ fontSize: '12px', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px' }}>
                          +{(order.items as any[]).length - 3} más...
                        </button>
                      )}
                    </div>

                    {/* Delivery address */}
                    {(order as any).direccion_texto && (
                      <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>📍</span><span>{(order as any).direccion_texto}</span>
                      </div>
                    )}

                    {/* Comprobante */}
                    {order.metodo_pago === 'TRANSFERENCIA' && (order as any).comprobante_url && (
                      <a href={(order as any).comprobante_url} target="_blank" rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#7C3AED', background: '#EDE9FE', padding: '6px 12px', borderRadius: '8px', textDecoration: 'none', marginBottom: '12px' }}>
                        🖼 Ver comprobante
                      </a>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {order.estado === 'PENDIENTE' && (
                        <>
                          <button onClick={(e) => { createRipple(e); updateStatus(order.id, 'PAGADO') }} className="md-ripple"
                            style={{ padding: '10px 18px', background: '#10B981', color: 'white', border: 'none', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', position: 'relative' }}>✅ Aprobar</button>
                          <button onClick={(e) => { createRipple(e); updateStatus(order.id, 'CANCELADO') }} className="md-ripple"
                            style={{ padding: '10px 18px', background: '#EF4444', color: 'white', border: 'none', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', position: 'relative' }}>❌ Rechazar</button>
                        </>
                      )}
                      {order.estado === 'PAGADO' && (
                        <>
                          <button onClick={(e) => { createRipple(e); updateStatus(order.id, 'EN_COCINA') }} className="md-ripple"
                            style={{ padding: '10px 18px', background: '#10B981', color: 'white', border: 'none', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', position: 'relative' }}>✅ Aceptar → Cocina</button>
                          <button onClick={(e) => { createRipple(e); updateStatus(order.id, 'CANCELADO') }} className="md-ripple"
                            style={{ padding: '10px 18px', background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', position: 'relative' }}>❌ Cancelar</button>
                        </>
                      )}
                      {order.estado === 'EN_COCINA' && (
                        <button onClick={(e) => { createRipple(e); updateStatus(order.id, 'LISTO') }} className="md-ripple"
                          style={{ padding: '10px 18px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', position: 'relative' }}>✓ Marcar Listo</button>
                      )}
                      {order.estado === 'LISTO' && (
                        <button onClick={(e) => { createRipple(e); updateStatus(order.id, 'EN_CAMINO') }} className="md-ripple"
                          style={{ padding: '10px 18px', background: '#8B5CF6', color: 'white', border: 'none', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', position: 'relative' }}>🛵 En Camino</button>
                      )}
                      {order.estado === 'EN_CAMINO' && (
                        <button onClick={(e) => { createRipple(e); updateStatus(order.id, 'ENTREGADO') }} className="md-ripple"
                          style={{ padding: '10px 18px', background: '#10B981', color: 'white', border: 'none', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', position: 'relative' }}>🎉 Entregado</button>
                      )}
                      <button onClick={(e) => { createRipple(e); printComanda(order) }} className="md-ripple"
                        style={{ padding: '10px 18px', background: orderColor, color: 'white', border: 'none', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', position: 'relative' }}>🖨️ Comanda</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ===== RESUMEN ===== */}
        {tab === 'resumen' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { label: 'Pedidos hoy', value: todayStats.pedidos, icon: '📦', color: '#3B82F6' },
                { label: 'Ingresos hoy', value: formatRD(todayStats.ingresos), icon: '💰', color: '#10B981' },
                { label: 'Clientes únicos', value: todayStats.nuevos, icon: '👤', color: '#8B5CF6' },
                { label: 'Rating', value: `⭐ ${todayStats.rating}`, icon: '⭐', color: '#F59E0B' },
              ].map(stat => (
                <div key={stat.label} style={{ background: 'white', borderRadius: '20px', border: '1px solid #E4E6EA', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize: '24px', marginBottom: '10px' }}>{stat.icon}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 800, color: '#0D0F12', lineHeight: 1 }}>{stat.value}</div>
                  <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>{stat.label}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '16px', padding: '16px', fontSize: '13px', color: '#1E40AF' }}>
              💡 Las estadísticas se actualizan en tiempo real con cada pedido nuevo.
            </div>
          </div>
        )}

        {/* ===== HISTORIAL ===== */}
        {tab === 'historial' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {historialOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#9CA3AF' }}>
                <p style={{ fontSize: '36px', marginBottom: '8px' }}>📋</p>
                <p style={{ fontWeight: 600 }}>No hay historial todavía</p>
              </div>
            ) : historialOrders.map(order => (
              <div key={order.id} style={{ background: 'white', borderRadius: '16px', border: '1px solid #E4E6EA', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: order.marca === 'AREPA' ? '#FEE2E2' : '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                    {order.marca === 'AREPA' ? '🫓' : '🍔'}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '15px' }}>#{order.numero_pedido}</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: order.estado === 'ENTREGADO' ? '#DCFCE7' : '#FEE2E2', color: order.estado === 'ENTREGADO' ? '#15803D' : '#DC2626' }}>
                        {order.estado === 'ENTREGADO' ? '✅ Entregado' : '❌ Cancelado'}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '2px 0 0' }}>
                      {(order.user as any)?.nombre} · {new Date(order.fecha_orden).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '16px', color: order.marca === 'AREPA' ? '#C41E3A' : '#0052CC', flexShrink: 0 }}>
                  {formatRD(order.total_pagado)}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
