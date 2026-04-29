'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order, OrderStatus } from '@/types'

const supabase = createClient()

function formatRD(n: number) { return `RD$${(n||0).toLocaleString('es-DO')}` }
function timeAgo(ts: string) {
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h`
}

const FLUJO: Record<string, { label: string; next: string; nextLabel: string; color: string; bg: string; dot: string }> = {
  PENDIENTE:        { label: 'Nuevo',      next: 'EN_COCINA', nextLabel: 'Enviar a cocina', color: '#DC2626', bg: '#FEF2F2', dot: '#DC2626' },
  PAGADO:           { label: 'Pagado',     next: 'EN_COCINA', nextLabel: 'Enviar a cocina', color: '#7C3AED', bg: '#F5F3FF', dot: '#7C3AED' },
  EN_COCINA:        { label: 'En cocina',  next: 'LISTO',     nextLabel: 'Marcar listo',    color: '#D97706', bg: '#FFFBEB', dot: '#D97706' },
  LISTO:            { label: 'Listo',      next: 'EN_CAMINO', nextLabel: 'Despachar',       color: '#0284C7', bg: '#F0F9FF', dot: '#0284C7' },
  EN_CAMINO:        { label: 'En camino',  next: 'ENTREGADO', nextLabel: 'Entregado',       color: '#059669', bg: '#ECFDF5', dot: '#059669' },
  ENVIO_SOLICITADO: { label: 'Repartidor', next: 'EN_CAMINO', nextLabel: 'En camino',       color: '#6366F1', bg: '#EEF2FF', dot: '#6366F1' },
}

const WA_TEMPLATES = [
  { label: '✅ Confirmación', msg: (o: any) => `Hola ${o?.user?.nombre || ''} 👋, tu pedido *#${o?.numero_pedido}* ha sido confirmado y está en preparación 🍽️` },
  { label: '🍳 En cocina',    msg: (o: any) => `Hola ${o?.user?.nombre || ''}, tu pedido *#${o?.numero_pedido}* está siendo preparado ahora mismo 🔥` },
  { label: '🛵 En camino',    msg: (o: any) => `🛵 Tu pedido *#${o?.numero_pedido}* ya está en camino! Llegará en breve ❤️` },
  { label: '⭐ Reseña',       msg: (o: any) => `Hola ${o?.user?.nombre || ''}, esperamos que hayas disfrutado tu pedido 😊 https://arepa-smash-app.vercel.app/review/${o?.id}` },
]

function playTone(soundRef: React.MutableRefObject<boolean>) {
  if (!soundRef.current) return
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const notes = [{ f: 880, t: 0, d: 0.12 }, { f: 1100, t: 0.15, d: 0.12 }, { f: 1320, t: 0.30, d: 0.18 }]
    notes.forEach(({ f, t, d }) => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.type = 'sine'; o.frequency.value = f
      g.gain.setValueAtTime(0, ctx.currentTime + t)
      g.gain.linearRampToValueAtTime(0.5, ctx.currentTime + t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + t + d)
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + d + 0.05)
    })
  } catch {}
}

