'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order, OrderStatus } from '@/types'

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

function playAlert() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    ;[0, 0.15, 0.3].forEach(t => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = 880; o.type = 'sine'
      g.gain.setValueAtTime(0, ctx.currentTime + t)
      g.gain.linearRampToValueAtTime(0.4, ctx.currentTime + t + 0.05)
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + t + 0.15)
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2)
    })
  } catch {}
}

function ripple(e: React.MouseEvent<HTMLButtonElement>, c = 'rgba(255,255,255,0.4)') {
  const b = e.currentTarget, d = Math.max(b.clientWidth, b.clientHeight)
  const r = b.getBoundingClientRect(), s = document.createElement('span')
  s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX-r.left-d/2}px;top:${e.clientY-r.top-d/2}px;position:absolute;border-radius:50%;background:${c};transform:scale(0);animation:rpl 0.5s linear;pointer-events:none;`
  b.appendChild(s); setTimeout(() => s.remove(), 600)
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<'activos'|'resumen'|'historial'>('activos')
  const [orders, setOrders] = useState<Order[]>([])
  const [historial, setHistorial] = useState<Order[]>([])
  const [stats, setStats] = useState({ pedidos: 0, ingresos: 0, nuevos: 0 })
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [sound, setSound] = useState(true)
  const [admin, setAdmin] = useState<{nombre:string;rol:string}|null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const soundRef = useRef(sound)
  soundRef.current = sound

  useEffect(() => {
    checkAuth(); loadOrders(); loadStats()
    const ch = supabase.channel('dash_v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, p => {
        if (p.eventType === 'INSERT') {
          const o = p.new as Order
          setOrders(prev => [o, ...prev])
          setNewIds(prev => new Set([...prev, o.id]))
          loadStats()
          if (soundRef.current) playAlert()
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted')
            new Notification(`🔔 Nuevo pedido #${o.numero_pedido}`, { body: formatRD(o.total_pagado), icon: '/logos/logo-arepa.png' })
          setTimeout(() => setNewIds(prev => { const n = new Set(prev); n.delete(o.id); return n }), 8000)
        } else if (p.eventType === 'UPDATE') {
          setOrders(prev => prev.map(o => o.id === p.new.id ? {...o, ...p.new} : o).filter(o => !['ENTREGADO','CANCELADO'].includes((o as any).estado)))
        }
      }).subscribe()
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission()
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
      .not('estado', 'in', '(ENTREGADO,CANCELADO)').order('fecha_orden', { ascending: false }).limit(50)
    if (data) setOrders(data as Order[])
  }

  async function loadStats() {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('orders').select('total_pagado,user_id').gte('fecha_orden', today).neq('estado', 'CANCELADO')
    if (data) setStats({ pedidos: data.length, ingresos: data.reduce((a,o) => a+(o.total_pagado||0), 0), nuevos: new Set(data.map(o=>o.user_id)).size })
  }

  async function loadHistorial() {
    const { data } = await supabase.from('orders')
      .select('*, user:users(nombre,whatsapp), items:order_items(*, product:products(nombre))')
      .in('estado', ['ENTREGADO','CANCELADO']).order('fecha_orden', { ascending: false }).limit(30)
    if (data) setHistorial(data as Order[])
  }

  async function updateStatus(id: string, estado: OrderStatus) {
    await supabase.from('orders').update({
      estado,
      ...(estado==='EN_COCINA' ? {hora_pago_confirmado: new Date().toISOString()} : {}),
      ...(estado==='LISTO' ? {hora_listo: new Date().toISOString()} : {}),
      ...(estado==='ENTREGADO' ? {hora_entregado: new Date().toISOString()} : {}),
    }).eq('id', id)
  }

  function printComanda(order: Order) {
    const user = order.user as any
    const items = (order.items as any[]||[]).map((i:any) => `${i.cantidad}x ${i.product?.nombre}`).join('\n')
    const w = window.open('', '_blank', 'width=350,height=500')
    if (w) {
      w.document.write(`<pre style="font-family:monospace;font-size:13px;padding:16px">COMANDA #${order.numero_pedido}\n${order.marca}\n${new Date(order.fecha_orden).toLocaleString('es-DO')}\n${'─'.repeat(30)}\nCliente: ${user?.nombre}\nTel: ${user?.whatsapp}\n${'─'.repeat(30)}\n${items}\n${'─'.repeat(30)}\nTotal: ${formatRD(order.total_pagado)}\nPago: ${order.metodo_pago}\n${(order as any).direccion_texto||''}</pre>`)
      w.document.close(); w.focus(); w.print(); w.close()
    }
  }

  function toggleExpand(id: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(id)?n.delete(id):n.add(id); return n })
  }

  const active = orders.filter(o => !['ENTREGADO','CANCELADO'].includes((o as any).estado))
  const bc = '#C41E3A'

  return (
    <div style={{minHeight:'100dvh',background:'#F7F8FA',fontFamily:'var(--font-body)'}}>
      <style>{`@keyframes rpl{to{transform:scale(4);opacity:0}} @keyframes flash{0%,100%{background:white}50%{background:#FEF2F2}} .rpl{position:relative;overflow:hidden;} .new-order{animation:flash 1s ease 4;border-color:#EF4444!important}`}</style>

      <header style={{background:'white',borderBottom:'1px solid #E4E6EA',position:'sticky',top:0,zIndex:30,boxShadow:'0 1px 8px rgba(0,0,0,0.06)'}}>
        <div style={{maxWidth:'900px',margin:'0 auto',padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <div style={{display:'flex',gap:'4px'}}>
              <img src="/logos/logo-arepa.png" style={{width:'30px',height:'30px',borderRadius:'8px'}} alt=""/>
              <img src="/logos/logo-smash.png" style={{width:'30px',height:'30px',borderRadius:'8px'}} alt=""/>
            </div>
            <div>
              <h1 style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:'17px',margin:0,lineHeight:1}}>Admin Panel</h1>
              {admin && <p style={{fontSize:'11px',color:'#9CA3AF',margin:0}}>{admin.nombre} · {admin.rol}</p>}
            </div>
            {active.length > 0 && <div style={{background:'#EF4444',color:'white',borderRadius:'999px',padding:'3px 10px',fontSize:'12px',fontWeight:800}}>{active.length} activo{active.length!==1?'s':''}</div>}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <button onClick={() => {setSound(p=>!p); playAlert()}} className="rpl"
              style={{width:'36px',height:'36px',borderRadius:'50%',background:sound?'#DCFCE7':'#F3F4F6',border:'none',cursor:'pointer',fontSize:'18px',display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
              {sound?'🔔':'🔕'}
            </button>
            <button onClick={() => supabase.auth.signOut().then(()=>window.location.href='/auth/login/admin')}
              style={{padding:'7px 14px',borderRadius:'999px',border:'1px solid #E4E6EA',background:'white',fontSize:'12px',fontWeight:600,color:'#6B7280',cursor:'pointer'}}>
              Salir
            </button>
          </div>
        </div>
        <div style={{maxWidth:'900px',margin:'0 auto',display:'flex',borderTop:'1px solid #F3F4F6'}}>
          {([{k:'activos',l:`📦 Activos${active.length>0?` (${active.length})`:''}`},{k:'resumen',l:'📊 Resumen'},{k:'historial',l:'📋 Historial'}] as const).map(t=>(
            <button key={t.k} onClick={()=>{setTab(t.k);if(t.k==='historial')loadHistorial()}}
              style={{flex:1,padding:'12px 8px',border:'none',background:'none',fontFamily:'var(--font-body)',fontSize:'13px',fontWeight:600,cursor:'pointer',borderBottom:`2px solid ${tab===t.k?bc:'transparent'}`,color:tab===t.k?bc:'#9CA3AF',transition:'all 0.2s'}}>
              {t.l}
            </button>
          ))}
        </div>
      </header>

      <main style={{maxWidth:'900px',margin:'0 auto',padding:'16px'}}>

        {tab==='activos' && (
          <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            {active.length===0 && (
              <div style={{textAlign:'center',padding:'60px 20px',color:'#9CA3AF'}}>
                <p style={{fontSize:'48px',marginBottom:'12px'}}>😴</p>
                <p style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:'18px',color:'#374151',marginBottom:'4px'}}>Sin pedidos activos</p>
                <p style={{fontSize:'14px'}}>Los nuevos pedidos aparecerán aquí en tiempo real</p>
              </div>
            )}
            {active.map(order => {
              const isNew = newIds.has(order.id)
              const isExp = expanded.has(order.id)
              const oc = order.marca==='AREPA'?'#C41E3A':'#0052CC'
              const sc = STATUS_COLORS[(order as any).estado]||'#9CA3AF'
              const user = order.user as any
              const items = order.items as any[]||[]
              return (
                <div key={order.id} className={isNew?'new-order':''}
                  style={{background:'white',borderRadius:'20px',border:`1.5px solid ${isNew?'#EF4444':'#E4E6EA'}`,overflow:'hidden',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
                  <div style={{background:'#F7F8FA',padding:'10px 16px',borderBottom:'1px solid #F0F2F5',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'8px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
                      <span style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:'18px'}}>#{order.numero_pedido}</span>
                      <span style={{fontSize:'11px',fontWeight:700,padding:'3px 10px',borderRadius:'999px',background:order.marca==='AREPA'?'#FEE2E2':'#DBEAFE',color:oc}}>{order.marca==='AREPA'?'🫓 Arepa':'🍔 Smash'}</span>
                      <span style={{fontSize:'11px',fontWeight:700,padding:'3px 10px',borderRadius:'999px',background:`${sc}18`,color:sc}}>{STATUS_LABELS[(order as any).estado]}</span>
                      {isNew && <span style={{fontSize:'11px',fontWeight:800,padding:'3px 10px',borderRadius:'999px',background:'#FEE2E2',color:'#DC2626'}}>🔴 NUEVO</span>}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:'18px',color:oc}}>{formatRD(order.total_pagado)}</div>
                        <div style={{fontSize:'11px',color:'#9CA3AF'}}>{timeAgo(order.fecha_orden)}</div>
                      </div>
                      <button onClick={()=>toggleExpand(order.id)}
                        style={{width:'28px',height:'28px',borderRadius:'50%',background:'#F0F2F5',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',transition:'transform 0.2s',transform:isExp?'rotate(180deg)':'none'}}>▾</button>
                    </div>
                  </div>
                  <div style={{padding:'14px 16px'}}>
                    {user && (
                      <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'12px'}}>
                        <div style={{width:'36px',height:'36px',borderRadius:'50%',background:`${oc}15`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-display)',fontWeight:800,fontSize:'14px',color:oc,flexShrink:0}}>
                          {user.nombre?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p style={{fontWeight:700,fontSize:'14px',margin:'0 0 1px',color:'#0D0F12'}}>{user.nombre}</p>
                          <p style={{fontSize:'12px',color:'#9CA3AF',margin:0}}>📱 {user.whatsapp}</p>
                        </div>
                        <span style={{marginLeft:'auto',fontSize:'12px',fontWeight:700,padding:'4px 10px',borderRadius:'999px',background:order.metodo_pago==='TARJETA'?'#EDE9FE':'#DCFCE7',color:order.metodo_pago==='TARJETA'?'#7C3AED':'#15803D'}}>
                          {order.metodo_pago==='TARJETA'?'💳 Tarjeta':'🏦 Transferencia'}
                        </span>
                      </div>
                    )}
                    <div style={{background:'#F7F8FA',borderRadius:'12px',padding:'10px 14px',marginBottom:'12px'}}>
                      {items.slice(0,isExp?undefined:3).map((item:any)=>(
                        <div key={item.id} style={{display:'flex',justifyContent:'space-between',fontSize:'13px',color:'#374151',marginBottom:'4px'}}>
                          <span>{item.cantidad}× {item.product?.nombre}</span>
                          <span style={{fontWeight:600}}>{formatRD(item.subtotal)}</span>
                        </div>
                      ))}
                      {!isExp && items.length>3 && <button onClick={()=>toggleExpand(order.id)} style={{fontSize:'12px',color:'#9CA3AF',background:'none',border:'none',cursor:'pointer',marginTop:'4px'}}>+{items.length-3} más...</button>}
                    </div>
                    {(order as any).direccion_texto && <div style={{fontSize:'12px',color:'#6B7280',marginBottom:'12px',display:'flex',gap:'6px'}}><span>📍</span><span>{(order as any).direccion_texto}</span></div>}
                    {order.metodo_pago==='TRANSFERENCIA' && (order as any).comprobante_url && (
                      <a href={(order as any).comprobante_url} target="_blank" rel="noreferrer"
                        style={{display:'inline-flex',alignItems:'center',gap:'6px',fontSize:'12px',fontWeight:700,color:'#7C3AED',background:'#EDE9FE',padding:'6px 12px',borderRadius:'8px',textDecoration:'none',marginBottom:'12px'}}>
                        🖼 Ver comprobante
                      </a>
                    )}
                    <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                      {(order as any).estado==='PENDIENTE' && <>
                        <button onClick={(e)=>{ripple(e);updateStatus(order.id,'PAGADO')}} className="rpl" style={{padding:'10px 18px',background:'#10B981',color:'white',border:'none',borderRadius:'999px',fontWeight:700,fontSize:'13px',cursor:'pointer',position:'relative'}}>✅ Aprobar</button>
                        <button onClick={(e)=>{ripple(e);updateStatus(order.id,'CANCELADO')}} className="rpl" style={{padding:'10px 18px',background:'#EF4444',color:'white',border:'none',borderRadius:'999px',fontWeight:700,fontSize:'13px',cursor:'pointer',position:'relative'}}>❌ Rechazar</button>
                      </>}
                      {(order as any).estado==='PAGADO' && <>
                        <button onClick={(e)=>{ripple(e);updateStatus(order.id,'EN_COCINA')}} className="rpl" style={{padding:'10px 18px',background:'#10B981',color:'white',border:'none',borderRadius:'999px',fontWeight:700,fontSize:'13px',cursor:'pointer',position:'relative'}}>✅ Aceptar → Cocina</button>
                        <button onClick={(e)=>{ripple(e);updateStatus(order.id,'CANCELADO')}} className="rpl" style={{padding:'10px 18px',background:'#FEE2E2',color:'#DC2626',border:'none',borderRadius:'999px',fontWeight:700,fontSize:'13px',cursor:'pointer',position:'relative'}}>❌ Cancelar</button>
                      </>}
                      {(order as any).estado==='EN_COCINA' && <button onClick={(e)=>{ripple(e);updateStatus(order.id,'LISTO')}} className="rpl" style={{padding:'10px 18px',background:'#3B82F6',color:'white',border:'none',borderRadius:'999px',fontWeight:700,fontSize:'13px',cursor:'pointer',position:'relative'}}>✓ Marcar Listo</button>}
                      {(order as any).estado==='LISTO' && <button onClick={(e)=>{ripple(e);updateStatus(order.id,'EN_CAMINO')}} className="rpl" style={{padding:'10px 18px',background:'#8B5CF6',color:'white',border:'none',borderRadius:'999px',fontWeight:700,fontSize:'13px',cursor:'pointer',position:'relative'}}>🛵 En Camino</button>}
                      {(order as any).estado==='EN_CAMINO' && <button onClick={(e)=>{ripple(e);updateStatus(order.id,'ENTREGADO')}} className="rpl" style={{padding:'10px 18px',background:'#10B981',color:'white',border:'none',borderRadius:'999px',fontWeight:700,fontSize:'13px',cursor:'pointer',position:'relative'}}>🎉 Entregado</button>}
                      <button onClick={(e)=>{ripple(e);printComanda(order)}} className="rpl" style={{padding:'10px 18px',background:oc,color:'white',border:'none',borderRadius:'999px',fontWeight:700,fontSize:'13px',cursor:'pointer',position:'relative'}}>🖨️ Comanda</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab==='resumen' && (
          <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
              {[{l:'Pedidos hoy',v:stats.pedidos,i:'📦'},{l:'Ingresos hoy',v:formatRD(stats.ingresos),i:'💰'},{l:'Clientes únicos',v:stats.nuevos,i:'👤'},{l:'Rating',v:'⭐ 4.8',i:'⭐'}].map(s=>(
                <div key={s.l} style={{background:'white',borderRadius:'20px',border:'1px solid #E4E6EA',padding:'20px',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
                  <div style={{fontSize:'24px',marginBottom:'10px'}}>{s.i}</div>
                  <div style={{fontFamily:'var(--font-display)',fontSize:'26px',fontWeight:800,color:'#0D0F12',lineHeight:1}}>{s.v}</div>
                  <div style={{fontSize:'12px',color:'#9CA3AF',marginTop:'4px'}}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==='historial' && (
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {historial.length===0 ? (
              <div style={{textAlign:'center',padding:'48px',color:'#9CA3AF'}}>
                <p style={{fontSize:'36px',marginBottom:'8px'}}>📋</p>
                <p style={{fontWeight:600}}>No hay historial todavía</p>
              </div>
            ) : historial.map(order=>(
              <div key={order.id} style={{background:'white',borderRadius:'16px',border:'1px solid #E4E6EA',padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                  <div style={{width:'40px',height:'40px',borderRadius:'12px',background:order.marca==='AREPA'?'#FEE2E2':'#DBEAFE',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px'}}>
                    {order.marca==='AREPA'?'🫓':'🍔'}
                  </div>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                      <span style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:'15px'}}>#{order.numero_pedido}</span>
                      <span style={{fontSize:'11px',fontWeight:700,padding:'2px 8px',borderRadius:'999px',background:(order as any).estado==='ENTREGADO'?'#DCFCE7':'#FEE2E2',color:(order as any).estado==='ENTREGADO'?'#15803D':'#DC2626'}}>
                        {(order as any).estado==='ENTREGADO'?'✅ Entregado':'❌ Cancelado'}
                      </span>
                    </div>
                    <p style={{fontSize:'12px',color:'#9CA3AF',margin:'2px 0 0'}}>
                      {(order.user as any)?.nombre} · {new Date(order.fecha_orden).toLocaleDateString('es-DO',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                    </p>
                  </div>
                </div>
                <div style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:'16px',color:order.marca==='AREPA'?'#C41E3A':'#0052CC',flexShrink:0}}>
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
