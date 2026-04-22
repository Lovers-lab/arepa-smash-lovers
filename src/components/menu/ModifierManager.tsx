'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ModifierGroup, ModifierOption } from '@/types/modifiers'

interface ModifierManagerProps {
  productId: string
  productName: string
  brandColor: string
  onClose: () => void
}

const supabase = createClient()

export default function ModifierManager({ productId, productName, brandColor, onClose }: ModifierManagerProps) {
  const [groups, setGroups] = useState<ModifierGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null)
  const [showOptionForm, setShowOptionForm] = useState<string | null>(null) // groupId
  const [editingOption, setEditingOption] = useState<ModifierOption | null>(null)

  const [groupForm, setGroupForm] = useState({ nombre: '', requerido: true, min_opciones: 1, max_opciones: 1 })
  const [optionForm, setOptionForm] = useState({ nombre: '', precio_extra: 0 })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('modifier_groups')
      .select('*, options:modifier_options(*)')
      .eq('product_id', productId)
      .order('orden')
    setGroups((data as ModifierGroup[]) || [])
    setLoading(false)
  }

  async function saveGroup() {
    if (!groupForm.nombre.trim()) return
    setSaving(true)
    const payload = {
      product_id: productId,
      nombre: groupForm.nombre.trim(),
      requerido: groupForm.requerido,
      min_opciones: groupForm.min_opciones,
      max_opciones: groupForm.max_opciones,
      orden: groups.length,
      activo: true,
    }
    if (editingGroup) {
      await supabase.from('modifier_groups').update(payload).eq('id', editingGroup.id)
    } else {
      await supabase.from('modifier_groups').insert(payload)
    }
    await load()
    setShowGroupForm(false); setEditingGroup(null)
    setGroupForm({ nombre: '', requerido: true, min_opciones: 1, max_opciones: 1 })
    setSaving(false)
  }

  async function deleteGroup(group: ModifierGroup) {
    if (!confirm(`¿Eliminar grupo "${group.nombre}" y todas sus opciones?`)) return
    await supabase.from('modifier_groups').delete().eq('id', group.id)
    await load()
  }

  async function saveOption(groupId: string) {
    if (!optionForm.nombre.trim()) return
    setSaving(true)
    const group = groups.find(g => g.id === groupId)
    const payload = {
      group_id: groupId,
      nombre: optionForm.nombre.trim(),
      precio_extra: optionForm.precio_extra,
      orden: group?.options?.length || 0,
      activo: true,
    }
    if (editingOption) {
      await supabase.from('modifier_options').update(payload).eq('id', editingOption.id)
    } else {
      await supabase.from('modifier_options').insert(payload)
    }
    await load()
    setShowOptionForm(null); setEditingOption(null)
    setOptionForm({ nombre: '', precio_extra: 0 })
    setSaving(false)
  }

  async function deleteOption(option: ModifierOption) {
    await supabase.from('modifier_options').delete().eq('id', option.id)
    await load()
  }

  async function toggleGroupActive(group: ModifierGroup) {
    await supabase.from('modifier_groups').update({ activo: !group.activo }).eq('id', group.id)
    setGroups(prev => prev.map(g => g.id === group.id ? { ...g, activo: !g.activo } : g))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 800 }}>Opciones del producto</h2>
            <p style={{ fontSize: '13px', color: '#9CA3AF' }}>{productName}</p>
          </div>
          <button onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#F3F4F6', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#6B7280' }}>✕</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* How it works hint */}
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '12px 14px', marginBottom: '16px', fontSize: '13px', color: '#1E40AF' }}>
            💡 Crea grupos de opciones para que el cliente personalice su pedido. Ej: <strong>"Elige tu arepa"</strong> con las opciones disponibles.
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', color: '#9CA3AF' }}>Cargando...</p>
          ) : (
            <>
              {groups.map(group => (
                <div key={group.id} style={{ background: '#F7F8FA', borderRadius: '16px', padding: '16px', marginBottom: '12px', border: '1px solid #E4E6EA' }}>
                  {/* Group header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, fontSize: '15px' }}>{group.nombre}</span>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: group.requerido ? '#DCFCE7' : '#F3F4F6', color: group.requerido ? '#15803D' : '#6B7280' }}>
                          {group.requerido ? 'Requerido' : 'Opcional'}
                        </span>
                        {group.max_opciones > 1 && (
                          <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Hasta {group.max_opciones} opciones</span>
                        )}
                      </div>
                      <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>{group.options?.length || 0} opciones</p>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => { setEditingGroup(group); setGroupForm({ nombre: group.nombre, requerido: group.requerido, min_opciones: group.min_opciones, max_opciones: group.max_opciones }); setShowGroupForm(true) }}
                        style={{ padding: '6px 12px', background: '#DBEAFE', color: '#1D4ED8', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>✏️</button>
                      <button onClick={() => deleteGroup(group)}
                        style={{ padding: '6px 12px', background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>🗑</button>
                    </div>
                  </div>

                  {/* Options list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                    {group.options?.filter(o => o.activo).sort((a,b) => a.orden - b.orden).map(option => (
                      <div key={option.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white', padding: '10px 14px', borderRadius: '10px', border: '1px solid #E4E6EA' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{option.nombre}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {option.precio_extra > 0
                            ? <span style={{ fontSize: '12px', fontWeight: 700, color: brandColor }}>+RD${option.precio_extra}</span>
                            : <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Incluido</span>
                          }
                          <button onClick={() => deleteOption(option)}
                            style={{ padding: '4px 8px', background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add option */}
                  {showOptionForm === group.id ? (
                    <div style={{ background: 'white', borderRadius: '12px', padding: '12px', border: '1px solid #E4E6EA' }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input placeholder="Nombre de la opción (ej: Pollo y Queso Gouda)"
                          value={optionForm.nombre}
                          onChange={e => setOptionForm(p => ({ ...p, nombre: e.target.value }))}
                          style={{ flex: 1, border: '2px solid #E4E6EA', borderRadius: '10px', padding: '8px 12px', fontSize: '13px', outline: 'none', fontFamily: 'var(--font-body)' }}
                          autoFocus
                        />
                        <input type="number" placeholder="Extra RD$" min={0}
                          value={optionForm.precio_extra || ''}
                          onChange={e => setOptionForm(p => ({ ...p, precio_extra: Number(e.target.value) || 0 }))}
                          style={{ width: '90px', border: '2px solid #E4E6EA', borderRadius: '10px', padding: '8px 12px', fontSize: '13px', outline: 'none', fontFamily: 'var(--font-body)' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => saveOption(group.id)} disabled={saving || !optionForm.nombre.trim()}
                          style={{ padding: '8px 16px', background: brandColor, color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: saving || !optionForm.nombre.trim() ? 0.5 : 1 }}>
                          {saving ? '...' : '+ Agregar'}
                        </button>
                        <button onClick={() => { setShowOptionForm(null); setOptionForm({ nombre: '', precio_extra: 0 }) }}
                          style={{ padding: '8px 14px', background: '#F3F4F6', border: 'none', borderRadius: '10px', fontSize: '13px', cursor: 'pointer' }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowOptionForm(group.id)}
                      style={{ width: '100%', padding: '8px', background: 'white', border: `2px dashed ${brandColor}40`, borderRadius: '10px', color: brandColor, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                      + Agregar opción
                    </button>
                  )}
                </div>
              ))}

              {groups.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF' }}>
                  <p style={{ fontSize: '32px', marginBottom: '8px' }}>🎛️</p>
                  <p style={{ fontWeight: 600 }}>No hay grupos de opciones</p>
                  <p style={{ fontSize: '13px', marginTop: '4px' }}>Crea uno para permitir personalización</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #F3F4F6' }}>
          <button onClick={() => { setShowGroupForm(true); setEditingGroup(null); setGroupForm({ nombre: '', requerido: true, min_opciones: 1, max_opciones: 1 }) }}
            style={{ width: '100%', padding: '14px', background: brandColor, color: 'white', border: 'none', borderRadius: '14px', fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 800, cursor: 'pointer' }}>
            + Nuevo grupo de opciones
          </button>
        </div>
      </div>

      {/* Group form modal */}
      {showGroupForm && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '24px', width: '100%', maxWidth: '380px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: '16px' }}>
              {editingGroup ? 'Editar grupo' : 'Nuevo grupo de opciones'}
            </h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: '6px' }}>Nombre del grupo *</label>
              <input placeholder="Ej: Elige tu arepa, Elige tu bebida"
                value={groupForm.nombre}
                onChange={e => setGroupForm(p => ({ ...p, nombre: e.target.value }))}
                style={{ width: '100%', border: '2px solid #E4E6EA', borderRadius: '12px', padding: '10px 14px', fontSize: '14px', outline: 'none', fontFamily: 'var(--font-body)' }}
                autoFocus
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: '6px' }}>Mín. opciones</label>
                <input type="number" min={0} value={groupForm.min_opciones}
                  onChange={e => setGroupForm(p => ({ ...p, min_opciones: Number(e.target.value) }))}
                  style={{ width: '100%', border: '2px solid #E4E6EA', borderRadius: '12px', padding: '10px 14px', fontSize: '14px', outline: 'none', fontFamily: 'var(--font-body)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: '6px' }}>Máx. opciones</label>
                <input type="number" min={1} value={groupForm.max_opciones}
                  onChange={e => setGroupForm(p => ({ ...p, max_opciones: Number(e.target.value) }))}
                  style={{ width: '100%', border: '2px solid #E4E6EA', borderRadius: '12px', padding: '10px 14px', fontSize: '14px', outline: 'none', fontFamily: 'var(--font-body)' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <input type="checkbox" checked={groupForm.requerido}
                onChange={e => setGroupForm(p => ({ ...p, requerido: e.target.checked }))}
                style={{ width: '16px', height: '16px' }}
              />
              <span style={{ fontSize: '14px', fontWeight: 600 }}>El cliente debe elegir (requerido)</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={saveGroup} disabled={saving || !groupForm.nombre.trim()}
                style={{ flex: 1, padding: '12px', background: brandColor, color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', opacity: saving || !groupForm.nombre.trim() ? 0.5 : 1 }}>
                {saving ? 'Guardando...' : editingGroup ? 'Guardar' : 'Crear grupo'}
              </button>
              <button onClick={() => { setShowGroupForm(false); setEditingGroup(null) }}
                style={{ padding: '12px 16px', background: '#F3F4F6', border: 'none', borderRadius: '12px', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
