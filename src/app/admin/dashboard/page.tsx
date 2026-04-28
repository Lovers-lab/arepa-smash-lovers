'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order, OrderStatus } from '@/types'

const supabase = createClient()

function formatRD(n: number) { return `RD$${n.toLocaleString('es-DO')}` }
function timeAgo(ts: string) {
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h`
}

const ESTADOS_FLOW: Record<string, { label: string; next: string; nextLabel: string; color: string; bg: string }> = {
  PENDIENTE:        { label: 'Esperando',    next: 'PAGADO',          nextLabel: '✅ Aprobar',       color: '#D97706', bg: '#FFFBEB' },
  PAGADO:           { label: 'Aprobado',     next: 'EN_COCINA',       nextLabel: '🍳 → Cocina',      color: '#7C3AED', bg: '#F5F3FF' },
  EN_COCINA:        { label: 'En cocina',    next: 'LISTO',           nextLabel: '✓ Listo',          color: '#2563EB', bg: '#EFF6FF' },
  LISTO:            { label: 'Listo',        next: 'EN_CAMINO',       nextLabel: '🛵 Despachar',     color: '#0891B2', bg: '#ECFEFF' },
  EN_CAMINO:        { label: 'En camino',    next: 'ENTREGADO',       nextLabel: '🎉 Entregado',     color: '#059669', bg: '#ECFDF5' },
  ENVIO_SOLICITADO: { label: 'Repartidor',   next: 'EN_CAMINO',       nextLabel: '🛵 En camino',     color: '#6366F1', bg: '#EEF2FF' },
}

function playAlert() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const notes = [{ f:1047,t:0,d:.15 }, { f:1319,t:.18,d:.15 }, { f:1568,t:.36,d:.25 }, { f:2093,t:.64,d:.35 }]
    notes.forEach(({ f, t, d }) => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination); o.type = 'square'; o.frequency.value = f
      g.gain.setValueAtTime(0, ctx.currentTime + t)
      g.gain.linearRampToValueAtTime(0.8, ctx.currentTime + t + .02)
      g.gain.exponentialRampToValueAtTime(.01, ctx.currentTime + t + d)
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + d + .05)
    })
  } catch {}
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<'activos'|'resumen'|'historial'>('activos')
  const [orders, setOrders] = useState<Order[]>([])
  const [historial, setHistorial] = useState<Order[]>([])
  const [stats, setStats] = useState({ pedidos: 0, ingresos: 0, clientes: 0, entregados: 0 })
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [sound, setSound] = useState(true)
  const [admin, setAdmin] = useState<{nombre:string;rol:string}|null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pyaLoading, setPyaLoading] = useState<string|null>(null)
  const [pyaResult, setPyaResult] = useState<Record<string,any>>({})
  const soundRef = useRef(sound)
  soundRef.current = sound

  useEffect(() => {
    checkAuth(); loadOrders(); loadStats()
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission()
    const ch = supabase.channel(`dash-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, ({ new: o }) => {
        // Ignorar pedidos BORRADOR - solo mostrar cuando estén confirmados
        if ((o as any).estado === 'BORRADOR') return
        setOrders(p => [o as Order, ...p])
        setNewIds(p => new Set([...p, (o as any).id]))
        loadStats()
        if (soundRef.current) playAlert()
        if (Notification.permission === 'granted') new Notification(`🔔 Pedido #${(o as any).numero_pedido}`, { body: `${formatRD((o as any).total_pagado)} · ${(o as any).metodo_pago}`, icon: '/logos/logo-arepa.png' })
        setTimeout(() => setNewIds(p => { const n = new Set(p); n.delete((o as any).id); return n }), 8000)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, ({ new: u }) => {
        const updated = u as any
        if (['ENTREGADO','CANCELADO'].includes(updated.estado)) setOrders(p => p.filter(o => o.id !== updated.id))
        else setOrders(p => p.map(o => o.id === updated.id ? { ...o, ...updated } : o))
        loadStats()
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/auth/login/admin'; return }
    const { data } = await supabase.from('admin_users').select('nombre,rol').eq('id', user.id).single()
    if (data) setAdmin(data)
  }

  async function loadOrders() {
    const { data } = await supabase.from('orders')
      .select('*, user:users(nombre,whatsapp), items:order_items(*, product:products(nombre,precio))')
      .in('estado', ['PENDIENTE','PAGADO','EN_COCINA','LISTO','ENVIO_SOLICITADO','EN_CAMINO','CANCELADO_EN_RUTA'])
      .order('fecha_orden', { ascending: false }).limit(60)
    if (data) setOrders(data as Order[])
  }

  async function loadStats() {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('orders').select('total_pagado,user_id,estado').gte('fecha_orden', today).neq('estado', 'CANCELADO')
    if (data) setStats({
      pedidos: data.length,
      ingresos: data.reduce((a, o) => a + (o.total_pagado || 0), 0),
      clientes: new Set(data.map(o => o.user_id)).size,
      entregados: data.filter(o => o.estado === 'ENTREGADO').length,
    })
  }

  async function loadHistorial() {
    const { data } = await supabase.from('orders')
      .select('*, user:users(nombre,whatsapp), items:order_items(*, product:products(nombre))')
      .in('estado', ['ENTREGADO','CANCELADO'])
      .order('fecha_orden', { ascending: false }).limit(40)
    if (data) setHistorial(data as Order[])
  }

  async function updateStatus(id: string, estado: OrderStatus) {
    await supabase.from('orders').update({
      estado,
      ...(estado === 'EN_COCINA' ? { hora_pago_confirmado: new Date().toISOString() } : {}),
      ...(estado === 'LISTO' ? { hora_listo: new Date().toISOString() } : {}),
      ...(estado === 'ENTREGADO' ? { hora_entregado: new Date().toISOString() } : {}),
    }).eq('id', id)

    // Al entregar: crear job para enviar link de reseña en 30 minutos
    if (estado === 'ENTREGADO') {
      const { data: orderData } = await supabase
        .from('orders')
        .select('user_id, user:users(whatsapp)')
        .eq('id', id)
        .single()
      if (orderData?.user) {
        const scheduledAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
        await supabase.from('review_jobs').insert({
          order_id: id,
          user_id: orderData.user_id,
          whatsapp: (orderData.user as any).whatsapp,
          scheduled_at: scheduledAt,
          sent: false,
        })
      }
    }
  }

  async function solicitarRepartidor(orderId: string, test = false) {
    setPyaLoading(orderId)
    try {
      const res = await fetch('/api/pedidosya', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, test }),
      })
      const data = await res.json()
      setPyaResult(p => ({ ...p, [orderId]: { ...data, test } }))
      if (!test && data.success) {
        alert('✅ Repartidor solicitado. Tracking: ' + data.trackingUrl)
      } else if (test) {
        alert('🧪 Prueba OK: ' + JSON.stringify(data.estimate || data, null, 2))
      }
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setPyaLoading(null)
    }
  }

  async function cancelarRepartidor(orderId: string) {
    if (!confirm('¿Cancelar el repartidor de PedidosYa?')) return
    setPyaLoading(orderId)
    try {
      const res = await fetch(`/api/pedidosya?orderId=${orderId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) alert('✅ Envío cancelado')
      else alert('Error: ' + JSON.stringify(data))
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setPyaLoading(null)
    }
  }

  async function cancelOrder(id: string) {
    if (!confirm('¿Cancelar este pedido?')) return
    await updateStatus(id, 'CANCELADO' as OrderStatus)
  }

  function printComanda(order: Order) {
    const user = order.user as any
    const items = (order.items as any[] || [])
    const logoUrl = window.location.origin + (order.marca === 'AREPA' ? '/logos/logo-arepa.png' : '/logos/logo-smash.png')
    const brandName = order.marca === 'AREPA' ? 'AREPA LOVERS' : 'SMASH LOVERS'
    const brandColor = order.marca === 'AREPA' ? '#C41E3A' : '#0052CC'
    const hora = new Date((order as any).fecha_orden).toLocaleTimeString('es-DO', {hour:'2-digit', minute:'2-digit'})
    const fecha = new Date((order as any).fecha_orden).toLocaleDateString('es-DO', {day:'numeric', month:'short', year:'numeric'})

    let itemsHtml = ''
    for (const i of items) {
      const mods = i.modifiers || i.selected_modifiers || []
      let modHtml = ''
      for (const m of mods) {
        const nombre = m.nombre || m.name || m.option_name || ''
        const precio = m.precio > 0 ? ' (+RD$' + m.precio + ')' : ''
        modHtml += '<div style="padding:2px 0 2px 12px;color:#555;font-size:13px;border-left:2px solid #ddd;margin-left:8px">+ ' + nombre + precio + '</div>'
      }
      const notasItem = i.notas ? '<div style="padding:2px 0 2px 12px;color:#888;font-size:12px;font-style:italic;margin-left:8px">Nota: ' + i.notas + '</div>' : ''
      const precioItem = ((i.product?.precio || 0) * i.cantidad).toLocaleString('es-DO')
      itemsHtml += '<div style="padding:10px 0;border-bottom:1px dashed #e0e0e0">'
      itemsHtml += '<div style="display:flex;justify-content:space-between;align-items:flex-start">'
      itemsHtml += '<div style="font-size:15px;font-weight:700;color:#111">' + i.cantidad + 'x ' + (i.product?.nombre || 'Producto') + '</div>'
      itemsHtml += '<div style="font-size:14px;font-weight:600;color:#333">RD$' + precioItem + '</div>'
      itemsHtml += '</div>' + modHtml + notasItem + '</div>'
    }

    const direccion = (order as any).direccion_texto
    const notasPedido = (order as any).notas_cliente
    const numPedido = (order as any).numero_pedido
    const totalPagado = formatRD((order as any).total_pagado)
    const costoEnvio = (order as any).costo_envio
    const metodoPago = order.metodo_pago || 'EFECTIVO'

    let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Comanda #' + numPedido + '</title>'
    html += '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:white;color:#111;max-width:380px;margin:0 auto}@media print{.no-print{display:none}}</style></head><body>'
    html += '<div style="background:' + brandColor + ';padding:20px 16px;text-align:center">'
    html += '<img src="' + logoUrl + '" style="width:80px;height:80px;border-radius:16px;object-fit:cover;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:block;margin:0 auto 10px" />'
    html += '<div style="font-weight:900;font-size:20px;color:white;letter-spacing:1px">' + brandName + '</div>'
    html += '<div style="color:rgba(255,255,255,0.7);font-size:12px;margin-top:2px">' + fecha + '</div></div>'
    html += '<div style="background:#111;padding:14px 16px;text-align:center">'
    html += '<div style="color:rgba(255,255,255,0.6);font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">PEDIDO</div>'
    html += '<div style="font-weight:900;font-size:40px;color:white;letter-spacing:-1px">#' + numPedido + '</div>'
    html += '<div style="color:rgba(255,255,255,0.6);font-size:13px;margin-top:4px">' + hora + '</div></div>'
    html += '<div style="padding:14px 16px;background:#F9F9F9;border-bottom:2px solid #eee">'
    html += '<div style="font-size:10px;color:#999;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px">CLIENTE</div>'
    html += '<div style="font-weight:700;font-size:18px;color:#111">' + (user?.nombre || 'Cliente') + '</div>'
    html += '<div style="font-size:13px;color:#666;margin-top:2px">' + (user?.whatsapp || '') + '</div></div>'
    html += '<div style="padding:4px 16px 0"><div style="font-size:10px;color:#999;letter-spacing:1.5px;text-transform:uppercase;padding:12px 0 4px">PRODUCTOS</div>' + itemsHtml + '</div>'
    html += '<div style="padding:14px 16px;background:#F9F9F9;border-top:2px solid #eee;margin-top:4px">'
    html += '<div style="display:flex;justify-content:space-between;margin-bottom:10px"><span style="color:#666;font-size:13px">Envio</span><span style="font-size:13px">' + (costoEnvio > 0 ? 'RD$' + costoEnvio : 'GRATIS') + '</span></div>'
    html += '<div style="display:flex;justify-content:space-between;padding-top:10px;border-top:2px solid #ddd"><span style="font-weight:900;font-size:17px">TOTAL</span><span style="font-weight:900;font-size:17px;color:' + brandColor + '">' + totalPagado + '</span></div>'
    html += '<div style="margin-top:10px"><span style="background:' + brandColor + ';color:white;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700">' + metodoPago + '</span></div></div>'
    if (direccion) html += '<div style="padding:12px 16px;background:#FFF8E1;border-top:1px solid #FFE082"><div style="font-size:10px;color:#999;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px">DIRECCION</div><div style="font-size:13px;color:#333">' + direccion + '</div></div>'
    if (notasPedido) html += '<div style="padding:12px 16px;background:#F3F4F6;border-top:1px solid #E5E7EB"><div style="font-size:10px;color:#999;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px">NOTAS</div><div style="font-size:13px;color:#333">' + notasPedido + '</div></div>'
    html += '<div style="padding:16px;text-align:center;border-top:2px dashed #ddd;margin-top:4px"><div style="font-size:11px;color:#999">Gracias por tu pedido!</div></div>'
    html += '<div class="no-print" style="padding:16px;text-align:center"><button onclick="window.print()" style="background:#111;color:white;border:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">Imprimir</button></div>'
    html += '</body></html>'

    const w = window.open('', '_blank', 'width=400,height=700')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print() }, 500)
  }


    const w = window.open('', '_blank', 'width=380,height=700')
    if (!w) return
    w.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Comanda #${(order as any).numero_pedido}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Courier New', monospace; background:white; color:#111; }
  @media print {
    body { width: 80mm; }
    .no-print { display:none; }
  }
</style>
</head>
<body style="padding:0;background:white;max-width:380px;margin:0 auto">

  <!-- HEADER CON LOGO -->
  <div style="background:${brandColor};padding:20px 16px;text-align:center">
    <img src="${logoUrl}" style="width:80px;height:80px;border-radius:16px;object-fit:cover;box-shadow:0 4px 12px rgba(0,0,0,0.3);margin-bottom:10px;display:block;margin-left:auto;margin-right:auto" />
    <div style="font-family:Arial,sans-serif;font-weight:900;font-size:20px;color:white;letter-spacing:1px">${brandName}</div>
    <div style="color:rgba(255,255,255,0.7);font-size:12px;margin-top:2px;font-family:Arial,sans-serif">${fecha}</div>
  </div>

  <!-- NUMERO DE PEDIDO -->
  <div style="background:#111;padding:14px 16px;text-align:center">
    <div style="font-family:Arial,sans-serif;color:rgba(255,255,255,0.6);font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">PEDIDO</div>
    <div style="font-family:Arial,sans-serif;font-weight:900;font-size:36px;color:white;letter-spacing:-1px">#${(order as any).numero_pedido}</div>
    <div style="color:rgba(255,255,255,0.6);font-size:13px;font-family:Arial,sans-serif;margin-top:4px">🕐 ${hora}</div>
  </div>

  <!-- CLIENTE -->
  <div style="padding:14px 16px;background:#F9F9F9;border-bottom:2px solid #eee">
    <div style="font-family:Arial,sans-serif;font-size:10px;color:#999;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px">CLIENTE</div>
    <div style="font-family:Arial,sans-serif;font-weight:700;font-size:18px;color:#111">${user?.nombre || 'Cliente'}</div>
    <div style="font-family:Arial,sans-serif;font-size:13px;color:#666;margin-top:2px">📞 ${user?.whatsapp || ''}</div>
  </div>

  <!-- ITEMS -->
  <div style="padding:4px 16px 0">
    <div style="font-family:Arial,sans-serif;font-size:10px;color:#999;letter-spacing:1.5px;text-transform:uppercase;padding:12px 0 4px">PRODUCTOS</div>
    ${itemsHtml}
  </div>

  <!-- TOTALES -->
  <div style="padding:14px 16px;background:#F9F9F9;border-top:2px solid #eee;margin-top:4px">
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-family:Arial,sans-serif">
      <span style="color:#666;font-size:13px">Subtotal</span>
      <span style="font-size:13px">${formatRD((order as any).total_pagado)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:10px;font-family:Arial,sans-serif">
      <span style="color:#666;font-size:13px">Envío</span>
      <span style="font-size:13px">${(order as any).costo_envio > 0 ? 'RD

  const active = orders.filter(o => !['ENTREGADO','CANCELADO'].includes((o as any).estado))
  const pendientes = active.filter(o => ['PENDIENTE','PAGADO'].includes((o as any).estado))
  const cocina = active.filter(o => (o as any).estado === 'EN_COCINA')
  const listos = active.filter(o => (o as any).estado === 'LISTO')
  const camino = active.filter(o => ['EN_CAMINO','ENVIO_SOLICITADO'].includes((o as any).estado))

  return (
    <div style={{ minHeight:'100dvh', background:'#F4F5F7', fontFamily:'var(--font-body)' }}>
      <style>{`
        @keyframes flash { 0%,100%{opacity:1} 50%{opacity:0.6} }
        @keyframes slideIn { from{transform:translateY(-8px);opacity:0} to{transform:translateY(0);opacity:1} }
        .new-badge { animation: flash 1s ease 4; }
        .card-enter { animation: slideIn 0.3s ease; }
      `}</style>

      {/* HEADER */}
      <header style={{ background:'white', borderBottom:'1px solid #E8EAED', position:'sticky', top:0, zIndex:40, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth:'1200px', margin:'0 auto', padding:'0 20px', display:'flex', alignItems:'center', justifyContent:'space-between', height:'56px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <div style={{ display:'flex', gap:'4px' }}>
              <img src="/logos/logo-arepa.png" style={{ width:'28px', height:'28px', borderRadius:'7px' }} alt="" />
              <img src="/logos/logo-smash.png" style={{ width:'28px', height:'28px', borderRadius:'7px' }} alt="" />
            </div>
            <div>
              <span style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'15px' }}>Admin Panel</span>
              {admin && <span style={{ fontSize:'11px', color:'#9CA3AF', marginLeft:'8px' }}>{admin.nombre} · {admin.rol.toUpperCase()}</span>}
            </div>
            {active.length > 0 && (
              <div style={{ background:'#EF4444', color:'white', borderRadius:'20px', padding:'2px 10px', fontSize:'12px', fontWeight:800, letterSpacing:'-0.3px' }}>
                {active.length} activo{active.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <button onClick={() => { setSound(p => !p); if (!sound) playAlert() }}
              title={sound ? 'Silenciar' : 'Activar sonido'}
              style={{ width:'34px', height:'34px', borderRadius:'8px', background:sound?'#DCFCE7':'#F3F4F6', border:'none', cursor:'pointer', fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {sound ? '🔔' : '🔕'}
            </button>
            <button onClick={() => supabase.auth.signOut().then(() => window.location.href = '/auth/login/admin')}
              style={{ padding:'6px 14px', borderRadius:'8px', border:'1px solid #E4E6EA', background:'white', fontSize:'12px', fontWeight:600, color:'#6B7280', cursor:'pointer' }}>
              Salir
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ maxWidth:'1200px', margin:'0 auto', padding:'0 20px', display:'flex', gap:'0', borderTop:'1px solid #F3F4F6' }}>
          {([
            { k:'activos', l:`Activos${active.length > 0 ? ` (${active.length})` : ''}` },
            { k:'resumen', l:'Resumen' },
            { k:'historial', l:'Historial' },
          ] as const).map(t => (
            <button key={t.k} onClick={() => { setTab(t.k); if (t.k === 'historial') loadHistorial() }}
              style={{ padding:'10px 16px', border:'none', borderBottom:`2px solid ${tab===t.k?'#C41E3A':'transparent'}`, background:'none', fontSize:'13px', fontWeight:tab===t.k?700:500, cursor:'pointer', color:tab===t.k?'#C41E3A':'#6B7280', transition:'all 0.2s' }}>
              {t.l}
            </button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth:'1200px', margin:'0 auto', padding:'16px 20px' }}>

        {/* ACTIVOS — Kanban */}
        {tab === 'activos' && (
          <>
            {active.length === 0 ? (
              <div style={{ textAlign:'center', padding:'80px 20px', color:'#9CA3AF' }}>
                <div style={{ fontSize:'56px', marginBottom:'12px' }}>☕</div>
                <p style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'18px', color:'#374151', marginBottom:'4px' }}>Todo tranquilo por ahora</p>
                <p style={{ fontSize:'14px' }}>Los nuevos pedidos aparecerán aquí automáticamente</p>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:'16px', alignItems:'start' }}>
                {[
                  { title:'Por aprobar', orders: pendientes, color:'#D97706', bg:'#FFFBEB', icon:'⏳' },
                  { title:'En cocina', orders: cocina, color:'#7C3AED', bg:'#F5F3FF', icon:'🍳' },
                  { title:'Listos', orders: listos, color:'#2563EB', bg:'#EFF6FF', icon:'✓' },
                  { title:'En camino', orders: camino, color:'#059669', bg:'#ECFDF5', icon:'🛵' },
                ].filter(col => col.orders.length > 0).map(col => (
                  <div key={col.title}>
                    {/* Column header */}
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px', padding:'0 4px' }}>
                      <span style={{ fontSize:'16px' }}>{col.icon}</span>
                      <span style={{ fontWeight:700, fontSize:'13px', color:'#374151' }}>{col.title}</span>
                      <span style={{ marginLeft:'auto', background:col.bg, color:col.color, borderRadius:'20px', padding:'2px 9px', fontSize:'12px', fontWeight:800 }}>{col.orders.length}</span>
                    </div>
                    {/* Cards */}
                    <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                      {col.orders.map(order => {
                        const isNew = newIds.has(order.id)
                        const isExp = expanded.has(order.id)
                        const estado = (order as any).estado
                        const oc = order.marca === 'AREPA' ? '#C41E3A' : '#0052CC'
                        const user = order.user as any
                        const items = order.items as any[] || []
                        const flujo = ESTADOS_FLOW[estado]
                        const comprobante = (order as any).comprobante_url

                        return (
                          <div key={order.id} className="card-enter"
                            style={{ background:'white', borderRadius:'14px', border:`1.5px solid ${isNew?'#FCA5A5':'#E8EAED'}`, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.05)', transition:'box-shadow 0.2s' }}>

                            {/* Card header */}
                            <div style={{ padding:'10px 14px', borderBottom:'1px solid #F3F4F6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                                <span style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'16px', color:'#0D0F12' }}>#{(order as any).numero_pedido}</span>
                                <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'6px', background:order.marca==='AREPA'?'#FEE2E2':'#DBEAFE', color:oc }}>
                                  {order.marca === 'AREPA' ? '🫓' : '🍔'}
                                </span>
                                {isNew && <span className="new-badge" style={{ fontSize:'10px', fontWeight:800, padding:'2px 7px', borderRadius:'6px', background:'#FEE2E2', color:'#DC2626' }}>NUEVO</span>}
                              </div>
                              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                                <span style={{ fontSize:'11px', color:'#9CA3AF' }}>{timeAgo(order.fecha_orden)}</span>
                                <button onClick={() => setExpanded(p => { const n = new Set(p); n.has(order.id) ? n.delete(order.id) : n.add(order.id); return n })}
                                  style={{ width:'24px', height:'24px', borderRadius:'6px', background:'#F3F4F6', border:'none', cursor:'pointer', fontSize:'12px', transition:'transform 0.2s', transform:isExp?'rotate(180deg)':'none', display:'flex', alignItems:'center', justifyContent:'center' }}>▾</button>
                              </div>
                            </div>

                            {/* Card body */}
                            <div style={{ padding:'12px 14px' }}>
                              {/* Cliente + monto */}
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
                                <div>
                                  <p style={{ fontWeight:700, fontSize:'13px', margin:'0 0 2px', color:'#0D0F12' }}>{user?.nombre}</p>
                                  <p style={{ fontSize:'11px', color:'#9CA3AF', margin:0 }}>📱 {user?.whatsapp}</p>
                                </div>
                                <div style={{ textAlign:'right' }}>
                                  <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'16px', color:oc, margin:0 }}>{formatRD(order.total_pagado)}</p>
                                  <p style={{ fontSize:'10px', color:'#9CA3AF', margin:0 }}>{order.metodo_pago === 'TARJETA' ? '💳' : '🏦'} {order.metodo_pago}</p>
                                </div>
                              </div>

                              {/* Items */}
                              <div style={{ background:'#F7F8FA', borderRadius:'8px', padding:'8px 10px', marginBottom:'10px', fontSize:'12px', color:'#374151' }}>
                                {items.slice(0, isExp ? undefined : 2).map((item: any) => (
                                  <div key={item.id} style={{ display:'flex', justifyContent:'space-between', marginBottom:'2px' }}>
                                    <span>{item.cantidad}× {item.product?.nombre}</span>
                                    <span style={{ fontWeight:600, color:'#6B7280' }}>{formatRD(item.subtotal)}</span>
                                  </div>
                                ))}
                                {!isExp && items.length > 2 && (
                                  <p style={{ color:'#9CA3AF', margin:'4px 0 0', fontSize:'11px' }}>+{items.length-2} más</p>
                                )}
                              </div>

                              {/* Dirección */}
                              {(order as any).direccion_texto && isExp && (
                                <div style={{ fontSize:'11px', color:'#6B7280', marginBottom:'10px', display:'flex', gap:'4px' }}>
                                  <span>📍</span><span style={{ lineHeight:'1.4' }}>{(order as any).direccion_texto}</span>
                                </div>
                              )}

                              {/* Comprobante */}
                              {comprobante && (
                                <a href={comprobante} target="_blank" rel="noreferrer"
                                  style={{ display:'inline-flex', alignItems:'center', gap:'5px', fontSize:'11px', fontWeight:700, color:'#7C3AED', background:'#EDE9FE', padding:'6px 10px', borderRadius:'7px', textDecoration:'none', marginBottom:'10px' }}>
                                  🖼 Ver comprobante
                                </a>
                              )}

                              {/* Actions */}
                              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                                {/* Primary action */}
                                {flujo && (
                                  <button onClick={() => updateStatus(order.id, flujo.next as OrderStatus)}
                                    style={{ flex:1, padding:'9px 12px', background:flujo.color, color:'white', border:'none', borderRadius:'8px', fontWeight:700, fontSize:'12px', cursor:'pointer', minWidth:'110px' }}>
                                    {flujo.nextLabel}
                                  </button>
                                )}
                                {/* Comanda */}
                                <button onClick={() => printComanda(order)}
                                  style={{ padding:'9px 10px', background:'#F3F4F6', color:'#374151', border:'none', borderRadius:'8px', fontWeight:600, fontSize:'12px', cursor:'pointer' }}
                                  title="Imprimir comanda">
                                  🖨
                                </button>
                                {estado === 'LISTO' && (<><button onClick={() => solicitarRepartidor((order as any).id, false)} disabled={pyaLoading === (order as any).id} style={{ padding:'9px 12px', background:'#FF6B00', color:'white', border:'none', borderRadius:'8px', fontWeight:700, fontSize:'11px', cursor:'pointer' }}>🛵 Repartidor</button><button onClick={() => solicitarRepartidor((order as any).id, true)} disabled={pyaLoading === (order as any).id} style={{ padding:'9px 10px', background:'#EEF2FF', color:'#6366F1', border:'none', borderRadius:'8px', fontWeight:700, fontSize:'11px', cursor:'pointer' }}>🧪</button></>)}
                                {/* Cancel */}
                                {!['EN_CAMINO','ENTREGADO'].includes(estado) && (
                                  <button onClick={() => cancelOrder(order.id)}
                                    style={{ padding:'9px 10px', background:'#FEE2E2', color:'#DC2626', border:'none', borderRadius:'8px', fontWeight:600, fontSize:'12px', cursor:'pointer' }}
                                    title="Cancelar pedido">
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* RESUMEN */}
        {tab === 'resumen' && (
          <div>
            <p style={{ fontSize:'13px', color:'#9CA3AF', marginBottom:'16px', fontWeight:600 }}>HOY · {new Date().toLocaleDateString('es-DO', { weekday:'long', day:'numeric', month:'long' }).toUpperCase()}</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'12px', marginBottom:'24px' }}>
              {[
                { label:'Pedidos totales', value:stats.pedidos, icon:'📦', color:'#3B82F6' },
                { label:'Entregados', value:stats.entregados, icon:'✅', color:'#10B981' },
                { label:'Ingresos', value:formatRD(stats.ingresos), icon:'💰', color:'#C41E3A' },
                { label:'Clientes únicos', value:stats.clientes, icon:'👤', color:'#8B5CF6' },
              ].map(s => (
                <div key={s.label} style={{ background:'white', borderRadius:'14px', border:'1px solid #E8EAED', padding:'18px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize:'22px', marginBottom:'10px' }}>{s.icon}</div>
                  <div style={{ fontFamily:'var(--font-display)', fontSize:'28px', fontWeight:900, color:s.color, lineHeight:1 }}>{s.value}</div>
                  <div style={{ fontSize:'12px', color:'#9CA3AF', marginTop:'4px', fontWeight:500 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ background:'white', borderRadius:'14px', border:'1px solid #E8EAED', padding:'18px' }}>
              <p style={{ fontWeight:700, fontSize:'13px', color:'#374151', margin:'0 0 12px' }}>Estado actual</p>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                {[
                  { label:'Por aprobar', count: pendientes.length, color:'#D97706', bg:'#FFFBEB' },
                  { label:'En cocina', count: cocina.length, color:'#7C3AED', bg:'#F5F3FF' },
                  { label:'Listos', count: listos.length, color:'#2563EB', bg:'#EFF6FF' },
                  { label:'En camino', count: camino.length, color:'#059669', bg:'#ECFDF5' },
                ].map(s => (
                  <div key={s.label} style={{ background:s.bg, borderRadius:'10px', padding:'10px 14px', textAlign:'center', minWidth:'90px' }}>
                    <div style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'22px', color:s.color }}>{s.count}</div>
                    <div style={{ fontSize:'11px', color:s.color, fontWeight:600, marginTop:'2px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* HISTORIAL */}
        {tab === 'historial' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {historial.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px', color:'#9CA3AF' }}>
                <p style={{ fontSize:'36px', marginBottom:'8px' }}>📋</p>
                <p style={{ fontWeight:600, fontSize:'14px' }}>Sin historial todavía</p>
              </div>
            ) : historial.map(order => {
              const entregado = (order as any).estado === 'ENTREGADO'
              const oc = order.marca === 'AREPA' ? '#C41E3A' : '#0052CC'
              return (
                <div key={order.id} style={{ background:'white', borderRadius:'12px', border:'1px solid #E8EAED', padding:'12px 16px', display:'flex', alignItems:'center', gap:'12px', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ width:'38px', height:'38px', borderRadius:'10px', background:order.marca==='AREPA'?'#FEE2E2':'#DBEAFE', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0 }}>
                    {order.marca === 'AREPA' ? '🫓' : '🍔'}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <span style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'14px' }}>#{(order as any).numero_pedido}</span>
                      <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'6px', background:entregado?'#DCFCE7':'#FEE2E2', color:entregado?'#15803D':'#DC2626' }}>
                        {entregado ? '✅ Entregado' : '❌ Cancelado'}
                      </span>
                    </div>
                    <p style={{ fontSize:'12px', color:'#9CA3AF', margin:'2px 0 0' }}>
                      {(order.user as any)?.nombre} · {new Date(order.fecha_orden).toLocaleDateString('es-DO', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                    </p>
                  </div>
                  <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'15px', color:oc, flexShrink:0 }}>
                    {formatRD(order.total_pagado)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
+(order as any).costo_envio : 'GRATIS'}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding-top:10px;border-top:2px solid #ddd;font-family:Arial,sans-serif">
      <span style="font-weight:900;font-size:17px">TOTAL</span>
      <span style="font-weight:900;font-size:17px;color:${brandColor}">${formatRD((order as any).total_pagado)}</span>
    </div>
    <div style="margin-top:8px;font-family:Arial,sans-serif">
      <span style="background:${brandColor};color:white;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700">${(order as any).metodo_pago || 'EFECTIVO'}</span>
    </div>
  </div>

  <!-- DIRECCION -->
  ${(order as any).direccion_texto ? `
  <div style="padding:12px 16px;background:#FFF8E1;border-top:1px solid #FFE082">
    <div style="font-family:Arial,sans-serif;font-size:10px;color:#999;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px">DIRECCIÓN DE ENTREGA</div>
    <div style="font-family:Arial,sans-serif;font-size:13px;color:#333">📍 ${(order as any).direccion_texto}</div>
  </div>
  ` : ''}

  <!-- NOTAS -->
  ${(order as any).notas_cliente ? `
  <div style="padding:12px 16px;background:#F3F4F6;border-top:1px solid #E5E7EB">
    <div style="font-family:Arial,sans-serif;font-size:10px;color:#999;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px">NOTAS</div>
    <div style="font-family:Arial,sans-serif;font-size:13px;color:#333">💬 ${(order as any).notas_cliente}</div>
  </div>
  ` : ''}

  <!-- FOOTER -->
  <div style="padding:16px;text-align:center;border-top:2px dashed #ddd;margin-top:4px">
    <div style="font-family:Arial,sans-serif;font-size:11px;color:#999">¡Gracias por tu pedido! 🙏</div>
    <div style="font-family:Arial,sans-serif;font-size:10px;color:#ccc;margin-top:4px">arepa-smash-app.vercel.app</div>
  </div>

  <div class="no-print" style="padding:16px;text-align:center">
    <button onclick="window.print()" style="background:#111;color:white;border:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:Arial,sans-serif">🖨 Imprimir</button>
  </div>

</body>
</html>`)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print() }, 500)
  }

  const active = orders.filter(o => !['ENTREGADO','CANCELADO'].includes((o as any).estado))
  const pendientes = active.filter(o => ['PENDIENTE','PAGADO'].includes((o as any).estado))
  const cocina = active.filter(o => (o as any).estado === 'EN_COCINA')
  const listos = active.filter(o => (o as any).estado === 'LISTO')
  const camino = active.filter(o => ['EN_CAMINO','ENVIO_SOLICITADO'].includes((o as any).estado))

  return (
    <div style={{ minHeight:'100dvh', background:'#F4F5F7', fontFamily:'var(--font-body)' }}>
      <style>{`
        @keyframes flash { 0%,100%{opacity:1} 50%{opacity:0.6} }
        @keyframes slideIn { from{transform:translateY(-8px);opacity:0} to{transform:translateY(0);opacity:1} }
        .new-badge { animation: flash 1s ease 4; }
        .card-enter { animation: slideIn 0.3s ease; }
      `}</style>

      {/* HEADER */}
      <header style={{ background:'white', borderBottom:'1px solid #E8EAED', position:'sticky', top:0, zIndex:40, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth:'1200px', margin:'0 auto', padding:'0 20px', display:'flex', alignItems:'center', justifyContent:'space-between', height:'56px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <div style={{ display:'flex', gap:'4px' }}>
              <img src="/logos/logo-arepa.png" style={{ width:'28px', height:'28px', borderRadius:'7px' }} alt="" />
              <img src="/logos/logo-smash.png" style={{ width:'28px', height:'28px', borderRadius:'7px' }} alt="" />
            </div>
            <div>
              <span style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'15px' }}>Admin Panel</span>
              {admin && <span style={{ fontSize:'11px', color:'#9CA3AF', marginLeft:'8px' }}>{admin.nombre} · {admin.rol.toUpperCase()}</span>}
            </div>
            {active.length > 0 && (
              <div style={{ background:'#EF4444', color:'white', borderRadius:'20px', padding:'2px 10px', fontSize:'12px', fontWeight:800, letterSpacing:'-0.3px' }}>
                {active.length} activo{active.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <button onClick={() => { setSound(p => !p); if (!sound) playAlert() }}
              title={sound ? 'Silenciar' : 'Activar sonido'}
              style={{ width:'34px', height:'34px', borderRadius:'8px', background:sound?'#DCFCE7':'#F3F4F6', border:'none', cursor:'pointer', fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {sound ? '🔔' : '🔕'}
            </button>
            <button onClick={() => supabase.auth.signOut().then(() => window.location.href = '/auth/login/admin')}
              style={{ padding:'6px 14px', borderRadius:'8px', border:'1px solid #E4E6EA', background:'white', fontSize:'12px', fontWeight:600, color:'#6B7280', cursor:'pointer' }}>
              Salir
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ maxWidth:'1200px', margin:'0 auto', padding:'0 20px', display:'flex', gap:'0', borderTop:'1px solid #F3F4F6' }}>
          {([
            { k:'activos', l:`Activos${active.length > 0 ? ` (${active.length})` : ''}` },
            { k:'resumen', l:'Resumen' },
            { k:'historial', l:'Historial' },
          ] as const).map(t => (
            <button key={t.k} onClick={() => { setTab(t.k); if (t.k === 'historial') loadHistorial() }}
              style={{ padding:'10px 16px', border:'none', borderBottom:`2px solid ${tab===t.k?'#C41E3A':'transparent'}`, background:'none', fontSize:'13px', fontWeight:tab===t.k?700:500, cursor:'pointer', color:tab===t.k?'#C41E3A':'#6B7280', transition:'all 0.2s' }}>
              {t.l}
            </button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth:'1200px', margin:'0 auto', padding:'16px 20px' }}>

        {/* ACTIVOS — Kanban */}
        {tab === 'activos' && (
          <>
            {active.length === 0 ? (
              <div style={{ textAlign:'center', padding:'80px 20px', color:'#9CA3AF' }}>
                <div style={{ fontSize:'56px', marginBottom:'12px' }}>☕</div>
                <p style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'18px', color:'#374151', marginBottom:'4px' }}>Todo tranquilo por ahora</p>
                <p style={{ fontSize:'14px' }}>Los nuevos pedidos aparecerán aquí automáticamente</p>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:'16px', alignItems:'start' }}>
                {[
                  { title:'Por aprobar', orders: pendientes, color:'#D97706', bg:'#FFFBEB', icon:'⏳' },
                  { title:'En cocina', orders: cocina, color:'#7C3AED', bg:'#F5F3FF', icon:'🍳' },
                  { title:'Listos', orders: listos, color:'#2563EB', bg:'#EFF6FF', icon:'✓' },
                  { title:'En camino', orders: camino, color:'#059669', bg:'#ECFDF5', icon:'🛵' },
                ].filter(col => col.orders.length > 0).map(col => (
                  <div key={col.title}>
                    {/* Column header */}
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px', padding:'0 4px' }}>
                      <span style={{ fontSize:'16px' }}>{col.icon}</span>
                      <span style={{ fontWeight:700, fontSize:'13px', color:'#374151' }}>{col.title}</span>
                      <span style={{ marginLeft:'auto', background:col.bg, color:col.color, borderRadius:'20px', padding:'2px 9px', fontSize:'12px', fontWeight:800 }}>{col.orders.length}</span>
                    </div>
                    {/* Cards */}
                    <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                      {col.orders.map(order => {
                        const isNew = newIds.has(order.id)
                        const isExp = expanded.has(order.id)
                        const estado = (order as any).estado
                        const oc = order.marca === 'AREPA' ? '#C41E3A' : '#0052CC'
                        const user = order.user as any
                        const items = order.items as any[] || []
                        const flujo = ESTADOS_FLOW[estado]
                        const comprobante = (order as any).comprobante_url

                        return (
                          <div key={order.id} className="card-enter"
                            style={{ background:'white', borderRadius:'14px', border:`1.5px solid ${isNew?'#FCA5A5':'#E8EAED'}`, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.05)', transition:'box-shadow 0.2s' }}>

                            {/* Card header */}
                            <div style={{ padding:'10px 14px', borderBottom:'1px solid #F3F4F6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                                <span style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'16px', color:'#0D0F12' }}>#{(order as any).numero_pedido}</span>
                                <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'6px', background:order.marca==='AREPA'?'#FEE2E2':'#DBEAFE', color:oc }}>
                                  {order.marca === 'AREPA' ? '🫓' : '🍔'}
                                </span>
                                {isNew && <span className="new-badge" style={{ fontSize:'10px', fontWeight:800, padding:'2px 7px', borderRadius:'6px', background:'#FEE2E2', color:'#DC2626' }}>NUEVO</span>}
                              </div>
                              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                                <span style={{ fontSize:'11px', color:'#9CA3AF' }}>{timeAgo(order.fecha_orden)}</span>
                                <button onClick={() => setExpanded(p => { const n = new Set(p); n.has(order.id) ? n.delete(order.id) : n.add(order.id); return n })}
                                  style={{ width:'24px', height:'24px', borderRadius:'6px', background:'#F3F4F6', border:'none', cursor:'pointer', fontSize:'12px', transition:'transform 0.2s', transform:isExp?'rotate(180deg)':'none', display:'flex', alignItems:'center', justifyContent:'center' }}>▾</button>
                              </div>
                            </div>

                            {/* Card body */}
                            <div style={{ padding:'12px 14px' }}>
                              {/* Cliente + monto */}
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
                                <div>
                                  <p style={{ fontWeight:700, fontSize:'13px', margin:'0 0 2px', color:'#0D0F12' }}>{user?.nombre}</p>
                                  <p style={{ fontSize:'11px', color:'#9CA3AF', margin:0 }}>📱 {user?.whatsapp}</p>
                                </div>
                                <div style={{ textAlign:'right' }}>
                                  <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'16px', color:oc, margin:0 }}>{formatRD(order.total_pagado)}</p>
                                  <p style={{ fontSize:'10px', color:'#9CA3AF', margin:0 }}>{order.metodo_pago === 'TARJETA' ? '💳' : '🏦'} {order.metodo_pago}</p>
                                </div>
                              </div>

                              {/* Items */}
                              <div style={{ background:'#F7F8FA', borderRadius:'8px', padding:'8px 10px', marginBottom:'10px', fontSize:'12px', color:'#374151' }}>
                                {items.slice(0, isExp ? undefined : 2).map((item: any) => (
                                  <div key={item.id} style={{ display:'flex', justifyContent:'space-between', marginBottom:'2px' }}>
                                    <span>{item.cantidad}× {item.product?.nombre}</span>
                                    <span style={{ fontWeight:600, color:'#6B7280' }}>{formatRD(item.subtotal)}</span>
                                  </div>
                                ))}
                                {!isExp && items.length > 2 && (
                                  <p style={{ color:'#9CA3AF', margin:'4px 0 0', fontSize:'11px' }}>+{items.length-2} más</p>
                                )}
                              </div>

                              {/* Dirección */}
                              {(order as any).direccion_texto && isExp && (
                                <div style={{ fontSize:'11px', color:'#6B7280', marginBottom:'10px', display:'flex', gap:'4px' }}>
                                  <span>📍</span><span style={{ lineHeight:'1.4' }}>{(order as any).direccion_texto}</span>
                                </div>
                              )}

                              {/* Comprobante */}
                              {comprobante && (
                                <a href={comprobante} target="_blank" rel="noreferrer"
                                  style={{ display:'inline-flex', alignItems:'center', gap:'5px', fontSize:'11px', fontWeight:700, color:'#7C3AED', background:'#EDE9FE', padding:'6px 10px', borderRadius:'7px', textDecoration:'none', marginBottom:'10px' }}>
                                  🖼 Ver comprobante
                                </a>
                              )}

                              {/* Actions */}
                              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                                {/* Primary action */}
                                {flujo && (
                                  <button onClick={() => updateStatus(order.id, flujo.next as OrderStatus)}
                                    style={{ flex:1, padding:'9px 12px', background:flujo.color, color:'white', border:'none', borderRadius:'8px', fontWeight:700, fontSize:'12px', cursor:'pointer', minWidth:'110px' }}>
                                    {flujo.nextLabel}
                                  </button>
                                )}
                                {/* Comanda */}
                                <button onClick={() => printComanda(order)}
                                  style={{ padding:'9px 10px', background:'#F3F4F6', color:'#374151', border:'none', borderRadius:'8px', fontWeight:600, fontSize:'12px', cursor:'pointer' }}
                                  title="Imprimir comanda">
                                  🖨
                                </button>
                                {estado === 'LISTO' && (<><button onClick={() => solicitarRepartidor((order as any).id, false)} disabled={pyaLoading === (order as any).id} style={{ padding:'9px 12px', background:'#FF6B00', color:'white', border:'none', borderRadius:'8px', fontWeight:700, fontSize:'11px', cursor:'pointer' }}>🛵 Repartidor</button><button onClick={() => solicitarRepartidor((order as any).id, true)} disabled={pyaLoading === (order as any).id} style={{ padding:'9px 10px', background:'#EEF2FF', color:'#6366F1', border:'none', borderRadius:'8px', fontWeight:700, fontSize:'11px', cursor:'pointer' }}>🧪</button></>)}
                                {/* Cancel */}
                                {!['EN_CAMINO','ENTREGADO'].includes(estado) && (
                                  <button onClick={() => cancelOrder(order.id)}
                                    style={{ padding:'9px 10px', background:'#FEE2E2', color:'#DC2626', border:'none', borderRadius:'8px', fontWeight:600, fontSize:'12px', cursor:'pointer' }}
                                    title="Cancelar pedido">
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* RESUMEN */}
        {tab === 'resumen' && (
          <div>
            <p style={{ fontSize:'13px', color:'#9CA3AF', marginBottom:'16px', fontWeight:600 }}>HOY · {new Date().toLocaleDateString('es-DO', { weekday:'long', day:'numeric', month:'long' }).toUpperCase()}</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'12px', marginBottom:'24px' }}>
              {[
                { label:'Pedidos totales', value:stats.pedidos, icon:'📦', color:'#3B82F6' },
                { label:'Entregados', value:stats.entregados, icon:'✅', color:'#10B981' },
                { label:'Ingresos', value:formatRD(stats.ingresos), icon:'💰', color:'#C41E3A' },
                { label:'Clientes únicos', value:stats.clientes, icon:'👤', color:'#8B5CF6' },
              ].map(s => (
                <div key={s.label} style={{ background:'white', borderRadius:'14px', border:'1px solid #E8EAED', padding:'18px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize:'22px', marginBottom:'10px' }}>{s.icon}</div>
                  <div style={{ fontFamily:'var(--font-display)', fontSize:'28px', fontWeight:900, color:s.color, lineHeight:1 }}>{s.value}</div>
                  <div style={{ fontSize:'12px', color:'#9CA3AF', marginTop:'4px', fontWeight:500 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ background:'white', borderRadius:'14px', border:'1px solid #E8EAED', padding:'18px' }}>
              <p style={{ fontWeight:700, fontSize:'13px', color:'#374151', margin:'0 0 12px' }}>Estado actual</p>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                {[
                  { label:'Por aprobar', count: pendientes.length, color:'#D97706', bg:'#FFFBEB' },
                  { label:'En cocina', count: cocina.length, color:'#7C3AED', bg:'#F5F3FF' },
                  { label:'Listos', count: listos.length, color:'#2563EB', bg:'#EFF6FF' },
                  { label:'En camino', count: camino.length, color:'#059669', bg:'#ECFDF5' },
                ].map(s => (
                  <div key={s.label} style={{ background:s.bg, borderRadius:'10px', padding:'10px 14px', textAlign:'center', minWidth:'90px' }}>
                    <div style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'22px', color:s.color }}>{s.count}</div>
                    <div style={{ fontSize:'11px', color:s.color, fontWeight:600, marginTop:'2px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* HISTORIAL */}
        {tab === 'historial' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {historial.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px', color:'#9CA3AF' }}>
                <p style={{ fontSize:'36px', marginBottom:'8px' }}>📋</p>
                <p style={{ fontWeight:600, fontSize:'14px' }}>Sin historial todavía</p>
              </div>
            ) : historial.map(order => {
              const entregado = (order as any).estado === 'ENTREGADO'
              const oc = order.marca === 'AREPA' ? '#C41E3A' : '#0052CC'
              return (
                <div key={order.id} style={{ background:'white', borderRadius:'12px', border:'1px solid #E8EAED', padding:'12px 16px', display:'flex', alignItems:'center', gap:'12px', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ width:'38px', height:'38px', borderRadius:'10px', background:order.marca==='AREPA'?'#FEE2E2':'#DBEAFE', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0 }}>
                    {order.marca === 'AREPA' ? '🫓' : '🍔'}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <span style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'14px' }}>#{(order as any).numero_pedido}</span>
                      <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'6px', background:entregado?'#DCFCE7':'#FEE2E2', color:entregado?'#15803D':'#DC2626' }}>
                        {entregado ? '✅ Entregado' : '❌ Cancelado'}
                      </span>
                    </div>
                    <p style={{ fontSize:'12px', color:'#9CA3AF', margin:'2px 0 0' }}>
                      {(order.user as any)?.nombre} · {new Date(order.fecha_orden).toLocaleDateString('es-DO', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                    </p>
                  </div>
                  <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'15px', color:oc, flexShrink:0 }}>
                    {formatRD(order.total_pagado)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
