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

const FLUJO: Record<string, { label: string; next: string; nextLabel: string; color: string; bg: string; dot: string; sendWA?: boolean }> = {
  PENDIENTE:        { label: 'Nuevo',      next: 'EN_COCINA', nextLabel: 'Aceptar pedido',  color: '#DC2626', bg: '#FEF2F2', dot: '#DC2626', sendWA: true },
  PAGADO:           { label: 'Pagado',     next: 'EN_COCINA', nextLabel: 'Aceptar pedido',  color: '#7C3AED', bg: '#F5F3FF', dot: '#7C3AED', sendWA: true },
  EN_COCINA:        { label: 'En cocina',  next: 'LISTO',     nextLabel: 'Marcar listo',    color: '#D97706', bg: '#FFFBEB', dot: '#D97706' },
  LISTO:            { label: 'Listo',      next: 'EN_CAMINO', nextLabel: 'Despachar',       color: '#0284C7', bg: '#F0F9FF', dot: '#0284C7' },
  EN_CAMINO:        { label: 'En camino',  next: 'ENTREGADO', nextLabel: 'Entregado',       color: '#059669', bg: '#ECFDF5', dot: '#059669' },
  ENVIO_SOLICITADO: { label: 'Repartidor', next: 'EN_CAMINO', nextLabel: 'En camino',       color: '#6366F1', bg: '#EEF2FF', dot: '#6366F1' },
}

