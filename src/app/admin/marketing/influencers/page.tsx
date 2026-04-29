'use client'

import { useEffect, useState } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import type { InfluencerCode } from '@/types'

const supabase = createAdminClient()
function formatRD(n: number) { return `RD$${n.toLocaleString('es-DO')}` }

const EMPTY: Partial<InfluencerCode> = {
  codigo: '', nombre_influencer: '', whatsapp_influencer: '',
  porcentaje_comision: 10, descripcion: '', activo: true, tipo_pago: 'TRANSFER'
}

export default function AdminInfluencersPage() {
  const [codes, setCodes] = useState<InfluencerCode[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<InfluencerCode | null>(null)
  const [form, setForm] = useState<Partial<InfluencerCode>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [liquidating, setLiquidating] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('influencer_codes').select('*').order('created_at', { ascending: false })
    setCodes(data as InfluencerCode[] || [])
    setLoading(false)
  }

  async function save() {
    if (!form.codigo?.trim() || !form.nombre_influencer?.trim()) {
      setError('Código y nombre son requeridos'); return
    }
    setSaving(true); setError('')
    const payload = {
      codigo: form.codigo!.toUpperCase().trim(),
      nombre_influencer: form.nombre_influencer!.trim(),
      whatsapp_influencer: form.whatsapp_influencer || null,
      porcentaje_comision: form.porcentaje_comision || 10,
      descripcion: form.descripcion || null,
      activo: form.activo ?? true,
      tipo_pago: form.tipo_pago || 'TRANSFER',
    }
    if (editing) {
      await supabase.from('influencer_codes').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('influencer_codes').insert({ ...payload, saldo_acumulado: 0 })
    }
    await load()
    setShowForm(false); setEditing(null); setForm(EMPTY)
    setSaving(false)
  }

  async function toggleActive(code: InfluencerCode) {
    await supabase.from('influencer_codes').update({ activo: !code.activo }).eq('id', code.id)
    setCodes(prev => prev.map(c => c.id === code.id ? { ...c, activo: !c.activo } : c))
  }

  async function liquidate(code: InfluencerCode) {
    if (!confirm(`¿Liquidar RD$${code.saldo_acumulado} a ${code.nombre_influencer}?`)) return
    setLiquidating(code.id)
    await supabase.from('influencer_codes').update({ saldo_acumulado: 0 }).eq('id', code.id)
    // In production: create a liquidation record and optionally notify via WhatsApp
    await load()
    setLiquidating(null)
  }

  function openEdit(code: InfluencerCode) {
    setEditing(code)
    setForm({ ...code })
    setShowForm(true)
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-black text-lg" style={{ fontFamily: 'Syne, serif' }}>🎤 Códigos Influencer</h1>
          <button onClick={() => { setShowForm(true); setEditing(null); setForm(EMPTY) }}
            className="px-4 py-2 rounded-xl text-white font-bold text-sm bg-gray-900">
            + Nuevo código
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="font-black text-xl">{codes.filter(c => c.activo).length}</p>
            <p className="text-xs text-gray-400">Códigos activos</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="font-black text-xl text-amber-600">{formatRD(codes.reduce((a, c) => a + c.saldo_acumulado, 0))}</p>
            <p className="text-xs text-gray-400">Comisiones pendientes</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="font-black text-xl">{codes.length}</p>
            <p className="text-xs text-gray-400">Total influencers</p>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-10 text-gray-400">Cargando...</div>
        ) : (
          <div className="space-y-3">
            {codes.map(code => (
              <div key={code.id} className={`bg-white rounded-2xl border border-gray-100 p-4 ${!code.activo ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="bg-gray-100 px-3 py-1 rounded-lg font-black text-sm">{code.codigo}</code>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${code.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {code.activo ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900 mt-1">{code.nombre_influencer}</p>
                    {code.whatsapp_influencer && <p className="text-xs text-gray-400">{code.whatsapp_influencer}</p>}
                    {code.descripcion && <p className="text-xs text-gray-400 mt-0.5">{code.descripcion}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-black text-lg text-amber-600">{formatRD(code.saldo_acumulado)}</p>
                    <p className="text-xs text-gray-400">{code.porcentaje_comision}% comisión</p>
                    <p className="text-xs text-gray-400">{code.tipo_pago === 'TRANSFER' ? 'Pago: Transferencia' : 'Pago: Crédito comida'}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {code.saldo_acumulado > 0 && (
                    <button onClick={() => liquidate(code)} disabled={liquidating === code.id}
                      className="px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50">
                      {liquidating === code.id ? '⏳ Liquidando...' : `💰 Liquidar ${formatRD(code.saldo_acumulado)}`}
                    </button>
                  )}
                  <button onClick={() => openEdit(code)} className="px-4 py-2 bg-blue-50 text-blue-600 text-xs font-bold rounded-xl hover:bg-blue-100 transition-colors">✏️ Editar</button>
                  <button onClick={() => toggleActive(code)} className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-xl hover:bg-gray-200 transition-colors">
                    {code.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            ))}
            {codes.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <p className="text-3xl mb-2">🎤</p>
                <p>No hay códigos creados todavía</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-black" style={{ fontFamily: 'Syne, serif' }}>
                {editing ? 'Editar influencer' : 'Nuevo código'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditing(null) }} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-4 space-y-3">
              {[
                { label: 'Código único *', key: 'codigo', placeholder: 'CARLOSCHEF', upper: true },
                { label: 'Nombre del influencer *', key: 'nombre_influencer', placeholder: 'Carlos García' },
                { label: 'WhatsApp influencer', key: 'whatsapp_influencer', placeholder: '809-555-1234' },
                { label: 'Descripción', key: 'descripcion', placeholder: 'Instagram 50K seguidores' },
              ].map(f => (
                <div key={f.key} className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">{f.label}</label>
                  <input placeholder={f.placeholder}
                    value={(form as any)[f.key] || ''}
                    onChange={e => setForm(p => ({ ...p, [f.key]: f.upper ? e.target.value.toUpperCase() : e.target.value }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors" />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">% Comisión *</label>
                  <input type="number" min={1} max={50}
                    value={form.porcentaje_comision || 10}
                    onChange={e => setForm(p => ({ ...p, porcentaje_comision: Number(e.target.value) }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Tipo de pago</label>
                  <select value={form.tipo_pago} onChange={e => setForm(p => ({ ...p, tipo_pago: e.target.value as any }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors">
                    <option value="TRANSFER">Transferencia</option>
                    <option value="CREDITO_COMIDA">Crédito comida</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm font-semibold text-gray-700">Activo</label>
                <input type="checkbox" checked={form.activo ?? true}
                  onChange={e => setForm(p => ({ ...p, activo: e.target.checked }))} className="w-4 h-4" />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button onClick={save} disabled={saving}
                className="w-full py-3.5 rounded-xl text-white font-bold bg-gray-900 disabled:opacity-50">
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear código'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
