'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
function formatRD(n: number) { return `RD$${(n||0).toLocaleString('es-DO')}` }

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showGift, setShowGift] = useState<any>(null)
  const [giftUserId, setGiftUserId] = useState('')
  const [giftSearch, setGiftSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const [form, setForm] = useState({
    codigo: '', valor: '', tipo: 'fijo',
    minimo_compra: '0', descripcion: '', expira_dias: '30'
  })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: c }, { data: u }] = await Promise.all([
      supabase.from('coupons').select('*, uses:user_coupons(count)').order('created_at', { ascending: false }),
      supabase.from('users').select('id,nombre,whatsapp,total_compras').order('nombre'),
    ])
    setCoupons(c || [])
    setUsers(u || [])
    setLoading(false)
  }

  function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    setForm(f => ({ ...f, codigo: code }))
  }

  async function createCoupon() {
    if (!form.codigo || !form.valor) return
    setSaving(true)
    const expira = new Date()
    expira.setDate(expira.getDate() + Number(form.expira_dias))
    const { error } = await supabase.from('coupons').insert({
      codigo: form.codigo.toUpperCase().trim(),
      valor: Number(form.valor),
      tipo: form.tipo,
      minimo_compra: Number(form.minimo_compra),
      descripcion: form.descripcion,
      activo: true,
      expira_at: expira.toISOString(),
    })
    if (error) { setMsg('Error: ' + error.message) }
    else { setMsg('✓ Cupón creado'); setShowForm(false); setForm({ codigo:'', valor:'', tipo:'fijo', minimo_compra:'0', descripcion:'', expira_dias:'30' }); loadAll() }
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  async function toggleCoupon(id: string, activo: boolean) {
    await supabase.from('coupons').update({ activo: !activo }).eq('id', id)
    loadAll()
  }

  async function giftCoupon() {
    if (!showGift || !giftUserId) return
    setSaving(true)
    const { error } = await supabase.from('user_coupons').insert({
      user_id: giftUserId,
      coupon_id: showGift.id,
      usado: false,
    })
    if (error) setMsg('Error: ' + error.message)
    else { setMsg('✓ Cupón regalado'); setShowGift(null); setGiftUserId(''); setGiftSearch('') }
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  const filteredUsers = users.filter(u =>
    (u.nombre || '').toLowerCase().includes(giftSearch.toLowerCase()) ||
    (u.whatsapp || '').includes(giftSearch)
  )

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: 'white' }
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'block' }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F8F8', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');*{box-sizing:border-box}input:focus,select:focus,textarea:focus{border-color:#111!important}`}</style>

      {/* HEADER */}
      <div style={{ background: 'white', borderBottom: '1px solid #EBEBEB', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <a href="/admin/dashboard" style={{ fontSize: 13, color: '#6B7280', textDecoration: 'none', fontWeight: 500 }}>← Dashboard</a>
        <div style={{ fontWeight: 800, fontSize: 18, color: '#111', flex: 1 }}>Cupones</div>
        {msg && <div style={{ fontSize: 13, fontWeight: 600, color: msg.startsWith('Error') ? '#DC2626' : '#059669', background: msg.startsWith('Error') ? '#FEF2F2' : '#ECFDF5', padding: '6px 14px', borderRadius: 8 }}>{msg}</div>}
        <button onClick={() => setShowForm(true)}
          style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: '#111', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Nuevo cupón
        </button>
      </div>

      <div style={{ padding: '24px', maxWidth: 960 }}>

        {/* STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total cupones', val: coupons.length },
            { label: 'Activos', val: coupons.filter(c => c.activo).length },
            { label: 'Usados', val: coupons.reduce((a, c) => a + (c.uses?.[0]?.count || 0), 0) },
          ].map((s, i) => (
            <div key={i} style={{ background: 'white', borderRadius: 14, border: '1px solid #EBEBEB', padding: '16px 20px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#111' }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* LISTA */}
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #EBEBEB', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 80px 80px 100px 1fr 90px 80px 110px', gap: 8, padding: '10px 16px', background: '#F9FAFB', fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', borderBottom: '1px solid #F3F4F6' }}>
            <span>Código</span><span>Tipo</span><span>Valor</span><span>Mín. compra</span><span>Descripción</span><span>Vence</span><span style={{ textAlign: 'center' }}>Usos</span><span style={{ textAlign: 'center' }}>Acciones</span>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Cargando...</div>
          ) : coupons.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎟</div>
              <div style={{ fontWeight: 600 }}>No hay cupones aún</div>
            </div>
          ) : coupons.map((c, i) => (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '140px 80px 80px 100px 1fr 90px 80px 110px', gap: 8, padding: '12px 16px', alignItems: 'center', borderTop: i > 0 ? '1px solid #F9FAFB' : 'none', background: c.activo ? 'white' : '#FAFAFA', opacity: c.activo ? 1 : 0.6 }}>
              <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 14, color: '#111', letterSpacing: 1 }}>{c.codigo}</div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: c.tipo === 'fijo' ? '#EFF6FF' : '#F0FDF4', color: c.tipo === 'fijo' ? '#0284C7' : '#059669' }}>
                  {c.tipo === 'fijo' ? 'Fijo' : '%'}
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>
                {c.tipo === 'fijo' ? formatRD(c.valor) : c.valor + '%'}
              </div>
              <div style={{ fontSize: 13, color: '#6B7280' }}>{c.minimo_compra > 0 ? formatRD(c.minimo_compra) : '—'}</div>
              <div style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.descripcion || '—'}</div>
              <div style={{ fontSize: 11, color: c.expira_at && new Date(c.expira_at) < new Date() ? '#DC2626' : '#9CA3AF' }}>
                {c.expira_at ? new Date(c.expira_at).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' }) : '∞'}
              </div>
              <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 14 }}>{c.uses?.[0]?.count || 0}</div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                <button onClick={() => { setShowGift(c); setGiftSearch(''); setGiftUserId('') }}
                  style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: '#ECFDF5', color: '#059669', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  🎁
                </button>
                <button onClick={() => toggleCoupon(c.id, c.activo)}
                  style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: c.activo ? '#FEF2F2' : '#F0FDF4', color: c.activo ? '#DC2626' : '#059669', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {c.activo ? 'OFF' : 'ON'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL CREAR CUPON */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={() => setShowForm(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: 'white', borderRadius: 20, padding: 28, width: '100%', maxWidth: 480, zIndex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#111', marginBottom: 20 }}>Nuevo cupón</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Código</label>
                <input style={inputStyle} value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} placeholder="Ej: VERANO25" maxLength={20} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button onClick={generateCode} style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#F9FAFB', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  🎲 Generar
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Tipo</label>
                <select style={inputStyle} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  <option value="fijo">Monto fijo (RD$)</option>
                  <option value="porcentaje">Porcentaje (%)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>{form.tipo === 'fijo' ? 'Valor (RD$)' : 'Porcentaje (%)'}</label>
                <input style={inputStyle} type="number" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder={form.tipo === 'fijo' ? '100' : '15'} min={1} max={form.tipo === 'porcentaje' ? 100 : undefined} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Mínimo de compra (RD$)</label>
                <input style={inputStyle} type="number" value={form.minimo_compra} onChange={e => setForm(f => ({ ...f, minimo_compra: e.target.value }))} placeholder="0" min={0} />
              </div>
              <div>
                <label style={labelStyle}>Vence en (días)</label>
                <input style={inputStyle} type="number" value={form.expira_dias} onChange={e => setForm(f => ({ ...f, expira_dias: e.target.value }))} placeholder="30" min={1} />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Descripción (opcional)</label>
              <input style={inputStyle} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: Descuento de bienvenida" />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #E5E7EB', background: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#6B7280' }}>Cancelar</button>
              <button onClick={createCoupon} disabled={saving || !form.codigo || !form.valor}
                style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: '#111', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving || !form.codigo || !form.valor ? 0.5 : 1 }}>
                {saving ? 'Creando...' : 'Crear cupón'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGALAR CUPON */}
      {showGift && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={() => setShowGift(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: 'white', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440, zIndex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#111', marginBottom: 4 }}>🎁 Regalar cupón</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#111' }}>{showGift.codigo}</span>
              {' · '}{showGift.tipo === 'fijo' ? formatRD(showGift.valor) : showGift.valor + '%'} de descuento
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Buscar cliente</label>
              <input style={inputStyle} value={giftSearch} onChange={e => { setGiftSearch(e.target.value); setGiftUserId('') }} placeholder="Nombre o WhatsApp..." />
            </div>

            {giftSearch.length > 1 && (
              <div style={{ border: '1.5px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', marginBottom: 16, maxHeight: 220, overflowY: 'auto' }}>
                {filteredUsers.length === 0 ? (
                  <div style={{ padding: 16, color: '#9CA3AF', fontSize: 13, textAlign: 'center' }}>Sin resultados</div>
                ) : filteredUsers.slice(0, 10).map(u => (
                  <button key={u.id} onClick={() => { setGiftUserId(u.id); setGiftSearch(u.nombre + (u.whatsapp ? ' · ' + u.whatsapp : '')) }}
                    style={{ width: '100%', padding: '12px 16px', background: giftUserId === u.id ? '#F0FDF4' : 'white', border: 'none', borderBottom: '1px solid #F9FAFB', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>{u.nombre}</div>
                      <div style={{ fontSize: 12, color: '#9CA3AF' }}>{u.whatsapp}</div>
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>{u.total_compras} pedidos</div>
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowGift(null)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #E5E7EB', background: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#6B7280' }}>Cancelar</button>
              <button onClick={giftCoupon} disabled={saving || !giftUserId}
                style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: '#059669', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving || !giftUserId ? 0.5 : 1 }}>
                {saving ? 'Regalando...' : '🎁 Regalar cupón'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