function printComanda(order: Order) {
  const user = (order as any).user
  const items = (order as any).items || []
  const logoUrl = order.marca === 'AREPA' ? window.location.origin + '/logos/logo-arepa-bw.jpg' : window.location.origin + '/logos/logo-smash-bw.png'
  const brandName = order.marca === 'AREPA' ? 'AREPA LOVERS' : 'SMASH LOVERS'
  const hora = new Date((order as any).fecha_orden).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })
  const fecha = new Date((order as any).fecha_orden).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })
  const costoEnvio = (order as any).costo_envio || 0
  const totalPagado = formatRD(order.total_pagado)
  const metodoPago = (order as any).metodo_pago || 'EFECTIVO'
  const direccion = (order as any).direccion_texto || ''
  const notasPedido = (order as any).notas_cliente || ''
  const itemsHtml = items.map((i: any) => {
    const mods = (i.modifiers || []).map((m: any) => `<div style="font-size:12px;color:#555;margin-left:12px">· ${m.option_nombre || m.optionNombre}</div>`).join('')
    const nota = i.notas ? `<div style="font-size:11px;color:#888;margin-left:12px;font-style:italic">"${i.notas}"</div>` : ''
    return `<div style="padding:10px 0;border-bottom:1px solid #eee"><div style="display:flex;justify-content:space-between"><span style="font-weight:700;font-size:15px">${i.cantidad}x ${i.product?.nombre || ''}</span><span style="font-weight:600;font-size:14px">${formatRD((i.product?.precio || 0) * i.cantidad)}</span></div>${mods}${nota}</div>`
  }).join('')
  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Comanda #${(order as any).numero_pedido}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:white;max-width:400px;margin:0 auto}@media print{.no-print{display:none}}</style></head><body>`
  html += `<div style="padding:20px;text-align:center;border-bottom:3px solid #000"><img src="${logoUrl}" style="width:100px;height:100px;object-fit:contain;display:block;margin:0 auto 10px"/><div style="font-weight:900;font-size:20px;letter-spacing:2px">${brandName}</div><div style="font-size:12px;color:#555;margin-top:4px">${fecha}</div></div>`
  html += `<div style="padding:16px;text-align:center;border-bottom:3px solid #000"><div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;margin-bottom:6px;color:#555">PEDIDO</div><div style="font-weight:900;font-size:56px;letter-spacing:-2px;line-height:1">#${(order as any).numero_pedido}</div><div style="font-size:14px;font-weight:600;margin-top:6px;color:#555">${hora}</div></div>`
  html += `<div style="padding:14px 16px;border-bottom:3px solid #000"><div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;margin-bottom:6px;color:#888">CLIENTE</div><div style="font-weight:700;font-size:20px">${user?.nombre || 'Cliente'}</div><div style="font-size:14px;color:#555;margin-top:2px">${user?.whatsapp || ''}</div></div>`
  html += `<div style="padding:0 16px"><div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;padding:12px 0 4px;border-bottom:2px solid #000;color:#888">PRODUCTOS</div>${itemsHtml}</div>`
  html += `<div style="padding:14px 16px;border-top:3px solid #000"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:14px;color:#555">Envío</span><span style="font-size:14px;font-weight:600">${costoEnvio > 0 ? formatRD(costoEnvio) : 'GRATIS'}</span></div><div style="display:flex;justify-content:space-between;padding-top:10px;border-top:2px solid #000"><span style="font-weight:900;font-size:20px">TOTAL</span><span style="font-weight:900;font-size:20px">${totalPagado}</span></div><div style="margin-top:10px;display:inline-block;padding:5px 14px;border:2px solid #000;border-radius:999px;font-size:12px;font-weight:700">${metodoPago}</div></div>`
  if (direccion) html += `<div style="padding:12px 16px;border-top:2px dashed #000"><div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;margin-bottom:4px;color:#888">DIRECCIÓN</div><div style="font-size:13px">${direccion}</div></div>`
  if (notasPedido) html += `<div style="padding:12px 16px;border-top:2px dashed #000"><div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;margin-bottom:4px;color:#888">NOTAS</div><div style="font-size:13px;font-style:italic">"${notasPedido}"</div></div>`
  html += `<div style="padding:16px;text-align:center;border-top:3px dashed #000;margin-top:4px"><div style="font-size:13px;font-weight:700">¡Gracias por tu pedido!</div></div><div class="no-print" style="padding:16px;text-align:center"><button onclick="window.print()" style="background:#000;color:white;border:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">Imprimir</button></div></body></html>`
  const w = window.open('', '_blank', 'width=420,height=750')
  if (!w) return
  w.document.write(html); w.document.close(); w.focus()
  setTimeout(() => { w.print() }, 500)
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [historial, setHistorial] = useState<Order[]>([])
  const [stats, setStats] = useState({ pedidos: 0, ingresos: 0, clientes: 0, entregados: 0 })
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [sound, setSound] = useState(true)
  const [admin, setAdmin] = useState<{ nombre: string; rol: string } | null>(null)
  const [selected, setSelected] = useState<Order | null>(null)
  const [tab, setTab] = useState<'activos' | 'historial'>('activos')
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [alertIds, setAlertIds] = useState<Set<string>>(new Set())
  const soundRef = useRef(true)
  const alertIntervalRef = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  useEffect(() => { soundRef.current = sound }, [sound])

  const startAlertLoop = useCallback((orderId: string) => {
    if (alertIntervalRef.current[orderId]) return
    setAlertIds(prev => new Set([...prev, orderId]))
    playTone(soundRef)
    alertIntervalRef.current[orderId] = setInterval(() => playTone(soundRef), 3000)
  }, [])

  const stopAlertLoop = useCallback((orderId: string) => {
    if (alertIntervalRef.current[orderId]) {
      clearInterval(alertIntervalRef.current[orderId])
      delete alertIntervalRef.current[orderId]
    }
    setAlertIds(prev => { const n = new Set(prev); n.delete(orderId); return n })
  }, [])

  useEffect(() => {
    checkAuth(); loadOrders(); loadStats()
    const ch = supabase.channel('dashboard_v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, ({ new: o }) => {
        if ((o as any).estado === 'BORRADOR') return
        setOrders(p => [o as Order, ...p])
        setNewIds(p => new Set([...p, (o as any).id]))
        startAlertLoop((o as any).id)
        loadStats()
        if (Notification.permission === 'granted')
          new Notification(`🔔 Pedido #${(o as any).numero_pedido}`, { body: `${formatRD((o as any).total_pagado)} · ${(o as any).metodo_pago}`, icon: '/logos/logo-arepa.png' })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, ({ new: u }) => {
        const updated = u as any
        if (['ENTREGADO', 'CANCELADO'].includes(updated.estado)) {
          setOrders(p => p.filter(o => o.id !== updated.id))
          stopAlertLoop(updated.id)
          setSelected(prev => prev?.id === updated.id ? null : prev)
        } else {
          setOrders(p => p.map(o => o.id === updated.id ? { ...o, ...updated } : o))
          setSelected(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev)
        }
        loadStats()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
      Object.values(alertIntervalRef.current).forEach(clearInterval)
    }
  }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/auth/login/admin'; return }
    const { data } = await supabase.from('admin_users').select('nombre,rol').eq('id', user.id).single()
    if (data) setAdmin(data)
    if (Notification.permission === 'default') Notification.requestPermission()
  }

  async function loadOrders() {
    const { data } = await supabase.from('orders')
      .select('*, user:users(nombre,whatsapp), items:order_items(*, product:products(nombre,precio), modifiers:order_item_modifiers(option_nombre,group_nombre,precio_extra))')
      .in('estado', ['PENDIENTE', 'PAGADO', 'EN_COCINA', 'LISTO', 'ENVIO_SOLICITADO', 'EN_CAMINO'])
      .order('fecha_orden', { ascending: false }).limit(60)
    if (data) setOrders(data as Order[])
  }

  async function loadStats() {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('orders').select('total_pagado,user_id,estado').gte('fecha_orden', today).neq('estado', 'CANCELADO')
    if (!data) return
    setStats({
      pedidos: data.length,
      ingresos: data.reduce((a, o) => a + (o.total_pagado || 0), 0),
      clientes: new Set(data.map(o => o.user_id)).size,
      entregados: data.filter(o => o.estado === 'ENTREGADO').length,
    })
  }

  async function loadHistorial() {
    const { data } = await supabase.from('orders')
      .select('*, user:users(nombre,whatsapp), items:order_items(*, product:products(nombre))')
      .in('estado', ['ENTREGADO', 'CANCELADO'])
      .order('fecha_orden', { ascending: false }).limit(40)
    if (data) setHistorial(data as Order[])
  }

  async function updateStatus(order: Order, nextEstado: string) {
    setLoadingAction(order.id)
    stopAlertLoop(order.id)
    setNewIds(p => { const n = new Set(p); n.delete(order.id); return n })
    await supabase.from('orders').update({
      estado: nextEstado,
      ...(nextEstado === 'EN_COCINA' ? { hora_pago_confirmado: new Date().toISOString() } : {}),
      ...(nextEstado === 'LISTO' ? { hora_listo: new Date().toISOString() } : {}),
      ...(nextEstado === 'ENTREGADO' ? { hora_entregado: new Date().toISOString() } : {}),
    }).eq('id', order.id)
    if (nextEstado === 'ENTREGADO') {
      const { data: od } = await supabase.from('orders').select('user_id, user:users(whatsapp)').eq('id', order.id).single()
      if ((od as any)?.user?.whatsapp) {
        await supabase.from('review_jobs').insert({ order_id: order.id, user_id: (od as any).user_id, whatsapp: (od as any).user.whatsapp, scheduled_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), sent: false }).select()
      }
    }
    setLoadingAction(null)
  }

  async function cancelOrder(order: Order) {
    if (!confirm(`¿Cancelar pedido #${(order as any).numero_pedido}?`)) return
    stopAlertLoop(order.id)
    await supabase.from('orders').update({ estado: 'CANCELADO' }).eq('id', order.id)
    if (selected?.id === order.id) setSelected(null)
  }

  function sendWhatsApp(order: Order, template: typeof WA_TEMPLATES[0]) {
    const user = (order as any).user
    if (!user?.whatsapp) return alert('No hay número de WhatsApp')
    const phone = user.whatsapp.replace(/\D/g, '')
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(template.msg(order))}`, '_blank')
  }

  const active = orders.filter(o => !['ENTREGADO', 'CANCELADO'].includes((o as any).estado))
  const pendientes = active.filter(o => ['PENDIENTE', 'PAGADO'].includes((o as any).estado))
  const enProceso = active.filter(o => ['EN_COCINA', 'LISTO', 'EN_CAMINO', 'ENVIO_SOLICITADO'].includes((o as any).estado))

  const NAV = [
    { href: '/admin/products', label: 'Productos', icon: '⊞' },
    { href: '/admin/orders', label: 'Todos los pedidos', icon: '≡' },
    { href: '/admin/clientes', label: 'Clientes', icon: '○' },
    { href: '/admin/marketing', label: 'Marketing', icon: '◇' },
    { href: '/admin/settings', label: 'Ajustes', icon: '⚙' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8F8F8', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:#D1D5DB;border-radius:2px}
        @keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes pulseRed{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,0.4)}50%{box-shadow:0 0 0 8px rgba(220,38,38,0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .ocard{transition:all 0.15s ease;cursor:pointer}
        .ocard:hover{transform:translateY(-1px);box-shadow:0 4px 20px rgba(0,0,0,0.08)!important}
        .mbtn{transition:all 0.15s ease;cursor:pointer;border:none;font-family:inherit;font-weight:600;display:flex;align-items:center;gap:6px}
        .mbtn:hover{filter:brightness(0.93)}
        .mbtn:active{transform:scale(0.97)}
        .alert-pulse{animation:pulseRed 1.5s infinite}
        .nav-link{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:8px;color:#6B7280;font-size:13px;font-weight:500;text-decoration:none;margin-bottom:2px;transition:background 0.1s}
        .nav-link:hover{background:#F3F4F6}
      `}</style>

      {/* SIDEBAR */}
      <div style={{ width: 224, background: 'white', borderRight: '1px solid #EBEBEB', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 3 }}>Panel Admin</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{admin?.nombre || '···'}</div>
        </div>

        <div style={{ padding: '0 8px', flex: 1 }}>
          {[
            { id: 'activos', label: 'Pedidos', icon: '◈', badge: active.length },
            { id: 'historial', label: 'Historial', icon: '◷', badge: 0 },
          ].map(item => (
            <button key={item.id} onClick={() => { setTab(item.id as any); if (item.id === 'historial') loadHistorial() }}
              className="mbtn"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, marginBottom: 2, background: tab === item.id ? '#111' : 'transparent', color: tab === item.id ? 'white' : '#6B7280', fontSize: 13, justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 15 }}>{item.icon}</span>{item.label}</span>
              {item.badge > 0 && <span style={{ background: tab === item.id ? 'rgba(255,255,255,0.2)' : '#DC2626', color: 'white', borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{item.badge}</span>}
            </button>
          ))}

          <div style={{ margin: '14px 4px 10px', borderTop: '1px solid #F3F4F6' }} />

          {NAV.map(item => (
            <a key={item.href} href={item.href} className="nav-link">
              <span style={{ fontSize: 14 }}>{item.icon}</span>{item.label}
            </a>
          ))}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
          <button onClick={() => setSound(s => !s)} className="mbtn"
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: sound ? '#ECFDF5' : '#F3F4F6', color: sound ? '#059669' : '#9CA3AF', fontSize: 12, justifyContent: 'center' }}>
            {sound ? '🔔 Sonido ON' : '🔕 Sonido OFF'}
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* STATS HEADER */}
        <div style={{ background: 'white', borderBottom: '1px solid #EBEBEB', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 32 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>Dashboard</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>{new Date().toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          </div>
          {[
            { label: 'Pedidos hoy', val: stats.pedidos, color: '#111' },
            { label: 'Ingresos hoy', val: formatRD(stats.ingresos), color: '#059669' },
            { label: 'Clientes únicos', val: stats.clientes, color: '#111' },
            { label: 'Entregados', val: stats.entregados, color: '#111' },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* CONTENT */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* ORDER LIST */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {tab === 'activos' && (
              <>
                {pendientes.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626' }} />
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#DC2626' }}>Nuevos · {pendientes.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {pendientes.map(order => (
                        <OrderCard key={order.id} order={order} isNew={newIds.has(order.id)} isAlert={alertIds.has(order.id)} isSelected={selected?.id === order.id}
                          onClick={() => setSelected(selected?.id === order.id ? null : order)}
                          onAction={() => { const f = FLUJO[(order as any).estado]; if (f) updateStatus(order, f.next) }}
                          loading={loadingAction === order.id} />
                      ))}
                    </div>
                  </div>
                )}

                {enProceso.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#D97706' }} />
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#6B7280' }}>En proceso · {enProceso.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {enProceso.map(order => (
                        <OrderCard key={order.id} order={order} isNew={false} isAlert={false} isSelected={selected?.id === order.id}
                          onClick={() => setSelected(selected?.id === order.id ? null : order)}
                          onAction={() => { const f = FLUJO[(order as any).estado]; if (f) updateStatus(order, f.next) }}
                          loading={loadingAction === order.id} />
                      ))}
                    </div>
                  </div>
                )}

                {active.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: '#9CA3AF' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>◈</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Sin pedidos activos</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Los nuevos pedidos aparecerán aquí en tiempo real</div>
                  </div>
                )}
              </>
            )}

            {tab === 'historial' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#6B7280' }}>Historial reciente</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {historial.map(order => {
                    const estado = (order as any).estado
                    return (
                      <div key={order.id} onClick={() => setSelected(selected?.id === order.id ? null : order)} className="ocard"
                        style={{ background: 'white', border: `1px solid ${selected?.id === order.id ? '#111' : '#EBEBEB'}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: estado === 'ENTREGADO' ? '#059669' : '#EF4444', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>#{(order as any).numero_pedido}</span>
                          <span style={{ color: '#6B7280', fontSize: 13, marginLeft: 8 }}>{(order as any).user?.nombre}</span>
                        </div>
                        <span style={{ fontSize: 12, color: '#9CA3AF' }}>{timeAgo((order as any).fecha_orden)}</span>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{formatRD(order.total_pagado)}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999, background: estado === 'ENTREGADO' ? '#ECFDF5' : '#FEF2F2', color: estado === 'ENTREGADO' ? '#059669' : '#DC2626' }}>{estado}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* SIDE PANEL */}
          {selected && (
            <OrderPanel order={selected} onClose={() => setSelected(null)}
              onAction={(next) => updateStatus(selected, next)}
              onCancel={() => cancelOrder(selected)}
              onPrint={() => printComanda(selected)}
              onWhatsApp={(tpl) => sendWhatsApp(selected, tpl)}
              loading={loadingAction === selected.id}
              isAlert={alertIds.has(selected.id)}
              stopAlert={() => stopAlertLoop(selected.id)} />
          )}
        </div>
      </div>
    </div>
  )
}

function OrderCard({ order, isNew, isAlert, isSelected, onClick, onAction, loading }: {
  order: Order; isNew: boolean; isAlert: boolean; isSelected: boolean
  onClick: () => void; onAction: () => void; loading: boolean
}) {
  const estado = (order as any).estado
  const flujo = FLUJO[estado]
  const user = (order as any).user
  const items = (order as any).items || []
  const hora = new Date((order as any).fecha_orden).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })
  return (
    <div onClick={onClick} className={`ocard ${isAlert ? 'alert-pulse' : ''}`}
      style={{ background: isNew ? '#FFF5F5' : 'white', border: `1.5px solid ${isSelected ? '#111' : isNew ? '#FCA5A5' : '#EBEBEB'}`, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, animation: 'fadeUp 0.2s ease' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: isNew ? '#DC2626' : (flujo?.bg || '#F3F4F6'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>
        {isNew ? <span style={{ color: 'white', fontSize: 16, fontWeight: 800 }}>!</span> : (order.marca === 'AREPA' ? '🫓' : '🍔')}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#111' }}>#{(order as any).numero_pedido}</span>
          {isNew
            ? <span style={{ fontSize: 10, fontWeight: 800, color: 'white', background: '#DC2626', padding: '2px 7px', borderRadius: 999 }}>NUEVO</span>
            : flujo && <span style={{ fontSize: 10, fontWeight: 700, color: flujo.color, background: flujo.bg, padding: '2px 7px', borderRadius: 999 }}>{flujo.label}</span>
          }
        </div>
        <div style={{ fontSize: 13, color: '#6B7280', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user?.nombre} · {items.length} ítem{items.length !== 1 ? 's' : ''} · {hora}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: '#111' }}>{formatRD(order.total_pagado)}</div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{timeAgo((order as any).fecha_orden)}</div>
      </div>
      {flujo && (
        <button onClick={e => { e.stopPropagation(); onAction() }} disabled={loading} className="mbtn"
          style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, flexShrink: 0, background: isNew ? '#DC2626' : '#111', color: 'white', opacity: loading ? 0.6 : 1 }}>
          {loading ? '···' : flujo.nextLabel}
        </button>
      )}
    </div>
  )
}

function OrderPanel({ order, onClose, onAction, onCancel, onPrint, onWhatsApp, loading, isAlert, stopAlert }: {
  order: Order; onClose: () => void; onAction: (next: string) => void; onCancel: () => void
  onPrint: () => void; onWhatsApp: (tpl: typeof WA_TEMPLATES[0]) => void
  loading: boolean; isAlert: boolean; stopAlert: () => void
}) {
  const estado = (order as any).estado
  const flujo = FLUJO[estado]
  const user = (order as any).user
  const items = (order as any).items || []
  const [showWA, setShowWA] = useState(false)

  return (
    <div style={{ width: 380, background: 'white', borderLeft: '1px solid #EBEBEB', display: 'flex', flexDirection: 'column', overflowY: 'auto', animation: 'slideIn 0.2s ease' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'white', zIndex: 2 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#111' }}>#{(order as any).numero_pedido}</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>
            {new Date((order as any).fecha_orden).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })} · {order.marca}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAlert && (
            <button onClick={stopAlert} className="mbtn" style={{ padding: '7px 12px', borderRadius: 8, background: '#FEF2F2', color: '#DC2626', fontSize: 12 }}>
              🔕 Silenciar
            </button>
          )}
          <button onClick={onClose} className="mbtn" style={{ width: 32, height: 32, borderRadius: 8, background: '#F3F4F6', color: '#6B7280', fontSize: 18, justifyContent: 'center' }}>×</button>
        </div>
      </div>

      {flujo && (
        <div style={{ margin: '14px 20px 0', padding: '10px 14px', borderRadius: 10, background: flujo.bg, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: flujo.dot }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: flujo.color }}>{flujo.label}</span>
        </div>
      )}

      {/* Cliente */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 8 }}>Cliente</div>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>{user?.nombre}</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>📱 {user?.whatsapp}</div>
        {(order as any).direccion_texto && <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>📍 {(order as any).direccion_texto}</div>}
      </div>

      {/* Productos */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 12 }}>Productos</div>
        {items.map((item: any, i: number) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{item.cantidad}× {item.product?.nombre}</span>
                {(item.modifiers || []).map((m: any, j: number) => (
                  <div key={j} style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>· {m.option_nombre || m.optionNombre}</div>
                ))}
                {item.notas && <div style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', marginTop: 2 }}>"{item.notas}"</div>}
              </div>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>{formatRD((item.product?.precio || 0) * item.cantidad)}</span>
            </div>
          </div>
        ))}
        {(order as any).notas_cliente && (
          <div style={{ marginTop: 8, padding: '10px 12px', background: '#FFFBEB', borderRadius: 8, fontSize: 12, color: '#92400E' }}>
            💬 {(order as any).notas_cliente}
          </div>
        )}
      </div>

      {/* Totales */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #F3F4F6' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 13, color: '#6B7280' }}>Envío</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{(order as any).costo_envio > 0 ? formatRD((order as any).costo_envio) : 'GRATIS'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #F3F4F6' }}>
          <span style={{ fontWeight: 800, fontSize: 16 }}>Total</span>
          <span style={{ fontWeight: 800, fontSize: 16 }}>{formatRD(order.total_pagado)}</span>
        </div>
        <div style={{ marginTop: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', border: '1.5px solid #D1D5DB', borderRadius: 999, color: '#6B7280' }}>{(order as any).metodo_pago || 'EFECTIVO'}</span>
        </div>
      </div>

      {/* Acciones */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {flujo && (
          <button onClick={() => onAction(flujo.next)} disabled={loading} className="mbtn"
            style={{ width: '100%', padding: '14px', borderRadius: 10, background: '#111', color: 'white', fontSize: 14, justifyContent: 'center', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Procesando···' : flujo.nextLabel}
          </button>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onPrint} className="mbtn" style={{ flex: 1, padding: '10px', borderRadius: 10, background: '#F3F4F6', color: '#374151', fontSize: 13, justifyContent: 'center' }}>
            🖨 Comanda
          </button>
          <button onClick={() => setShowWA(s => !s)} className="mbtn" style={{ flex: 1, padding: '10px', borderRadius: 10, background: '#DCFCE7', color: '#15803D', fontSize: 13, justifyContent: 'center' }}>
            💬 WhatsApp
          </button>
        </div>
        {showWA && (
          <div style={{ background: '#F9FAFB', borderRadius: 10, overflow: 'hidden', border: '1px solid #E5E7EB' }}>
            {WA_TEMPLATES.map((tpl, i) => (
              <button key={i} onClick={() => { onWhatsApp(tpl); setShowWA(false) }} className="mbtn"
                style={{ width: '100%', padding: '10px 14px', background: 'transparent', color: '#374151', fontSize: 12, justifyContent: 'flex-start', borderBottom: i < WA_TEMPLATES.length - 1 ? '1px solid #E5E7EB' : 'none' }}>
                {tpl.label}
              </button>
            ))}
          </div>
        )}
        {!['EN_CAMINO', 'ENTREGADO'].includes(estado) && (
          <button onClick={onCancel} className="mbtn" style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'transparent', color: '#EF4444', fontSize: 12, justifyContent: 'center', border: '1px solid #FCA5A5' }}>
            Cancelar pedido
          </button>
        )}
      </div>
    </div>
  )
}
