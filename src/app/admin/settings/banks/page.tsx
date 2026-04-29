'use client'

import { useEffect, useState } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'

const supabase = createAdminClient()

interface BankAccount {
  id: string
  marca: string
  banco_nombre: string
  banco_tipo: string
  banco_cuenta: string
  banco_titular: string
  banco_ruc?: string
  instrucciones?: string
  activo: boolean
  orden: number
}

const EMPTY: Partial<BankAccount> = {
  marca: 'AMBAS', banco_nombre: '', banco_tipo: 'Ahorros',
  banco_cuenta: '', banco_titular: '', banco_ruc: '', instrucciones: '', activo: true
}

const BANCOS_RD = [
  'Banco León', 'BHD León', 'Banco Popular', 'Banreservas',
  'Scotiabank', 'Promerica', 'Banco Santa Cruz', 'Asociación Popular',
  'Banco Caribe', 'Otro'
]

export default function AdminBankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<BankAccount | null>(null)
  const [form, setForm] = useState<Partial<BankAccount>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('bank_accounts')
      .select('*')
      .order('orden')
    setAccounts(data as BankAccount[] || [])
    setLoading(false)
  }

  async function save() {
    if (!form.banco_nombre || !form.banco_cuenta || !form.banco_titular) return
    setSaving(true)
    const payload = {
      marca: form.marca,
      banco_nombre: form.banco_nombre!.trim(),
      banco_tipo: form.banco_tipo || 'Ahorros',
      banco_cuenta: form.banco_cuenta!.trim(),
      banco_titular: form.banco_titular!.trim(),
      banco_ruc: form.banco_ruc?.trim() || null,
      instrucciones: form.instrucciones?.trim() || null,
      activo: form.activo ?? true,
      orden: editing ? editing.orden : accounts.length,
    }
    if (editing) {
      await supabase.from('bank_accounts').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('bank_accounts').insert(payload)
    }
    await load()
    setShowForm(false); setEditing(null); setForm(EMPTY)
    setSaving(false)
  }

  async function toggleActive(acc: BankAccount) {
    await supabase.from('bank_accounts').update({ activo: !acc.activo }).eq('id', acc.id)
    setAccounts(prev => prev.map(a => a.id === acc.id ? { ...a, activo: !a.activo } : a))
  }

  async function deleteAccount(acc: BankAccount) {
    if (!confirm(`¿Eliminar cuenta de ${acc.banco_nombre}?`)) return
    await supabase.from('bank_accounts').delete().eq('id', acc.id)
    setAccounts(prev => prev.filter(a => a.id !== acc.id))
  }

  async function moveOrder(acc: BankAccount, dir: -1 | 1) {
    const idx = accounts.findIndex(a => a.id === acc.id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= accounts.length) return
    const swap = accounts[swapIdx]
    await Promise.all([
      supabase.from('bank_accounts').update({ orden: swap.orden }).eq('id', acc.id),
      supabase.from('bank_accounts').update({ orden: acc.orden }).eq('id', swap.id),
    ])
    await load()
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  function setF(key: string, val: any) {
    setForm(p => ({ ...p, [key]: val }))
  }

  const getBankEmoji = (nombre: string) => {
    if (nombre.includes('León')) return '🏦'
    if (nombre.includes('Popular')) return '🏛️'
    if (nombre.includes('Reservas') || nombre.includes('reservas')) return '🏦'
    if (nombre.includes('Scotia')) return '🔴'
    return '🏦'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F8FA', paddingBottom: '80px', fontFamily: 'var(--font-body)' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #E4E6EA', padding: '14px 20px', position: 'sticky', top: 0, zIndex: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 800 }}>🏦 Cuentas Bancarias</h1>
            <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>Los clientes verán estas cuentas al elegir transferencia</p>
          </div>
          <button onClick={() => { setShowForm(true); setEditing(null); setForm(EMPTY) }}
            style={{ padding: '10px 18px', background: '#C41E3A', color: 'white', border: 'none', borderRadius: '999px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
            + Nueva cuenta
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>

        {/* Info */}
        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '14px', padding: '14px 16px', marginBottom: '16px', fontSize: '13px', color: '#1E40AF', display: 'flex', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>💡</span>
          <div>
            <strong>¿Cómo funciona?</strong> El cliente ve todas las cuentas activas y puede copiar el número con un toque. Solo ve las cuentas de la marca que está comprando.
          </div>
        </div>

        {/* Preview de cómo lo ve el cliente */}
        {accounts.filter(a => a.activo).length > 0 && (
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E4E6EA', padding: '16px', marginBottom: '16px' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#9CA3AF', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              👁 Vista previa del cliente
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: accounts.filter(a => a.activo).length > 1 ? '1fr 1fr' : '1fr', gap: '10px' }}>
              {accounts.filter(a => a.activo).slice(0, 4).map(acc => (
                <div key={acc.id} style={{ background: '#F7F8FA', borderRadius: '12px', padding: '12px', border: '1px solid #E4E6EA' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{getBankEmoji(acc.banco_nombre)}</span>
                    <span style={{ fontWeight: 700, fontSize: '13px' }}>{acc.banco_nombre}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '4px' }}>{acc.banco_tipo} · {acc.banco_titular}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white', borderRadius: '8px', padding: '8px 10px', border: '1px solid #E4E6EA' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700 }}>{acc.banco_cuenta}</span>
                    <button onClick={() => copyToClipboard(acc.banco_cuenta, acc.id)}
                      style={{ padding: '4px 10px', background: copied === acc.id ? '#DCFCE7' : '#C41E3A', color: copied === acc.id ? '#15803D' : 'white', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
                      {copied === acc.id ? '✓ Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Accounts list */}
        {loading ? (
          <p style={{ textAlign: 'center', color: '#9CA3AF', padding: '40px' }}>Cargando...</p>
        ) : accounts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9CA3AF' }}>
            <p style={{ fontSize: '40px', marginBottom: '8px' }}>🏦</p>
            <p style={{ fontWeight: 600, fontSize: '15px' }}>No hay cuentas bancarias</p>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>Agrega las cuentas donde recibes transferencias</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {accounts.map((acc, idx) => (
              <div key={acc.id} style={{ background: 'white', borderRadius: '16px', border: `1.5px solid ${acc.activo ? '#E4E6EA' : '#F3F4F6'}`, padding: '16px', opacity: acc.activo ? 1 : 0.6 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '20px' }}>{getBankEmoji(acc.banco_nombre)}</span>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '16px' }}>{acc.banco_nombre}</span>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: '#F3F4F6', color: '#6B7280', fontWeight: 600 }}>{acc.banco_tipo}</span>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: acc.marca === 'AMBAS' ? '#EDE9FE' : acc.marca === 'AREPA' ? '#FEE2E2' : '#DBEAFE', color: acc.marca === 'AMBAS' ? '#7C3AED' : acc.marca === 'AREPA' ? '#DC2626' : '#1D4ED8', fontWeight: 700 }}>
                        {acc.marca === 'AMBAS' ? 'Ambas marcas' : acc.marca === 'AREPA' ? '🫓 Arepa' : '🍔 Smash'}
                      </span>
                    </div>
                    <div style={{ background: '#F7F8FA', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div>
                        <div style={{ fontFamily: 'monospace', fontSize: '15px', fontWeight: 700 }}>{acc.banco_cuenta}</div>
                        <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>{acc.banco_titular}</div>
                      </div>
                      <button onClick={() => copyToClipboard(acc.banco_cuenta, acc.id)}
                        style={{ padding: '6px 14px', background: copied === acc.id ? '#DCFCE7' : '#C41E3A', color: copied === acc.id ? '#15803D' : 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}>
                        {copied === acc.id ? '✓ Copiado' : 'Copiar'}
                      </button>
                    </div>
                    {acc.instrucciones && (
                      <p style={{ fontSize: '12px', color: '#9CA3AF' }}>📌 {acc.instrucciones}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => moveOrder(acc, -1)} disabled={idx === 0}
                      style={{ padding: '6px 10px', background: '#F3F4F6', border: 'none', borderRadius: '8px', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.3 : 1, fontSize: '14px' }}>↑</button>
                    <button onClick={() => moveOrder(acc, 1)} disabled={idx === accounts.length - 1}
                      style={{ padding: '6px 10px', background: '#F3F4F6', border: 'none', borderRadius: '8px', cursor: idx === accounts.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === accounts.length - 1 ? 0.3 : 1, fontSize: '14px' }}>↓</button>
                  </div>
                </div>

                {/* Row actions */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                  <button onClick={() => toggleActive(acc)}
                    style={{ padding: '7px 14px', background: acc.activo ? '#FEF3C7' : '#DCFCE7', color: acc.activo ? '#92400E' : '#15803D', border: 'none', borderRadius: '999px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                    {acc.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => { setEditing(acc); setForm({ ...acc }); setShowForm(true) }}
                    style={{ padding: '7px 14px', background: '#DBEAFE', color: '#1D4ED8', border: 'none', borderRadius: '999px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                    ✏️ Editar
                  </button>
                  <button onClick={() => deleteAccount(acc)}
                    style={{ padding: '7px 14px', background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '999px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                    🗑 Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowForm(false); setEditing(null) } }}>
          <div style={{ background: 'white', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18px' }}>
                {editing ? 'Editar cuenta' : 'Nueva cuenta bancaria'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditing(null) }}
                style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#F3F4F6', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#6B7280' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Banco */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: '6px' }}>Banco *</label>
                <select value={form.banco_nombre} onChange={e => setF('banco_nombre', e.target.value)}
                  style={{ width: '100%', border: '2px solid #E4E6EA', borderRadius: '12px', padding: '12px 14px', fontSize: '14px', outline: 'none', fontFamily: 'var(--font-body)', background: 'white' }}>
                  <option value="">Selecciona un banco...</option>
                  {BANCOS_RD.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                {form.banco_nombre === 'Otro' && (
                  <input placeholder="Nombre del banco" value={form.banco_nombre === 'Otro' ? '' : form.banco_nombre}
                    onChange={e => setF('banco_nombre', e.target.value)}
                    style={{ width: '100%', border: '2px solid #E4E6EA', borderRadius: '12px', padding: '12px 14px', fontSize: '14px', outline: 'none', fontFamily: 'var(--font-body)', marginTop: '8px' }}
                  />
                )}
              </div>

              {/* Tipo */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: '6px' }}>Tipo de cuenta</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['Ahorros', 'Corriente'].map(tipo => (
                    <button key={tipo} onClick={() => setF('banco_tipo', tipo)}
                      style={{ flex: 1, padding: '10px', border: `2px solid ${form.banco_tipo === tipo ? '#C41E3A' : '#E4E6EA'}`, borderRadius: '12px', background: form.banco_tipo === tipo ? '#FEE2E2' : 'white', color: form.banco_tipo === tipo ? '#C41E3A' : '#6B7280', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
                      {tipo}
                    </button>
                  ))}
                </div>
              </div>

              {/* Número de cuenta */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: '6px' }}>Número de cuenta *</label>
                <input placeholder="Ej: 2100-1234567-8" value={form.banco_cuenta || ''}
                  onChange={e => setF('banco_cuenta', e.target.value)}
                  style={{ width: '100%', border: '2px solid #E4E6EA', borderRadius: '12px', padding: '12px 14px', fontSize: '15px', outline: 'none', fontFamily: 'monospace', letterSpacing: '0.5px' }}
                />
              </div>

              {/* Titular */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: '6px' }}>Titular *</label>
                <input placeholder="Ej: Juan Nachón" value={form.banco_titular || ''}
                  onChange={e => setF('banco_titular', e.target.value)}
                  style={{ width: '100%', border: '2px solid #E4E6EA', borderRadius: '12px', padding: '12px 14px', fontSize: '14px', outline: 'none', fontFamily: 'var(--font-body)' }}
                />
              </div>

              {/* RUC opcional */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: '6px' }}>RNC / Cédula (opcional)</label>
                <input placeholder="Ej: 402-0123456-7" value={form.banco_ruc || ''}
                  onChange={e => setF('banco_ruc', e.target.value)}
                  style={{ width: '100%', border: '2px solid #E4E6EA', borderRadius: '12px', padding: '12px 14px', fontSize: '14px', outline: 'none', fontFamily: 'var(--font-body)' }}
                />
              </div>

              {/* Instrucciones */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: '6px' }}>Instrucciones (opcional)</label>
                <input placeholder='Ej: Poner referencia "Pedido #XXX"' value={form.instrucciones || ''}
                  onChange={e => setF('instrucciones', e.target.value)}
                  style={{ width: '100%', border: '2px solid #E4E6EA', borderRadius: '12px', padding: '12px 14px', fontSize: '14px', outline: 'none', fontFamily: 'var(--font-body)' }}
                />
              </div>

              {/* Marca */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: '6px' }}>¿Para qué marca?</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { val: 'AMBAS', label: '🏦 Ambas marcas' },
                    { val: 'AREPA', label: '🫓 Solo Arepa' },
                    { val: 'SMASH', label: '🍔 Solo Smash' },
                  ].map(m => (
                    <button key={m.val} onClick={() => setF('marca', m.val)}
                      style={{ flex: 1, padding: '10px 6px', border: `2px solid ${form.marca === m.val ? '#C41E3A' : '#E4E6EA'}`, borderRadius: '12px', background: form.marca === m.val ? '#FEE2E2' : 'white', color: form.marca === m.val ? '#C41E3A' : '#6B7280', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 20px', borderTop: '1px solid #F3F4F6' }}>
              <button onClick={save}
                disabled={saving || !form.banco_nombre || !form.banco_cuenta || !form.banco_titular}
                style={{ width: '100%', padding: '16px', background: (!form.banco_nombre || !form.banco_cuenta || !form.banco_titular) ? '#E4E6EA' : '#C41E3A', color: (!form.banco_nombre || !form.banco_cuenta || !form.banco_titular) ? '#9CA3AF' : 'white', border: 'none', borderRadius: '14px', fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 800, cursor: 'pointer' }}>
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar cuenta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
