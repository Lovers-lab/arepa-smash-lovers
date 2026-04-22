'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ModifierGroup, ModifierOption, SelectedModifier } from '@/types/modifiers'

interface ModifierModalProps {
  product: { id: string; nombre: string; precio: number; foto_url?: string }
  brandColor: string
  onConfirm: (modifiers: SelectedModifier[], totalExtras: number) => void
  onClose: () => void
}

export default function ModifierModal({ product, brandColor, onConfirm, onClose }: ModifierModalProps) {
  const supabase = createClient()
  const [groups, setGroups] = useState<ModifierGroup[]>([])
  const [selected, setSelected] = useState<Record<string, string[]>>({}) // groupId -> optionIds[]
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadModifiers()
  }, [product.id])

  async function loadModifiers() {
    const { data: groupsData } = await supabase
      .from('modifier_groups')
      .select('*, options:modifier_options(*)')
      .eq('product_id', product.id)
      .eq('activo', true)
      .order('orden')

    if (groupsData) {
      setGroups(groupsData as ModifierGroup[])
      // Initialize selection
      const init: Record<string, string[]> = {}
      groupsData.forEach(g => { init[g.id] = [] })
      setSelected(init)
    }
    setLoading(false)
  }

  function toggleOption(group: ModifierGroup, optionId: string) {
    setSelected(prev => {
      const current = prev[group.id] || []
      if (group.max_opciones === 1) {
        // Single select — radio behavior
        return { ...prev, [group.id]: [optionId] }
      } else {
        // Multi select — checkbox behavior
        if (current.includes(optionId)) {
          return { ...prev, [group.id]: current.filter(id => id !== optionId) }
        } else if (current.length < group.max_opciones) {
          return { ...prev, [group.id]: [...current, optionId] }
        }
        return prev
      }
    })
  }

  function isValid(): boolean {
    return groups.every(group => {
      if (!group.requerido) return true
      const sel = selected[group.id] || []
      return sel.length >= group.min_opciones
    })
  }

  function handleConfirm() {
    if (!isValid()) {
      setError('Por favor completa todas las opciones requeridas')
      return
    }

    const modifiers: SelectedModifier[] = []
    let totalExtras = 0

    groups.forEach(group => {
      const selIds = selected[group.id] || []
      selIds.forEach(optId => {
        const option = group.options?.find(o => o.id === optId)
        if (option) {
          modifiers.push({
            groupId: group.id,
            groupNombre: group.nombre,
            optionId: option.id,
            optionNombre: option.nombre,
            precioExtra: option.precio_extra,
          })
          totalExtras += option.precio_extra
        }
      })
    })

    onConfirm(modifiers, totalExtras)
  }

  const totalPrice = product.precio + Object.values(selected).flat().reduce((acc, optId) => {
    for (const group of groups) {
      const opt = group.options?.find(o => o.id === optId)
      if (opt) return acc + opt.precio_extra
    }
    return acc
  }, 0)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: '0',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'white',
        borderRadius: '24px 24px 0 0',
        width: '100%', maxWidth: '520px',
        maxHeight: '85vh',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        animation: 'slideUpModal 0.3s ease',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 0', borderBottom: '1px solid #F3F4F6', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 800 }}>{product.nombre}</h2>
              <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '2px' }}>Personaliza tu pedido</p>
            </div>
            <button onClick={onClose} style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: '#F3F4F6', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px', color: '#6B7280', flexShrink: 0,
            }}>✕</button>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: '#9CA3AF', padding: '20px' }}>Cargando opciones...</p>
          ) : groups.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#9CA3AF', padding: '20px' }}>Este producto no tiene opciones</p>
          ) : (
            groups.map(group => (
              <div key={group.id} style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 800 }}>{group.nombre}</h3>
                    <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
                      {group.requerido ? '• Requerido' : '• Opcional'}
                      {group.max_opciones > 1 ? ` · Elige hasta ${group.max_opciones}` : ' · Elige 1'}
                    </p>
                  </div>
                  {group.requerido && (
                    <span style={{
                      fontSize: '11px', fontWeight: 700,
                      background: (selected[group.id]?.length || 0) >= group.min_opciones ? '#DCFCE7' : '#FEF3C7',
                      color: (selected[group.id]?.length || 0) >= group.min_opciones ? '#15803D' : '#92400E',
                      padding: '3px 10px', borderRadius: '999px',
                    }}>
                      {(selected[group.id]?.length || 0) >= group.min_opciones ? '✓ Listo' : 'Pendiente'}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {group.options?.filter(o => o.activo).sort((a,b) => a.orden - b.orden).map(option => {
                    const isSelected = selected[group.id]?.includes(option.id)
                    return (
                      <div key={option.id}
                        onClick={() => toggleOption(group, option.id)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '14px 16px',
                          borderRadius: '14px',
                          border: `2px solid ${isSelected ? brandColor : '#E5E7EB'}`,
                          background: isSelected ? `${brandColor}08` : 'white',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {/* Radio/Checkbox indicator */}
                          <div style={{
                            width: '20px', height: '20px',
                            borderRadius: group.max_opciones === 1 ? '50%' : '6px',
                            border: `2px solid ${isSelected ? brandColor : '#D1D5DB'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, transition: 'all 0.15s',
                            background: isSelected ? brandColor : 'white',
                          }}>
                            {isSelected && <span style={{ color: 'white', fontSize: '11px', fontWeight: 800 }}>✓</span>}
                          </div>
                          <span style={{ fontWeight: 600, fontSize: '14px', color: '#0D0F12' }}>{option.nombre}</span>
                        </div>
                        {option.precio_extra > 0 && (
                          <span style={{ fontSize: '13px', fontWeight: 700, color: brandColor }}>
                            +RD${option.precio_extra.toLocaleString('es-DO')}
                          </span>
                        )}
                        {option.precio_extra === 0 && (
                          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Incluido</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}

          {error && <p style={{ color: '#EF4444', fontSize: '13px', textAlign: 'center', marginTop: '8px' }}>{error}</p>}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #F3F4F6', background: 'white' }}>
          <button onClick={handleConfirm} disabled={!isValid()}
            style={{
              width: '100%', padding: '16px',
              background: isValid() ? `linear-gradient(135deg, ${brandColor}, ${brandColor}CC)` : '#E5E7EB',
              color: isValid() ? 'white' : '#9CA3AF',
              border: 'none', borderRadius: '16px',
              fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 800,
              cursor: isValid() ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              boxShadow: isValid() ? `0 4px 16px ${brandColor}40` : 'none',
            }}>
            Agregar al carrito — RD${totalPrice.toLocaleString('es-DO')}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUpModal {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
