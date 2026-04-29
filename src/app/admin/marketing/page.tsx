'use client'

import { useEffect, useState } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Marca } from '@/types'

const supabase = createAdminClient()

const PRESETS = {
  DEFAULT_AREPA:     { color_primario: '#C41E3A', color_secundario: '#E63946', color_botones: '#C41E3A', color_links: '#C41E3A', color_bordes: '#E63946', color_texto: '#FFFFFF', color_fondo: '#FFFFFF' },
  DEFAULT_SMASH:     { color_primario: '#0052CC', color_secundario: '#0066FF', color_botones: '#0052CC', color_links: '#0052CC', color_bordes: '#0066FF', color_texto: '#FFFFFF', color_fondo: '#FFFFFF' },
  NAVIDAD:           { color_primario: '#165B33', color_secundario: '#AA1212', color_botones: '#165B33', color_links: '#AA1212', color_bordes: '#F8A145', color_texto: '#FFFFFF', color_fondo: '#FFFFFF' },
  ANO_NUEVO:         { color_primario: '#B8860B', color_secundario: '#C0C0C0', color_botones: '#B8860B', color_links: '#B8860B', color_bordes: '#C0C0C0', color_texto: '#1A1A1A', color_fondo: '#FAFAFA' },
  SAN_VALENTIN:      { color_primario: '#C41E3A', color_secundario: '#FF69B4', color_botones: '#C41E3A', color_links: '#FF69B4', color_bordes: '#FF69B4', color_texto: '#FFFFFF', color_fondo: '#FFF0F3' },
  HALLOWEEN:         { color_primario: '#FF6B00', color_secundario: '#1A1A1A', color_botones: '#FF6B00', color_links: '#FF6B00', color_bordes: '#FF6B00', color_texto: '#FFFFFF', color_fondo: '#1A1A1A' },
  INDEPENDENCIA_RD:  { color_primario: '#003087', color_secundario: '#CE1126', color_botones: '#003087', color_links: '#CE1126', color_bordes: '#FFFFFF', color_texto: '#FFFFFF', color_fondo: '#FFFFFF' },
}

const PRESET_LABELS: Record<string, string> = {
  DEFAULT: '🎨 Por defecto', NAVIDAD: '🎄 Navidad', ANO_NUEVO: '🥂 Año Nuevo',
  SAN_VALENTIN: '💕 San Valentín', HALLOWEEN: '🎃 Halloween', INDEPENDENCIA_RD: '🇩🇴 Independencia RD', CUSTOM: '✏️ Custom',
}

const COLOR_FIELDS = [
  { key: 'color_primario', label: 'Color primario' },
  { key: 'color_secundario', label: 'Color secundario' },
  { key: 'color_texto', label: 'Color texto' },
  { key: 'color_fondo', label: 'Color fondo' },
  { key: 'color_botones', label: 'Color botones' },
  { key: 'color_links', label: 'Color links' },
  { key: 'color_bordes', label: 'Color bordes' },
]

