'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

interface Cliente {
  id: string; nombre: string; whatsapp: string;
  total_gastado: number; total_compras: number;
  cliente_vip: boolean; fecha_registro: string; activo: boolean
}

function formatRD(n: number) { return 'RD$' + (n||0).toLocaleString('es-DO') }

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Cliente | null>(null)
  const [userCoupons, setUserCoupons] = useState<any[]>([])
  const [userInstalls, setUserInstalls] = useState<any[]>([])
  const [userOrders, setUserOrders] = useState<any[]>([])
  const [giftAmt, setGiftAmt] = useState('')
  const [giftMin, setGiftMin] = useState('500')
  const [gifting, setGifting] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { loadClientes() }, [])

  async function loadClientes() {
    setLoading(true)
    const { data } = await supabase.from('users').select('id,nombre,whatsapp,total_gastado,total_compras,cliente_vip,fecha_registro,activo').order('total_gastado', { ascending: false })
    setClientes(data || [])
    setLoading(false)
  }

  async function openCliente(c: Cliente) {
    setSelected(c); setMsg('')
    const [{ data: coupons }, { data: installs }, { data: orders }] = await Promise.all([
      supabase.from('user_coupons').select('*, coupon:coupons(*)').eq('user_id', c.id).order('created_at', { ascending: false }),
      supabase.from('app_installs').select('*').eq('user_id', c.id).order('created_at', { ascending: false }),
      supabase.from('orders').select('id,total,marca,estado,created_at').eq('user_id', c.id).order('created_at', { ascending: false }).limit(10)
    ])
    setUserCoupons(coupons || [])
    setUserInstalls(installs || [])
    setUserOrders(orders || [])
  }

  async function giftCoupon() {
    if (!selected || !giftAmt) return
    setGifting(true); setMsg('')
    const codigo = 'GIFT-' + Math.random().toString(36).substring(2,8).toUpperCase()
    const { data: coupon } = await supabase.from('coupons').insert({
      codigo, valor: parseFloat(giftAmt), tipo: 'fijo',
      minimo_compra: parseFloat(giftMin || '0'),
      descripcion: 'Regalo del administrador',
      activo: true,
      expira_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
    }).select().single()
    if (coupon) {
      await supabase.from('user_coupons').insert({ user_id: selected.id, coupon_id: coupon.id })
      setMsg('Cupon ' + codigo + ' enviado')
      openCliente(selected)
    }
    setGifting(false)
  }

  async function toggleVip(c: Cliente) {
    await supabase.from('users').update({ cliente_vip: !c.cliente_vip }).eq('id', c.id)
    loadClientes()
    if (selected?.id === c.id) setSelected({ ...c, cliente_vip: !c.cliente_vip })
  }

  const filtered = clientes.filter(c =>
    c.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    c.whatsapp?.includes(search)
  )

  return (
    <div style={{ minHeight:'100dvh', background:'#F7F8FA', fontFamily:'var(--font-body)', display:'flex', flexDirection:'column' }}>
      <header style={{ background:'white', borderBottom:'1px solid #E4E6EA', padding:'14px 20px', position:'sticky', top:0, zIndex:20, display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}>
        <h1 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'20px', margin:0 }}>Clientes</h1>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o WhatsApp..."
          style={{ border:'2px solid #E4E6EA', borderRadius:'12px', padding:'8px 14px', fontSize:'14px', outline:'none', width:'280px', fontFamily:'var(--font-body)' }} />
        <div style={{ fontSize:'13px', color:'#9CA3AF', fontWeight:600 }}>{filtered.length} clientes</div>
      </header>

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <div style={{ width: selected ? '340px' : '100%', overflowY:'auto', borderRight:'1px solid #E4E6EA' }}>
          {loading ? <div style={{ padding:'40px', textAlign:'center', color:'#9CA3AF' }}>Cargando...</div> : (
            filtered.map(c => (
              <div key={c.id} onClick={() => openCliente(c)}
                style={{ padding:'14px 20px', borderBottom:'1px solid #F3F4F6', cursor:'pointer', background: selected?.id === c.id ? '#FFF5F5' : 'white', display:'flex', alignItems:'center', gap:'12px' }}>
                <div style={{ width:'40px', height:'40px', borderRadius:'50%', background: c.cliente_vip ? '#FEF3C7' : '#F3F4F6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0 }}>
                  {c.cliente_vip ? '⭐' : (c.nombre?.[0]?.toUpperCase() || '?')}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:800, fontSize:'14px', color:'#1A1A1A' }}>{c.nombre || 'Sin nombre'}</div>
                  <div style={{ fontSize:'12px', color:'#9CA3AF' }}>{c.whatsapp} · {c.total_compras || 0} pedidos</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontWeight:800, fontSize:'13px', color:'#C41E3A' }}>{formatRD(c.total_gastado)}</div>
                  <div style={{ fontSize:'10px', color: c.activo ? '#10B981' : '#EF4444', fontWeight:700 }}>{c.activo ? 'Activo' : 'Inactivo'}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {selected && (
          <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
              <div style={{ width:'56px', height:'56px', borderRadius:'50%', background: selected.cliente_vip ? '#FEF3C7' : '#F3F4F6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px' }}>
                {selected.cliente_vip ? '⭐' : (selected.nombre?.[0]?.toUpperCase() || '?')}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'20px' }}>{selected.nombre}</div>
                <div style={{ fontSize:'13px', color:'#9CA3AF' }}>{selected.whatsapp}</div>
              </div>
              <button onClick={() => toggleVip(selected)}
                style={{ padding:'8px 16px', borderRadius:'999px', border:'none', background: selected.cliente_vip ? '#FEF3C7' : '#F3F4F6', color: selected.cliente_vip ? '#D97706' : '#6B7280', fontSize:'12px', fontWeight:700, cursor:'pointer' }}>
                {selected.cliente_vip ? '⭐ VIP' : 'Hacer VIP'}
              </button>
              <button onClick={() => setSelected(null)} style={{ width:'32px', height:'32px', borderRadius:'50%', background:'#F3F4F6', border:'none', cursor:'pointer', fontSize:'16px', color:'#6B7280' }}>x</button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginBottom:'20px' }}>
              {[
                { label:'Total gastado', val: formatRD(selected.total_gastado) },
                { label:'Pedidos', val: String(selected.total_compras || 0) },
                { label:'App instalada', val: userInstalls.some(i => i.accion === 'install') ? 'Si' : 'No' },
              ].map(s => (
                <div key={s.label} style={{ background:'white', borderRadius:'14px', padding:'14px', textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize:'18px', fontWeight:900, color:'#C41E3A' }}>{s.val}</div>
                  <div style={{ fontSize:'11px', color:'#9CA3AF', marginTop:'2px' }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ background:'white', borderRadius:'16px', padding:'16px', marginBottom:'16px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight:800, fontSize:'14px', marginBottom:'12px' }}>Regalar cupon</div>
              <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                <input type="number" placeholder="Valor RD$" value={giftAmt} onChange={e => setGiftAmt(e.target.value)}
                  style={{ flex:1, minWidth:'100px', border:'2px solid #E4E6EA', borderRadius:'10px', padding:'10px 12px', fontSize:'14px', outline:'none', fontFamily:'var(--font-body)' }} />
                <input type="number" placeholder="Minimo compra" value={giftMin} onChange={e => setGiftMin(e.target.value)}
                  style={{ flex:1, minWidth:'100px', border:'2px solid #E4E6EA', borderRadius:'10px', padding:'10px 12px', fontSize:'14px', outline:'none', fontFamily:'var(--font-body)' }} />
                <button onClick={giftCoupon} disabled={gifting}
                  style={{ padding:'10px 20px', borderRadius:'10px', border:'none', background:'#C41E3A', color:'white', fontSize:'13px', fontWeight:700, cursor:'pointer' }}>
                  {gifting ? '...' : 'Enviar'}
                </button>
              </div>
              {msg && <div style={{ marginTop:'8px', fontSize:'12px', color:'#10B981', fontWeight:700 }}>{msg}</div>}
            </div>

            <div style={{ background:'white', borderRadius:'16px', padding:'16px', marginBottom:'16px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight:800, fontSize:'14px', marginBottom:'12px' }}>Cupones ({userCoupons.length})</div>
              {userCoupons.length === 0 ? <div style={{ fontSize:'13px', color:'#9CA3AF' }}>Sin cupones</div> : (
                userCoupons.map((uc: any) => (
                  <div key={uc.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #F3F4F6' }}>
                    <div>
                      <div style={{ fontSize:'13px', fontWeight:700, fontFamily:'monospace' }}>{uc.coupon?.codigo}</div>
                      <div style={{ fontSize:'11px', color:'#9CA3AF' }}>{uc.coupon?.descripcion}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:'14px', fontWeight:900, color:'#C41E3A' }}>RD${uc.coupon?.valor}</div>
                      <div style={{ fontSize:'10px', fontWeight:700, color: uc.usado ? '#EF4444' : '#10B981' }}>{uc.usado ? 'Usado' : 'Activo'}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ background:'white', borderRadius:'16px', padding:'16px', marginBottom:'16px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight:800, fontSize:'14px', marginBottom:'12px' }}>Historial app</div>
              {userInstalls.length === 0 ? <div style={{ fontSize:'13px', color:'#9CA3AF' }}>Sin registros</div> : (
                userInstalls.map((i: any) => (
                  <div key={i.id} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #F3F4F6' }}>
                    <div style={{ fontSize:'13px', fontWeight:600 }}>{i.accion === 'install' ? 'Instalo' : 'Desinstalo'} · {i.marca}</div>
                    <div style={{ fontSize:'11px', color:'#9CA3AF' }}>{new Date(i.created_at).toLocaleDateString('es-DO')}</div>
                  </div>
                ))
              )}
            </div>

            <div style={{ background:'white', borderRadius:'16px', padding:'16px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight:800, fontSize:'14px', marginBottom:'12px' }}>Ultimos pedidos</div>
              {userOrders.length === 0 ? <div style={{ fontSize:'13px', color:'#9CA3AF' }}>Sin pedidos</div> : (
                userOrders.map((o: any) => (
                  <div key={o.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #F3F4F6' }}>
                    <div>
                      <div style={{ fontSize:'13px', fontWeight:700 }}>#{o.id?.slice(-6).toUpperCase()} · {o.marca}</div>
                      <div style={{ fontSize:'11px', color:'#9CA3AF' }}>{new Date(o.created_at).toLocaleDateString('es-DO')}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:'13px', fontWeight:800, color:'#C41E3A' }}>{formatRD(o.total)}</div>
                      <div style={{ fontSize:'10px', color:'#9CA3AF' }}>{o.estado}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