const WA_TEMPLATES = [
  { label: '✅ Confirmación', msg: (o: any) => `Hola ${o?.user?.nombre || ''} 👋, tu pedido *#${o?.numero_pedido}* ha sido confirmado y está en preparación 🍽️` },
  { label: '🍳 En cocina',    msg: (o: any) => `Hola ${o?.user?.nombre || ''}, tu pedido *#${o?.numero_pedido}* está siendo preparado 🔥` },
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
  html += `<div style="padding:14px 16px;border-top:3px solid #000"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:14px;color:#555">Envío</span><span style="font-size:14px;font-weight:600">${costoEnvio > 0 ? formatRD(costoEnvio) : 'GRATIS'}</span></div><div style="display:flex;justify-content:space-between;padding-top:10px;border-top:2px solid #000"><span style="font-weight:900;font-size:20px">TOTAL</span><span style="font-weight:900;font-size:20px">${formatRD(order.total_pagado)}</span></div><div style="margin-top:10px;display:inline-block;padding:5px 14px;border:2px solid #000;border-radius:999px;font-size:12px;font-weight:700">${metodoPago}</div></div>`
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
    const ch = supabase.channel('dashboard_v3')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, async ({ new: o }) => {
        if ((o as any).estado === 'BORRADOR') return
        // Fetch completo con joins para tener items, user, etc.
        const { data: full } = await supabase.from('orders')
          .select('*, user:users(nombre,whatsapp), items:order_items(*, product:products(nombre,precio), modifiers:order_item_modifiers(option_nombre,group_nombre,precio_extra))')
          .eq('id', (o as any).id).single()
        const order = (full || o) as Order
        setOrders(p => [order, ...p])
        setNewIds(p => new Set([...p, (o as any).id]))
        startAlertLoop((o as any).id)
        loadStats()
        if (Notification.permission === 'granted')
          new Notification(`🔔 Nuevo pedido #${(o as any).numero_pedido}`, { body: `${formatRD((o as any).total_pagado)} · ${(o as any).metodo_pago}`, icon: '/logos/logo-arepa.png' })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, ({ new: u }) => {
        const updated = u as any
        if (['ENTREGADO', 'CANCELADO'].includes(updated.estado)) {
          setOrders(p => p.filter(o => o.id !== updated.id))
          stopAlertLoop(updated.id)
          setSelected(prev => prev?.id === updated.id ? null : prev)
        } else {
          setOrders(p => p.map(o => o.id === updated.id ? { ...o, ...updated } : o))
          setSelected(prev => prev?.id === updated.id ? { ...prev, ...updated } as Order : prev)
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
    // Al aceptar: enviar WA al cliente
    const flujoActual = FLUJO[(order as any).estado]
    if (flujoActual?.sendWA) {
      const user = (order as any).user
      if (user?.whatsapp) {
        const phone = user.whatsapp.replace(/\D/g, '')
        const msg = encodeURIComponent(`Hola ${user.nombre} 👋, recibimos tu pedido *#${(order as any).numero_pedido}* y estamos verificando el pago. Te avisamos cuando esté en cocina 🍽️`)
        window.open('https://wa.me/' + phone + '?text=' + msg, '_blank')
      }
    }
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
    if (!user?.whatsapp) return alert('Sin número de WhatsApp')
    const phone = user.whatsapp.replace(/\D/g, '')
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(template.msg(order))}`, '_blank')
  }

  const active = orders.filter(o => !['ENTREGADO', 'CANCELADO'].includes((o as any).estado))
  const pendientes = active.filter(o => ['PENDIENTE', 'PAGADO'].includes((o as any).estado))
  const enProceso = active.filter(o => ['EN_COCINA', 'LISTO', 'EN_CAMINO', 'ENVIO_SOLICITADO'].includes((o as any).estado))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F8F8F8', fontFamily: "'Inter', -apple-system, sans-serif" }}>
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
      `}</style>

      {/* STATS HEADER */}
      <div style={{ background: 'white', borderBottom: '1px solid #EBEBEB', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { id: 'activos', label: `Activos (${active.length})` },
            { id: 'historial', label: 'Historial' },
          ].map(t => (
            <button key={t.id} onClick={() => { setTab(t.id as any); if (t.id === 'historial') loadHistorial() }}
              className="mbtn"
              style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, background: tab === t.id ? '#111' : '#F3F4F6', color: tab === t.id ? 'white' : '#6B7280' }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {[
          { label: 'Pedidos', val: stats.pedidos },
          { label: 'Ingresos', val: formatRD(stats.ingresos) },
          { label: 'Clientes', val: stats.clientes },
          { label: 'Entregados', val: stats.entregados },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#111' }}>{s.val}</div>
            <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}

        <button onClick={() => setSound(s => !s)} className="mbtn"
          style={{ padding: '7px 14px', borderRadius: 8, background: sound ? '#ECFDF5' : '#F3F4F6', color: sound ? '#059669' : '#9CA3AF', fontSize: 12, marginLeft: 8 }}>
          {sound ? '🔔 ON' : '🔕 OFF'}
        </button>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ORDER LIST */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {tab === 'activos' && (
            <>
              {pendientes.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#DC2626' }}>Nuevos · {pendientes.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {pendientes.map(order => (
                      <OrderCard key={order.id} order={order}
                        isNew={newIds.has(order.id)} isAlert={alertIds.has(order.id)} isSelected={selected?.id === order.id}
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
                      <OrderCard key={order.id} order={order}
                        isNew={false} isAlert={false} isSelected={selected?.id === order.id}
                        onClick={() => setSelected(selected?.id === order.id ? null : order)}
                        onAction={() => { const f = FLUJO[(order as any).estado]; if (f) updateStatus(order, f.next) }}
                        loading={loadingAction === order.id} />
                    ))}
                  </div>
                </div>
              )}

              {active.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: '#9CA3AF' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>◈</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Sin pedidos activos</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Los nuevos pedidos aparecen aquí en tiempo real</div>
                </div>
              )}
            </>
          )}

          {tab === 'historial' && (
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
          )}
        </div>

        {/* SIDE PANEL */}
        {selected && (
          <OrderPanel order={selected}
            onClose={() => setSelected(null)}
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
  const tieneComprobante = !!(order as any).comprobante_url
  const marcaColor = order.marca === 'AREPA' ? '#C41E3A' : '#0052CC'
  const marcaBg = order.marca === 'AREPA' ? '#FEF2F2' : '#EFF6FF'
  const marcaLogo = order.marca === 'AREPA' ? '/logos/logo-arepa-bw.jpg' : '/logos/logo-smash-bw.png'
  const borderColor = isSelected ? '#111' : isNew ? marcaColor : '#EBEBEB'
  const cardBg = isNew ? (order.marca === 'AREPA' ? '#FFF5F5' : '#EFF6FF') : 'white'

  return (
    <div onClick={onClick} className={`ocard ${isAlert ? 'alert-pulse' : ''}`}
      style={{ background: cardBg, border: `1.5px solid ${borderColor}`, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, animation: 'fadeUp 0.2s ease' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', background: isNew ? marcaColor : marcaBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: isNew ? 'none' : ('1.5px solid ' + marcaColor + '30') }}>
        {isNew
          ? <img src={marcaLogo} alt={order.marca} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0) invert(1)', opacity: 0.9 }} />
          : <img src={marcaLogo} alt={order.marca} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#111' }}>#{(order as any).numero_pedido}</span>
          {isNew
            ? <span style={{ fontSize: 10, fontWeight: 800, color: 'white', background: marcaColor, padding: '2px 8px', borderRadius: 999 }}>NUEVO PEDIDO</span>
            : flujo && <span style={{ fontSize: 10, fontWeight: 700, color: flujo.color, background: flujo.bg, padding: '2px 8px', borderRadius: 999 }}>{flujo.label}</span>
          }
          {tieneComprobante && <span style={{ fontSize: 10, fontWeight: 700, color: '#0284C7', background: '#F0F9FF', padding: '2px 8px', borderRadius: 999 }}>📎 Comprobante</span>}
        </div>
        <div style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>{user?.nombre || '—'}</div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>
          {order.marca === 'AREPA' ? 'Arepa Lovers' : 'Smash Lovers'} · {items.length} ítem{items.length !== 1 ? 's' : ''} · {hora} · {(order as any).metodo_pago}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: '#111' }}>{formatRD(order.total_pagado)}</div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{timeAgo((order as any).fecha_orden)}</div>
      </div>
      {flujo && (
        <button onClick={e => { e.stopPropagation(); onAction() }} disabled={loading} className="mbtn"
          style={{ padding: '9px 16px', borderRadius: 8, fontSize: 12, flexShrink: 0, background: isNew ? marcaColor : '#111', color: 'white', opacity: loading ? 0.6 : 1 }}>
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
  const comprobante = (order as any).comprobante_url
  const [showWA, setShowWA] = useState(false)
  const [imgError, setImgError] = useState(false)

  return (
    <div style={{ width: 400, background: 'white', borderLeft: '1px solid #EBEBEB', display: 'flex', flexDirection: 'column', overflowY: 'auto', animation: 'slideIn 0.2s ease', flexShrink: 0 }}>

      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'white', zIndex: 2 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#111' }}>Pedido #{(order as any).numero_pedido}</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>
            {new Date((order as any).fecha_orden).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })} · {order.marca === 'AREPA' ? 'AREPA LOVERS' : 'SMASH LOVERS'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isAlert && (
            <button onClick={stopAlert} className="mbtn" style={{ padding: '6px 12px', borderRadius: 8, background: '#FEF2F2', color: '#DC2626', fontSize: 12 }}>
              🔕 Silenciar
            </button>
          )}
          <button onClick={onClose} className="mbtn" style={{ width: 32, height: 32, borderRadius: 8, background: '#F3F4F6', color: '#6B7280', fontSize: 20, justifyContent: 'center' }}>×</button>
        </div>
      </div>

      {/* Estado */}
      {flujo && (
        <div style={{ margin: '14px 20px 0', padding: '10px 14px', borderRadius: 10, background: flujo.bg, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: flujo.dot }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: flujo.color }}>{flujo.label}</span>
          <span style={{ fontSize: 12, color: flujo.color, marginLeft: 'auto', opacity: 0.7 }}>{(order as any).metodo_pago}</span>
        </div>
      )}

      {/* Cliente */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 10 }}>Cliente</div>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#111', marginBottom: 6 }}>{user?.nombre || '—'}</div>
        {user?.whatsapp && (
          <a href={`https://wa.me/${user.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#059669', fontWeight: 600, textDecoration: 'none', background: '#ECFDF5', padding: '5px 12px', borderRadius: 8 }}>
            📱 {user.whatsapp}
          </a>
        )}
        {(order as any).direccion_texto && (
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 8 }}>📍 {(order as any).direccion_texto}</div>
        )}
      </div>

      {/* Comprobante de pago */}
      {comprobante && (
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 10 }}>Comprobante de transferencia</div>
          {!imgError ? (
            <div style={{ position: 'relative' }}>
              <img src={comprobante} alt="Comprobante" onError={() => setImgError(true)}
                style={{ width: '100%', borderRadius: 10, border: '1px solid #E5E7EB', cursor: 'pointer', maxHeight: 300, objectFit: 'contain', background: '#F9FAFB' }}
                onClick={() => window.open(comprobante, '_blank')} />
              <a href={comprobante} target="_blank" rel="noreferrer"
                style={{ display: 'block', textAlign: 'center', marginTop: 8, fontSize: 12, color: '#0284C7', fontWeight: 600, textDecoration: 'none' }}>
                Ver imagen completa ↗
              </a>
            </div>
          ) : (
            <a href={comprobante} target="_blank" rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#F0F9FF', borderRadius: 10, color: '#0284C7', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              📎 Ver comprobante ↗
            </a>
          )}
        </div>
      )}

      {/* Productos */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 12 }}>Productos</div>
        {items.length === 0 && <div style={{ fontSize: 13, color: '#9CA3AF' }}>Sin productos cargados</div>}
        {items.map((item: any, i: number) => (
          <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < items.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{item.cantidad}× {item.product?.nombre || '—'}</span>
                {(item.modifiers || []).map((m: any, j: number) => (
                  <div key={j} style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>· {m.option_nombre || m.optionNombre}</div>
                ))}
                {item.notas && <div style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', marginTop: 2 }}>"{item.notas}"</div>}
              </div>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#111', flexShrink: 0, marginLeft: 8 }}>{formatRD((item.product?.precio || 0) * item.cantidad)}</span>
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
                style={{ width: '100%', padding: '11px 14px', background: 'transparent', color: '#374151', fontSize: 13, justifyContent: 'flex-start', borderBottom: i < WA_TEMPLATES.length - 1 ? '1px solid #E5E7EB' : 'none' }}>
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
