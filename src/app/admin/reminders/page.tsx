'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Reminder, PendingInvoice } from '@/types'

const supabase = createClient()
function formatRD(n: number) { return `RD$${n.toLocaleString('es-DO')}` }

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)
  return Math.ceil(diff / 86400000)
}

function urgencyColor(days: number) {
  if (days < 0) return { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', badge: 'bg-red-500', label: 'VENCIDA' }
  if (days === 0) return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', badge: 'bg-red-400', label: 'VENCE HOY' }
  if (days <= 3) return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-400', label: `${days}d` }
  return { bg: 'bg-white', border: 'border-gray-100', text: 'text-gray-600', badge: 'bg-gray-300', label: `${days}d` }
}

export default function AdminRemindersPage() {
  const [tab, setTab] = useState<'facturas' | 'recordatorios'>('facturas')
  const [invoices, setInvoices] = useState<PendingInvoice[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [showReminderForm, setShowReminderForm] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<PendingInvoice | null>(null)
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)

  const [invoiceForm, setInvoiceForm] = useState<Partial<PendingInvoice>>({
    nombre: '', monto: 0, proveedor: '', marca: 'AMBAS',
    fecha_vencimiento: '', prioridad: 'NORMAL', descripcion: '', pagada: false
  })
  const [reminderForm, setReminderForm] = useState<Partial<Reminder>>({
    nombre: '', monto: 0, frecuencia: 'MENSUAL', dia_del_mes: 1, marca: 'AMBAS', activo: true, dias_anticipacion: 3
  })

  const [saving, setSaving] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: inv }, { data: rem }] = await Promise.all([
      supabase.from('pending_invoices').select('*').eq('deleted', false).order('fecha_vencimiento'),
      supabase.from('reminders').select('*').order('dia_del_mes'),
    ])
    setInvoices(inv as PendingInvoice[] || [])
    setReminders(rem as Reminder[] || [])
    setLoading(false)
  }

  async function saveInvoice() {
    setSaving(true)
    if (editingInvoice) {
      await supabase.from('pending_invoices').update(invoiceForm).eq('id', editingInvoice.id)
    } else {
      await supabase.from('pending_invoices').insert({ ...invoiceForm, deleted: false })
    }
    await loadAll()
    setShowInvoiceForm(false); setEditingInvoice(null)
    setInvoiceForm({ nombre: '', monto: 0, proveedor: '', marca: 'AMBAS', fecha_vencimiento: '', prioridad: 'NORMAL', descripcion: '', pagada: false })
    setSaving(false)
  }

  async function markInvoicePaid(invoice: PendingInvoice) {
    await supabase.from('pending_invoices').update({ pagada: true, fecha_pago: new Date().toISOString().split('T')[0] }).eq('id', invoice.id)
    await loadAll()
  }

  async function deleteInvoice(invoice: PendingInvoice) {
    if (!confirm(`¿Archivar factura "${invoice.nombre}"?`)) return
    await supabase.from('pending_invoices').update({ deleted: true }).eq('id', invoice.id)
    await loadAll()
  }

  async function saveReminder() {
    setSaving(true)
    if (editingReminder) {
      await supabase.from('reminders').update(reminderForm).eq('id', editingReminder.id)
    } else {
      await supabase.from('reminders').insert(reminderForm)
    }
    await loadAll()
    setShowReminderForm(false); setEditingReminder(null)
    setReminderForm({ nombre: '', monto: 0, frecuencia: 'MENSUAL', dia_del_mes: 1, marca: 'AMBAS', activo: true, dias_anticipacion: 3 })
    setSaving(false)
  }

  const pendingInvoices = invoices.filter(i => !i.pagada)
  const paidInvoices = invoices.filter(i => i.pagada)
  const totalPending = pendingInvoices.reduce((a, i) => a + i.monto, 0)
  const totalReminders = reminders.filter(r => r.activo).reduce((a, r) => a + r.monto, 0)

  function setIF(key: string, value: any) { setInvoiceForm(p => ({ ...p, [key]: value })) }
  function setRF(key: string, value: any) { setReminderForm(p => ({ ...p, [key]: value })) }

  return (
    <div className="min-h-dvh bg-gray-50 pb-10">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <h1 className="font-black text-lg" style={{ fontFamily: 'Syne, serif' }}>📅 Recordatorios & Facturas</h1>
          <button onClick={() => tab === 'facturas' ? setShowInvoiceForm(true) : setShowReminderForm(true)}
            className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold">
            + {tab === 'facturas' ? 'Nueva factura' : 'Nuevo recordatorio'}
          </button>
        </div>
        <div className="max-w-4xl mx-auto px-4 flex gap-1 pb-0">
          {(['facturas', 'recordatorios'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-2.5 text-sm font-semibold capitalize border-b-2 transition-colors"
              style={tab === t ? { borderColor: '#1A1A1A', color: '#1A1A1A' } : { borderColor: 'transparent', color: '#6B7280' }}>
              {t === 'facturas' ? `Facturas pendientes (${pendingInvoices.length})` : `Recordatorios fijos (${reminders.filter(r=>r.activo).length})`}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <p className="text-xs text-gray-400">Total facturas pendientes</p>
            <p className="font-black text-xl text-red-600">{formatRD(totalPending)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <p className="text-xs text-gray-400">Pagos fijos/mes</p>
            <p className="font-black text-xl text-amber-600">{formatRD(totalReminders)}</p>
          </div>
        </div>

        {/* FACTURAS TAB */}
        {tab === 'facturas' && (
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-gray-600">PENDIENTES</h3>
            {pendingInvoices.map(inv => {
              const days = daysUntil(inv.fecha_vencimiento)
              const style = urgencyColor(days)
              return (
                <div key={inv.id} className={`rounded-2xl border-2 p-4 ${style.bg} ${style.border}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900">{inv.nombre}</p>
                        {inv.prioridad === 'URGENTE' && <span className="text-xs font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">URGENTE</span>}
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: style.badge === 'bg-red-500' ? '#EF4444' : style.badge === 'bg-amber-400' ? '#F59E0B' : '#9CA3AF' }}>
                          {style.label}
                        </span>
                      </div>
                      {inv.proveedor && <p className="text-xs text-gray-500 mt-0.5">{inv.proveedor}</p>}
                      <p className="text-xs text-gray-400">Vence: {new Date(inv.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-DO', { day: 'numeric', month: 'long' })} · {inv.marca}</p>
                    </div>
                    <p className="font-black text-xl" style={{ color: days < 0 ? '#EF4444' : '#1A1A1A' }}>{formatRD(inv.monto)}</p>
                  </div>
                  {inv.descripcion && <p className="text-xs text-gray-400 mt-2">{inv.descripcion}</p>}
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => markInvoicePaid(inv)} className="px-4 py-2 bg-green-500 text-white text-xs font-bold rounded-xl hover:bg-green-600 transition-colors">✅ Marcar pagada</button>
                    <button onClick={() => { setEditingInvoice(inv); setInvoiceForm({...inv}); setShowInvoiceForm(true) }}
                      className="px-4 py-2 bg-blue-50 text-blue-600 text-xs font-bold rounded-xl hover:bg-blue-100 transition-colors">✏️ Editar</button>
                    <button onClick={() => deleteInvoice(inv)} className="px-4 py-2 bg-gray-100 text-gray-500 text-xs font-bold rounded-xl hover:bg-gray-200 transition-colors">Archivar</button>
                  </div>
                </div>
              )
            })}
            {pendingInvoices.length === 0 && <p className="text-center py-8 text-gray-400">✅ No hay facturas pendientes</p>}

            {paidInvoices.length > 0 && (
              <>
                <h3 className="font-bold text-sm text-gray-400 mt-4">PAGADAS</h3>
                {paidInvoices.slice(0, 5).map(inv => (
                  <div key={inv.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between opacity-60">
                    <div>
                      <p className="font-medium text-sm text-gray-700 line-through">{inv.nombre}</p>
                      <p className="text-xs text-gray-400">Pagada {inv.fecha_pago ? new Date(inv.fecha_pago+'T12:00:00').toLocaleDateString('es-DO') : ''}</p>
                    </div>
                    <p className="font-bold text-green-600">{formatRD(inv.monto)}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* RECORDATORIOS TAB */}
        {tab === 'recordatorios' && (
          <div className="space-y-3">
            {reminders.map(rem => (
              <div key={rem.id} className={`bg-white rounded-2xl border border-gray-100 p-4 ${!rem.activo ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-gray-900">{rem.nombre}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Día {rem.dia_del_mes} de cada mes · {rem.frecuencia} · {rem.marca}
                    </p>
                    <p className="text-xs text-gray-400">Avisa {rem.dias_anticipacion} días antes</p>
                  </div>
                  <p className="font-black text-lg">{formatRD(rem.monto)}</p>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => { setEditingReminder(rem); setReminderForm({...rem}); setShowReminderForm(true) }}
                    className="px-4 py-2 bg-blue-50 text-blue-600 text-xs font-bold rounded-xl hover:bg-blue-100 transition-colors">✏️ Editar</button>
                  <button onClick={async () => {
                    await supabase.from('reminders').update({ activo: !rem.activo }).eq('id', rem.id)
                    loadAll()
                  }} className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-xl hover:bg-gray-200 transition-colors">
                    {rem.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            ))}
            {reminders.length === 0 && <p className="text-center py-8 text-gray-400">No hay recordatorios creados</p>}
          </div>
        )}
      </main>

      {/* INVOICE MODAL */}
      {showInvoiceForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-black" style={{ fontFamily: 'Syne, serif' }}>{editingInvoice ? 'Editar factura' : 'Nueva factura'}</h2>
              <button onClick={() => { setShowInvoiceForm(false); setEditingInvoice(null) }} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-4 space-y-3">
              {[
                { label: 'Nombre *', key: 'nombre', placeholder: 'Factura agua marzo' },
                { label: 'Proveedor', key: 'proveedor', placeholder: 'CODETEL' },
                { label: 'Descripción', key: 'descripcion', placeholder: 'Notas opcionales...' },
              ].map(f => (
                <div key={f.key} className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">{f.label}</label>
                  <input placeholder={f.placeholder} value={(invoiceForm as any)[f.key] || ''}
                    onChange={e => setIF(f.key, e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Monto (RD$) *</label>
                  <input type="number" value={invoiceForm.monto || ''} onChange={e => setIF('monto', Number(e.target.value))}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Vencimiento *</label>
                  <input type="date" value={invoiceForm.fecha_vencimiento || ''} onChange={e => setIF('fecha_vencimiento', e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Marca</label>
                  <select value={invoiceForm.marca} onChange={e => setIF('marca', e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors">
                    <option value="AMBAS">Ambas</option>
                    <option value="AREPA">🫓 Arepa</option>
                    <option value="SMASH">🍔 Smash</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Prioridad</label>
                  <select value={invoiceForm.prioridad} onChange={e => setIF('prioridad', e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors">
                    <option value="NORMAL">Normal</option>
                    <option value="URGENTE">🔴 Urgente</option>
                  </select>
                </div>
              </div>
              <button onClick={saveInvoice} disabled={saving}
                className="w-full py-3.5 rounded-xl text-white font-bold bg-gray-900 disabled:opacity-50">
                {saving ? 'Guardando...' : editingInvoice ? 'Guardar' : 'Crear factura'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REMINDER MODAL */}
      {showReminderForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-black" style={{ fontFamily: 'Syne, serif' }}>{editingReminder ? 'Editar recordatorio' : 'Nuevo recordatorio'}</h2>
              <button onClick={() => { setShowReminderForm(false); setEditingReminder(null) }} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Nombre *</label>
                <input placeholder="Pago de luz" value={reminderForm.nombre || ''} onChange={e => setRF('nombre', e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Monto (RD$) *</label>
                  <input type="number" value={reminderForm.monto || ''} onChange={e => setRF('monto', Number(e.target.value))}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Día del mes</label>
                  <input type="number" min={1} max={31} value={reminderForm.dia_del_mes || 1} onChange={e => setRF('dia_del_mes', Number(e.target.value))}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Frecuencia</label>
                  <select value={reminderForm.frecuencia} onChange={e => setRF('frecuencia', e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors">
                    {['MENSUAL','BIMESTRAL','TRIMESTRAL','ANUAL'].map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Marca</label>
                  <select value={reminderForm.marca} onChange={e => setRF('marca', e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors">
                    <option value="AMBAS">Ambas</option>
                    <option value="AREPA">🫓 Arepa</option>
                    <option value="SMASH">🍔 Smash</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Avisar X días antes</label>
                <input type="number" min={0} max={30} value={reminderForm.dias_anticipacion || 3} onChange={e => setRF('dias_anticipacion', Number(e.target.value))}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors" />
              </div>
              <button onClick={saveReminder} disabled={saving}
                className="w-full py-3.5 rounded-xl text-white font-bold bg-gray-900 disabled:opacity-50">
                {saving ? 'Guardando...' : editingReminder ? 'Guardar' : 'Crear recordatorio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
