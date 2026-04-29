'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
function formatRD(n: number) { return `RD$${Math.round(n||0).toLocaleString('es-DO')}` }
function pct(a: number, b: number) { if (!b) return '—'; const p = ((a-b)/b*100); return (p>0?'+':'')+p.toFixed(1)+'%' }

type Marca = 'GLOBAL' | 'AREPA' | 'SMASH'

export default function ReportsPage() {
  const [marca, setMarca] = useState<Marca>('GLOBAL')
  const [periodo, setPeriodo] = useState<7|30|90>(30)
  const [stats, setStats] = useState<any>(null)
  const [ventas, setVentas] = useState<any[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [marca, periodo])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadStats(), loadVentas(), loadProductos(), loadClientes()])
    setLoading(false)
  }

  async function loadStats() {
    const since = new Date(Date.now() - periodo * 24 * 60 * 60 * 1000).toISOString()
    const sincePrev = new Date(Date.now() - periodo * 2 * 24 * 60 * 60 * 1000).toISOString()

    let q = supabase.from('orders').select('total_pagado,user_id,estado,marca,fecha_orden').neq('estado','CANCELADO').neq('estado','BORRADOR')
    if (marca !== 'GLOBAL') q = q.eq('marca', marca)

    const [curr, prev] = await Promise.all([
      q.gte('fecha_orden', since),
      supabase.from('orders').select('total_pagado,user_id').neq('estado','CANCELADO').neq('estado','BORRADOR').gte('fecha_orden', sincePrev).lt('fecha_orden', since)
    ])

    const d = curr.data || []
    const p = prev.data || []
    const ingresos = d.reduce((a: number, o: any) => a + Number(o.total_pagado), 0)
    const ingresosPrev = p.reduce((a: number, o: any) => a + Number(o.total_pagado), 0)
    const entregados = d.filter((o: any) => o.estado === 'ENTREGADO').length

    setStats({
      pedidos: d.length, pedidosPrev: p.length,
      ingresos, ingresosPrev,
      clientes: new Set(d.map((o: any) => o.user_id)).size,
      ticket: d.length ? ingresos / d.length : 0,
      entregados,
    })
  }

  async function loadVentas() {
    const since = new Date(Date.now() - periodo * 24 * 60 * 60 * 1000).toISOString()
    let q = supabase.from('orders').select('fecha_orden,total_pagado,marca').neq('estado','CANCELADO').neq('estado','BORRADOR').gte('fecha_orden', since)
    if (marca !== 'GLOBAL') q = q.eq('marca', marca)
    const { data } = await q.order('fecha_orden')
    // Agrupar por día
    const map: Record<string, { ingresos: number; pedidos: number }> = {}
    ;(data || []).forEach((o: any) => {
      const dia = o.fecha_orden.slice(0, 10)
      if (!map[dia]) map[dia] = { ingresos: 0, pedidos: 0 }
      map[dia].ingresos += Number(o.total_pagado)
      map[dia].pedidos++
    })
    setVentas(Object.entries(map).map(([dia, v]) => ({ dia, ...v })).slice(-30))
  }

  async function loadProductos() {
    const since = new Date(Date.now() - periodo * 24 * 60 * 60 * 1000).toISOString()
    const { data: orders } = await supabase.from('orders')
      .select('id,marca').neq('estado','CANCELADO').neq('estado','BORRADOR').gte('fecha_orden', since)
    const ids = (orders || []).filter((o: any) => marca === 'GLOBAL' || o.marca === marca).map((o: any) => o.id)
    if (!ids.length) { setProductos([]); return }
    const { data } = await supabase.from('order_items')
      .select('cantidad, precio_unitario, product:products(nombre)')
      .in('order_id', ids)
    const map: Record<string, { nombre: string; unidades: number; ingresos: number }> = {}
    ;(data || []).forEach((i: any) => {
      const n = i.product?.nombre || 'Desconocido'
      if (!map[n]) map[n] = { nombre: n, unidades: 0, ingresos: 0 }
      map[n].unidades += i.cantidad
      map[n].ingresos += i.cantidad * (i.precio_unitario || 0)
    })
    setProductos(Object.values(map).sort((a, b) => b.unidades - a.unidades).slice(0, 8))
  }

  async function loadClientes() {
    const { data } = await supabase.from('users')
      .select('id,nombre,whatsapp,total_compras,total_gastado,fecha_registro,cliente_vip,activo')
      .order('total_compras', { ascending: false })
      .limit(20)
    setClientes(data || [])
  }

  const maxVenta = Math.max(...ventas.map(v => v.ingresos), 1)

  return (
    <div style={{ minHeight: '100vh', background: '#F8F8F8', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#D1D5DB;border-radius:2px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .card{background:white;border-radius:16px;border:1px solid #EBEBEB;padding:20px;animation:fadeUp 0.3s ease}
        .bar{transition:height 0.5s ease}
      `}</style>

      {/* HEADER */}
      <div style={{ background: 'white', borderBottom: '1px solid #EBEBEB', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: '#111', marginRight: 8 }}>Reportes</div>

        {/* Marca selector */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['GLOBAL', 'AREPA', 'SMASH'] as Marca[]).map(m => (
            <button key={m} onClick={() => setMarca(m)}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                background: marca === m ? (m === 'AREPA' ? '#C41E3A' : m === 'SMASH' ? '#0052CC' : '#111') : '#F3F4F6',
                color: marca === m ? 'white' : '#6B7280' }}>
              {m === 'GLOBAL' ? '🌐 Global' : m === 'AREPA' ? '🫓 Arepa' : '🍔 Smash'}
            </button>
          ))}
        </div>

        {/* Periodo selector */}
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {([7, 30, 90] as const).map(p => (
            <button key={p} onClick={() => setPeriodo(p)}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                background: periodo === p ? '#111' : '#F3F4F6', color: periodo === p ? 'white' : '#6B7280' }}>
              {p}d
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '20px 24px', maxWidth: 1200 }}>

        {/* KPI CARDS */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Ingresos', val: formatRD(stats.ingresos), sub: pct(stats.ingresos, stats.ingresosPrev), up: stats.ingresos >= stats.ingresosPrev },
              { label: 'Pedidos', val: stats.pedidos, sub: pct(stats.pedidos, stats.pedidosPrev), up: stats.pedidos >= stats.pedidosPrev },
              { label: 'Clientes únicos', val: stats.clientes, sub: `${periodo}d`, up: true },
              { label: 'Ticket promedio', val: formatRD(stats.ticket), sub: `${stats.entregados} entregados`, up: true },
            ].map((k, i) => (
              <div key={i} className="card">
                <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{k.label}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#111', marginBottom: 4 }}>{k.val}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: k.up ? '#059669' : '#DC2626' }}>{k.sub}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 16 }}>

          {/* GRÁFICO VENTAS POR DÍA */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 20 }}>Ventas por día</div>
            {loading ? (
              <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13 }}>Cargando...</div>
            ) : ventas.length === 0 ? (
              <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13 }}>Sin datos</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 160, overflowX: 'auto' }}>
                {ventas.map((v, i) => {
                  const h = Math.max(4, (v.ingresos / maxVenta) * 140)
                  const barColor = marca === 'SMASH' ? '#0052CC' : marca === 'AREPA' ? '#C41E3A' : '#111'
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: '0 0 auto', minWidth: 28 }}
                      title={`${v.dia}: ${formatRD(v.ingresos)} · ${v.pedidos} pedidos`}>
                      <div className="bar" style={{ width: 20, height: h, background: barColor, borderRadius: '4px 4px 0 0', opacity: 0.85 }} />
                      <div style={{ fontSize: 9, color: '#9CA3AF', transform: 'rotate(-45deg)', transformOrigin: 'center', whiteSpace: 'nowrap' }}>
                        {v.dia.slice(5)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* TOP PRODUCTOS */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 16 }}>Top productos</div>
            {loading ? (
              <div style={{ color: '#9CA3AF', fontSize: 13 }}>Cargando...</div>
            ) : productos.length === 0 ? (
              <div style={{ color: '#9CA3AF', fontSize: 13 }}>Sin datos</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {productos.slice(0, 6).map((p, i) => {
                  const maxU = productos[0].unidades
                  const pctBar = (p.unidades / maxU) * 100
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                          <span style={{ color: '#9CA3AF', marginRight: 6 }}>#{i+1}</span>{p.nombre}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#111', flexShrink: 0 }}>{p.unidades} und</span>
                      </div>
                      <div style={{ height: 4, background: '#F3F4F6', borderRadius: 999 }}>
                        <div style={{ height: '100%', width: pctBar + '%', background: marca === 'SMASH' ? '#0052CC' : '#C41E3A', borderRadius: 999, transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* CLIENTES */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Clientes</div>
            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#6B7280' }}>
              <span>🔁 {clientes.filter(c => c.total_compras > 1).length} recurrentes</span>
              <span>⭐ {clientes.filter(c => c.cliente_vip).length} VIP</span>
              <span>👥 {clientes.length} total</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 380, overflowY: 'auto' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 100px 80px', gap: 8, padding: '6px 10px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', borderBottom: '1px solid #F3F4F6' }}>
              <span>Cliente</span><span style={{ textAlign: 'right' }}>Pedidos</span><span style={{ textAlign: 'right' }}>Gastado</span><span style={{ textAlign: 'right' }}>Registro</span><span style={{ textAlign: 'right' }}>Estado</span>
            </div>
            {loading ? (
              <div style={{ padding: 20, color: '#9CA3AF', fontSize: 13 }}>Cargando...</div>
            ) : clientes.map((c, i) => (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 100px 80px', gap: 8, padding: '10px 10px', fontSize: 13, alignItems: 'center', background: i % 2 === 0 ? 'white' : '#FAFAFA', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: c.cliente_vip ? '#FEF9C3' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                    {c.nombre?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {c.nombre || '—'}
                      {c.cliente_vip && <span style={{ fontSize: 10 }}>⭐</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>📱 {c.whatsapp || '—'}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 700, color: c.total_compras > 3 ? '#059669' : '#111' }}>{c.total_compras || 0}</div>
                <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 12 }}>{formatRD(c.total_gastado || 0)}</div>
                <div style={{ textAlign: 'right', fontSize: 11, color: '#9CA3AF' }}>
                  {c.fecha_registro ? new Date(c.fecha_registro).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' }) : '—'}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                    background: c.activo ? '#ECFDF5' : '#FEF2F2',
                    color: c.activo ? '#059669' : '#DC2626' }}>
                    {c.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