export default function AdminColorsPage() {
  const [marca, setMarca] = useState<Marca>('AREPA')
  const [colors, setColors] = useState<any>(null)
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { loadColors(marca) }, [marca])

  async function loadColors(m: Marca) {
    const { data } = await supabase.from('brand_colors').select('*').eq('marca', m).single()
    if (data) setColors(data)
  }

  function applyPreset(presetKey: string) {
    const key = presetKey === 'DEFAULT' ? (marca === 'AREPA' ? 'DEFAULT_AREPA' : 'DEFAULT_SMASH') : presetKey
    const preset = (PRESETS as any)[key]
    if (!preset) return
    setColors((prev: any) => ({ ...prev, ...preset, tema_activo: presetKey }))
  }

  function setColor(key: string, value: string) {
    setColors((prev: any) => ({ ...prev, [key]: value, tema_activo: 'CUSTOM' }))
  }

  async function saveColors() {
    setSaving(true)
    const { id, created_at, ...toSave } = colors
    // Save current to historial
    const snapshot = { fecha: new Date().toISOString(), admin: 'Admin', colores: toSave }
    const historial = [...(colors.historial || []).slice(-9), snapshot] // keep last 10

    await supabase.from('brand_colors').update({
      ...toSave,
      historial,
      fecha_cambio: new Date().toISOString(),
    }).eq('id', id)

    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function restoreDefault() {
    applyPreset('DEFAULT')
  }

  if (!colors) return <div className="min-h-dvh flex items-center justify-center"><p className="text-gray-400">Cargando...</p></div>

  const brandColor = marca === 'AREPA' ? '#C41E3A' : '#0052CC'

  return (
    <div className="min-h-dvh bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <h1 className="font-black text-lg" style={{ fontFamily: 'Syne, serif' }}>🎨 Colores de Marca</h1>
          <div className="flex items-center gap-2 flex-wrap">
            {(['AREPA', 'SMASH'] as Marca[]).map(m => (
              <button key={m} onClick={() => setMarca(m)}
                className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
                style={marca === m ? { background: brandColor, color: '#fff' } : { background: '#F3F4F6', color: '#6B7280' }}>
                {m === 'AREPA' ? '🫓' : '🍔'} {m}
              </button>
            ))}
            <button onClick={() => setPreview(p => !p)}
              className="px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all"
              style={{ borderColor: brandColor, color: brandColor }}>
              {preview ? '✕ Cerrar preview' : '👁 Vista previa'}
            </button>
            <button onClick={restoreDefault} className="px-4 py-2 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
              ↩ Restaurar
            </button>
            <button onClick={saveColors} disabled={saving}
              className="px-5 py-2 rounded-xl text-white font-bold text-sm disabled:opacity-50"
              style={{ background: saved ? '#10B981' : brandColor }}>
              {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar EN VIVO'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* LEFT: Color picker */}
        <div className="space-y-4">
          {/* Presets */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h2 className="font-black text-sm mb-3" style={{ fontFamily: 'Syne, serif' }}>Temas predefinidos</h2>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(PRESET_LABELS).map(key => (
                <button key={key} onClick={() => applyPreset(key)}
                  className="py-2.5 px-3 rounded-xl text-sm font-semibold border-2 text-left transition-all hover:shadow-sm"
                  style={colors.tema_activo === key
                    ? { borderColor: brandColor, color: brandColor, background: `${brandColor}10` }
                    : { borderColor: '#E5E7EB', color: '#374151' }}>
                  {PRESET_LABELS[key]}
                </button>
              ))}
            </div>
          </div>

          {/* Color pickers */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <h2 className="font-black text-sm" style={{ fontFamily: 'Syne, serif' }}>Colores individuales</h2>
            {COLOR_FIELDS.map(field => (
              <div key={field.key} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg border-2 border-gray-200 overflow-hidden shrink-0">
                    <input type="color" value={colors[field.key] || '#000000'}
                      onChange={e => setColor(field.key, e.target.value)}
                      className="w-12 h-12 -translate-x-1 -translate-y-1 cursor-pointer border-0 outline-none" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{field.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="text" value={colors[field.key] || ''}
                    onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setColor(field.key, e.target.value) }}
                    className="w-24 border-2 border-gray-200 rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-gray-900 transition-colors" />
                </div>
              </div>
            ))}
          </div>

          {/* History */}
          {colors.historial?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
              <h2 className="font-black text-sm" style={{ fontFamily: 'Syne, serif' }}>Historial de cambios</h2>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {[...colors.historial].reverse().map((snap: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs text-gray-500">
                    <span>{new Date(snap.fecha).toLocaleDateString('es-DO')} {new Date(snap.fecha).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}</span>
                    <div className="flex gap-1">
                      {['color_primario', 'color_secundario', 'color_botones'].map(k => (
                        <div key={k} className="w-5 h-5 rounded-full border border-gray-200" style={{ background: snap.colores?.[k] }} />
                      ))}
                    </div>
                    <button onClick={() => setColors((prev: any) => ({ ...prev, ...snap.colores }))}
                      className="text-blue-500 hover:text-blue-700 font-semibold">Restaurar</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Live preview */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h2 className="font-black text-sm mb-3" style={{ fontFamily: 'Syne, serif' }}>Vista previa del cliente</h2>
            {/* Mini preview of the app with current colors */}
            <div className="rounded-xl overflow-hidden border border-gray-200" style={{ background: colors.color_fondo }}>
              {/* Header preview */}
              <div className="px-4 py-3 flex items-center justify-between" style={{ background: colors.color_primario }}>
                <span className="font-bold text-sm" style={{ color: colors.color_texto, fontFamily: 'Syne, serif' }}>
                  {marca === 'AREPA' ? '🫓 Arepa Lovers' : '🍔 Smash Lovers'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: `${colors.color_texto}20`, color: colors.color_texto }}>
                  💰 RD$250
                </span>
              </div>
              {/* Category tabs */}
              <div className="px-4 py-2 flex gap-2 overflow-x-auto border-b border-gray-100">
                {['COMBOS', 'AREPAS', 'BEBIDAS'].map((cat, i) => (
                  <span key={cat} className="text-xs font-semibold px-3 py-1.5 rounded-full shrink-0"
                    style={i === 0
                      ? { background: colors.color_primario, color: colors.color_texto }
                      : { background: '#F3F4F6', color: '#6B7280' }}>
                    {cat}
                  </span>
                ))}
              </div>
              {/* Product card preview */}
              <div className="p-3">
                <div className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="font-bold text-sm text-gray-900">Arepa Pollo y Queso</p>
                    <p className="font-black text-sm mt-0.5" style={{ color: colors.color_primario }}>RD$295</p>
                  </div>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg"
                    style={{ background: colors.color_botones, color: colors.color_texto }}>+</div>
                </div>
              </div>
              {/* Cart button preview */}
              <div className="p-3">
                <div className="rounded-xl py-3 px-4 flex items-center justify-between"
                  style={{ background: colors.color_botones }}>
                  <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: `${colors.color_texto}20`, color: colors.color_texto }}>2</span>
                  <span className="font-bold text-sm" style={{ color: colors.color_texto }}>Ver carrito</span>
                  <span className="font-black text-sm" style={{ color: colors.color_texto }}>RD$590</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
