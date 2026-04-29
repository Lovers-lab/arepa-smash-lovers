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
    const since = new Date(Date.now() - periodo * 86400000).toISOString()
    const sincePrev = new Date(Date.now() - periodo * 2 * 86400000).toISOString()
    let q = supabase.from('orders').select('total_pagado,user_id,estado,marca').neq('estado','CANCELADO').neq('estado','BORRADOR')
    if (marca !== 'GLOBAL') q = q.eq('marca', marca)
    const [{ data: curr }, { data: prev }] = await Promise.all([
      q.gte('fecha_orden', since),
      supabase.from('orders').select('total_pagado,user_id').neq('estado','CANCELADO').neq('estado','BORRADOR').gte('fecha_orden', sincePrev).lt('fecha_orden', since)
    ])
    const d = curr || [], p = prev || []
    const ingresos = d.reduce((a: number, o: any) => a + Number(o.total_pagado), 0)
    const ingresosPrev = p.reduce((a: number, o: any) => a + Number(o.total_pagado), 0)
    setStats({
      pedidos: d.length, pedidosPrev: p.length,
      ingresos, ingresosPrev,
      clientes: new Set(d.map((o: any) => o.user_id)).size,
      ticket: d.length ? ingresos / d.length : 0,
      entregados: d.filter((o: any) => o.estado === 'ENTREGADO').length,
    })
  }

  async function loadVentas() {
    const since = new Date(Date.now() - periodo * 86400000).toISOString()
    let q = supabase.from('orders').select('fecha_orden,total_pagado').neq('estado','CANCELADO').neq('estado','BORRADOR').gte('fecha_orden', since)
    if (marca !== 'GLOBAL') q = q.eq('marca', marca)
    const { data } = await q.order('fecha_orden')
    const map: Record<string, { ingresos: number; pedidos: number }> = {}
    ;(data || []).forEach((o: any) => {
      const dia = o.fecha_orden.slice(0, 10)
      if (!map[dia]) map[dia] = { ingresos: 0, pedidos: 0 }
      map[dia].ingresos += Number(o.total_pagado)
      map[dia].pedidos++
    })
    setVentas(Object.entries(map).map(([dia, v]) => ({ dia, ...v })))
  }

  async function loadProductos() {
    const since = new Date(Date.now() - periodo * 86400000).toISOString()
    const { data: orders } = await supabase.from('orders').select('id,marca').neq('estado','CANCELADO').neq('estado','BORRADOR').gte('fecha_orden', since)
    const ids = (orders || []).filter((o: any) => marca === 'GLOBAL' || o.marca === marca).map((o: any) => o.id)
    if (!ids.length) { setProductos([]); return }
    const { data } = await supabase.from('order_items').select('cantidad,precio_unitario,product:products(nombre)').in('order_id', ids)
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
    const { data } = await supabase.from('users').select('id,nombre,whatsapp,total_compras,total_gastado,fecha_registro,cliente_vip,activo').order('total_compras', { ascending: false }).limit(30)
    setClientes(data || [])
  }

  const maxVenta = Math.max(...ventas.map(v => v.ingresos), 1)
  const brandColor = marca === 'SMASH' ? '#0052CC' : '#C41E3A'

  return (
    <div style={{ minHeight:'100vh', background:'#F8F8F8', fontFamily:"'Inter',-apple-system,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:#D1D5DB;border-radius:2px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .card{background:white;border-radius:16px;border:1px solid #EBEBEB;padding:20px;animation:fadeUp 0.3s ease}
      `}</style>

      {/* HEADER */}
      <div style={{ background:'white', borderBottom:'1px solid #EBEBEB', padding:'14px 24px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', position:'sticky', top:0, zIndex:10 }}>
        <a href="/admin/dashboard" style={{ fontSize:13, color:'#6B7280', textDecoration:'none', fontWeight:500, display:'flex', alignItems:'center', gap:4 }}>← Dashboard</a>
        <div style={{ fontWeight:800, fontSize:18, color:'#111', flex:1 }}>Reportes</div>
        <div style={{ display:'flex', gap:6 }}>
          {(['GLOBAL','AREPA','SMASH'] as Marca[]).map(m => (
            <button key={m} onClick={() => setMarca(m)} style={{ padding:'7px 16px', borderRadius:8, border:'none', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', background: marca===m ? (m==='AREPA'?'#C41E3A':m==='SMASH'?'#0052CC':'#111') : '#F3F4F6', color: marca===m?'white':'#6B7280', transition:'all 0.15s' }}>
              {m==='GLOBAL'?'🌐 Global':m==='AREPA'?'🫓 Arepa':'🍔 Smash'}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {([7,30,90] as const).map(p => (
            <button key={p} onClick={() => setPeriodo(p)} style={{ padding:'7px 14px', borderRadius:8, border:'none', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', background: periodo===p?'#111':'#F3F4F6', color: periodo===p?'white':'#6B7280' }}>
              {p}d
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:'20px 24px', maxWidth:1200 }}>

        {/* KPIs */}
        {stats && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
            {[
              { label:'Ingresos', val:formatRD(stats.ingresos), sub:pct(stats.ingresos, stats.ingresosPrev), positive: stats.ingresos >= stats.ingresosPrev },
              { label:'Pedidos', val:stats.pedidos, sub:pct(stats.pedidos, stats.pedidosPrev), positive: stats.pedidos >= stats.pedidosPrev },
              { label:'Clientes únicos', val:stats.clientes, sub:`últimos ${periodo} días`, positive:true },
              { label:'Ticket promedio', val:formatRD(stats.ticket), sub:`${stats.entregados} entregados`, positive:true },
            ].map((k,i) => (
              <div key={i} className="card">
                <div style={{ fontSize:10, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>{k.label}</div>
                <div style={{ fontSize:28, fontWeight:900, color:'#111', marginBottom:4 }}>{k.val}</div>
                <div style={{ fontSize:12, fontWeight:600, color: k.positive?'#059669':'#DC2626' }}>{k.sub}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:16, marginBottom:16 }}>

          {/* GRAFICO BARRAS */}
          <div className="card">
            <div style={{ fontSize:13, fontWeight:700, color:'#111', marginBottom:4 }}>Ventas por día</div>
            <div style={{ fontSize:11, color:'#9CA3AF', marginBottom:16 }}>Ingresos · últimos {periodo} días</div>
            {loading ? (
              <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center', color:'#9CA3AF', fontSize:13 }}>Cargando...</div>
            ) : ventas.length === 0 ? (
              <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center', color:'#9CA3AF', fontSize:13 }}>Sin datos para este período</div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:160, minWidth: ventas.length * 28 }}>
                  {ventas.map((v, i) => {
                    const h = Math.max(4, (v.ingresos / maxVenta) * 140)
                    return (
                      <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flex:'0 0 auto', width:24 }}
                        title={`${v.dia}: ${formatRD(v.ingresos)} · ${v.pedidos} pedidos`}>
                        <div style={{ width:16, height:h, background: brandColor, borderRadius:'3px 3px 0 0', opacity:0.8, transition:'height 0.5s ease' }} />
                        <div style={{ fontSize:8, color:'#9CA3AF', transform:'rotate(-45deg)', transformOrigin:'center', whiteSpace:'nowrap' }}>{v.dia.slice(5)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* TOP PRODUCTOS */}
          <div className="card">
            <div style={{ fontSize:13, fontWeight:700, color:'#111', marginBottom:16 }}>Top productos</div>
            {loading ? <div style={{ color:'#9CA3AF', fontSize:13 }}>Cargando...</div> : productos.length === 0 ? <div style={{ color:'#9CA3AF', fontSize:13 }}>Sin datos</div> : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {productos.map((p, i) => {
                  const w = (p.unidades / productos[0].unidades) * 100
                  return (
                    <div key={i}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                        <span style={{ fontSize:12, fontWeight:600, color:'#374151', display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:10, fontWeight:800, color:'#9CA3AF', width:16 }}>#{i+1}</span>
                          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:160 }}>{p.nombre}</span>
                        </span>
                        <span style={{ fontSize:12, fontWeight:800, color:'#111', flexShrink:0, marginLeft:4 }}>{p.unidades}</span>
                      </div>
                      <div style={{ height:5, background:'#F3F4F6', borderRadius:999 }}>
                        <div style={{ height:'100%', width:w+'%', background:brandColor, borderRadius:999, transition:'width 0.6s ease' }} />
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
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#111' }}>Clientes</div>
              <div style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>Ordenados por frecuencia de compra</div>
            </div>
            <div style={{ display:'flex', gap:16 }}>
              {[
                { label:'Total', val: clientes.length, color:'#6B7280' },
                { label:'Recurrentes', val: clientes.filter(c => c.total_compras > 1).length, color:'#059669' },
                { label:'VIP', val: clientes.filter(c => c.cliente_vip).length, color:'#D97706' },
                { label:'Inactivos', val: clientes.filter(c => !c.activo).length, color:'#DC2626' },
              ].map((s,i) => (
                <div key={i} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:18, fontWeight:800, color:s.color }}>{s.val}</div>
                  <div style={{ fontSize:10, color:'#9CA3AF', fontWeight:500 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderRadius:12, overflow:'hidden', border:'1px solid #F3F4F6' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 110px 90px 80px 80px', gap:8, padding:'8px 14px', background:'#F9FAFB', fontSize:10, fontWeight:700, color:'#9CA3AF', letterSpacing:1, textTransform:'uppercase' }}>
              <span>Cliente</span><span style={{ textAlign:'center' }}>Pedidos</span><span style={{ textAlign:'right' }}>Total gastado</span><span style={{ textAlign:'center' }}>Registro</span><span style={{ textAlign:'center' }}>Tipo</span><span style={{ textAlign:'center' }}>Estado</span>
            </div>
            {loading ? (
              <div style={{ padding:24, color:'#9CA3AF', fontSize:13, textAlign:'center' }}>Cargando clientes...</div>
            ) : clientes.map((c, i) => (
              <div key={c.id} style={{ display:'grid', gridTemplateColumns:'1fr 80px 110px 90px 80px 80px', gap:8, padding:'11px 14px', alignItems:'center', background: i%2===0?'white':'#FAFAFA', borderTop: i>0?'1px solid #F9FAFB':'none' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                  <div style={{ width:32, height:32, borderRadius:'50%', background: c.cliente_vip ? '#FEF3C7' : c.total_compras > 3 ? '#ECFDF5' : '#F3F4F6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0, color: c.cliente_vip ? '#D97706' : c.total_compras > 3 ? '#059669' : '#6B7280' }}>
                    {c.nombre?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:13, color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.nombre || '—'}</div>
                    <div style={{ fontSize:11, color:'#9CA3AF' }}>{c.whatsapp || '—'}</div>
                  </div>
                </div>
                <div style={{ textAlign:'center', fontWeight:800, fontSize:14, color: c.total_compras > 5 ? '#059669' : c.total_compras > 1 ? '#0284C7' : '#111' }}>
                  {c.total_compras || 0}
                </div>
                <div style={{ textAlign:'right', fontWeight:600, fontSize:13 }}>{formatRD(c.total_gastado || 0)}</div>
                <div style={{ textAlign:'center', fontSize:11, color:'#9CA3AF' }}>
                  {c.fecha_registro ? new Date(c.fecha_registro).toLocaleDateString('es-DO', { day:'numeric', month:'short', year:'2-digit' }) : '—'}
                </div>
                <div style={{ textAlign:'center' }}>
                  {c.cliente_vip
                    ? <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:999, background:'#FEF3C7', color:'#D97706' }}>⭐ VIP</span>
                    : c.total_compras > 3
                    ? <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:999, background:'#ECFDF5', color:'#059669' }}>🔁 Fiel</span>
                    : <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:999, background:'#F3F4F6', color:'#9CA3AF' }}>Nuevo</span>
                  }
                </div>
                <div style={{ textAlign:'center' }}>
                  <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:999, background: c.activo?'#ECFDF5':'#FEF2F2', color: c.activo?'#059669':'#DC2626' }}>
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
