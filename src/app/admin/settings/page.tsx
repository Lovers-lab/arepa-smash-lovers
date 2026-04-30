'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Marca } from '@/types'

const supabase = createClient()
const DIAS = ['lun','mar','mie','jue','vie','sab','dom']
const DIAS_LABELS: Record<string, string> = { lun:'Lun', mar:'Mar', mie:'Mié', jue:'Jue', vie:'Vie', sab:'Sáb', dom:'Dom' }

export default function AdminSettingsPage() {
  const [marca, setMarca] = useState<Marca>('AREPA')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loyaltyConfig, setLoyaltyConfig] = useState({ pesos_por_punto: 10, valor_punto: 1 })
  const [savingLoyalty, setSavingLoyalty] = useState(false)
  const [savedLoyalty, setSavedLoyalty] = useState(false)
  const [settings, setSettings] = useState<any>(null)
  const brandColor = marca === 'AREPA' ? '#C41E3A' : '#0052CC'

  useEffect(() => { loadSettings(marca) }, [marca])

  useEffect(() => {
    fetch('/api/loyalty/config')
      .then(r => r.json())
      .then(d => setLoyaltyConfig({ pesos_por_punto: d.pesos_por_punto || 10, valor_punto: d.valor_punto || 1 }))
  }, [])

  async function saveLoyaltyConfig() {
    setSavingLoyalty(true)
    const res = await fetch('/api/loyalty/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loyaltyConfig),
    })
    if (res.ok) { setSavedLoyalty(true); setTimeout(() => setSavedLoyalty(false), 2000) }
    setSavingLoyalty(false)
  }

  async function loadSettings(m: Marca) {
    setLoading(true)
    const { data } = await supabase.from('app_settings').select('*').eq('marca', m).single()
    if (data) setSettings(data)
    setLoading(false)
  }

  function set(key: string, value: any) {
    setSettings((prev: any) => ({ ...prev, [key]: value }))
  }

  function toggleDia(dia: string) {
    const dias: string[] = settings.dias_abierto || []
    const updated = dias.includes(dia) ? dias.filter((d: string) => d !== dia) : [...dias, dia]
    set('dias_abierto', updated)
  }

  async function saveSettings() {
    setSaving(true)
    const { id, created_at, ...toSave } = settings
    await supabase.from('app_settings').update({ ...toSave, updated_at: new Date().toISOString() }).eq('id', id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading || !settings) {
    return <div className="min-h-dvh flex items-center justify-center"><p className="text-gray-400">Cargando...</p></div>
  }

  return (
    <div className="min-h-dvh bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <h1 className="font-black text-lg" style={{ fontFamily: 'Syne, serif' }}>⚙️ Configuración</h1>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              {(['AREPA', 'SMASH'] as Marca[]).map(m => (
                <button key={m} onClick={() => setMarca(m)}
                  className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
                  style={marca === m ? { background: brandColor, color: '#fff' } : { background: '#F3F4F6', color: '#6B7280' }}>
                  {m === 'AREPA' ? '🫓' : '🍔'} {m}
                </button>
              ))}
            </div>
            <button onClick={saveSettings} disabled={saving}
              className="px-5 py-2 rounded-xl text-white font-bold text-sm disabled:opacity-50 transition-all"
              style={{ background: saved ? '#10B981' : brandColor }}>
              {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar todo'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">

        {/* MÉTODOS DE PAGO */}
        <Section title="💳 Métodos de Pago">
          <div className="grid grid-cols-2 gap-4">
            <Toggle label="Tarjeta (MIO)" value={settings.metodo_tarjeta_activo} onChange={v => set('metodo_tarjeta_activo', v)} />
            <Toggle label="Transferencia bancaria" value={settings.metodo_transferencia_activo} onChange={v => set('metodo_transferencia_activo', v)} />
          </div>
          {!settings.metodo_tarjeta_activo && !settings.metodo_transferencia_activo && (
            <p className="text-red-500 text-sm font-medium">⚠️ Ambos métodos desactivados — los clientes no podrán comprar</p>
          )}
        </Section>

        {/* DATOS BANCARIOS */}
        <Section title="🏦 Datos Bancarios (Transferencia)">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { label: 'Banco', key: 'banco_nombre', placeholder: 'Banco León' },
              { label: 'Número de cuenta', key: 'banco_cuenta', placeholder: '0001234567' },
              { label: 'Titular', key: 'banco_titular', placeholder: 'Juan Nachón' },
              { label: 'RUC', key: 'banco_ruc', placeholder: '402-0123456-7' },
            ].map(f => (
              <Field key={f.key} label={f.label} placeholder={f.placeholder}
                value={settings[f.key] || ''}
                onChange={v => set(f.key, v)} />
            ))}
          </div>
          <Field label="Instrucciones adicionales" placeholder='Ej: Colocar referencia "Pedido #XXX"'
            value={settings.banco_instrucciones || ''} onChange={v => set('banco_instrucciones', v)} textarea />
        </Section>

        {/* HORARIOS */}
        <Section title="🕐 Horarios de Atención">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Apertura</label>
              <input type="time" value={settings.horario_apertura || '10:00'}
                onChange={e => set('horario_apertura', e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Cierre</label>
              <input type="time" value={settings.horario_cierre || '22:00'}
                onChange={e => set('horario_cierre', e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-2">Días abierto</label>
            <div className="flex flex-wrap gap-2">
              {DIAS.map(dia => (
                <button key={dia} onClick={() => toggleDia(dia)}
                  className="px-3 py-1.5 rounded-xl text-sm font-semibold transition-all"
                  style={(settings.dias_abierto || []).includes(dia)
                    ? { background: brandColor, color: '#fff' }
                    : { background: '#F3F4F6', color: '#9CA3AF' }}>
                  {DIAS_LABELS[dia]}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* ENVÍO */}
        <Section title="🛵 Configuración de Envío">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Costo de envío (RD$)</label>
              <input type="number" value={settings.envio_costo || 99}
                onChange={e => set('envio_costo', Number(e.target.value))}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Umbral envío gratis (RD$)</label>
              <input type="number" value={settings.envio_gratis_umbral || 1000}
                onChange={e => set('envio_gratis_umbral', Number(e.target.value))}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors" />
            </div>
          </div>
          <p className="text-xs text-gray-400">Los clientes con compras ≥ RD${settings.envio_gratis_umbral} obtienen envío gratis.</p>
        </Section>

        {/* MENSAJES WHATSAPP */}
        <Section title="💬 Mensajes de WhatsApp">
          <p className="text-xs text-gray-400 mb-3">Variables disponibles: <code className="bg-gray-100 px-1 rounded">{'{{numero}}'}</code> <code className="bg-gray-100 px-1 rounded">{'{{nombre}}'}</code> <code className="bg-gray-100 px-1 rounded">{'{{eta}}'}</code> <code className="bg-gray-100 px-1 rounded">{'{{repartidor}}'}</code> <code className="bg-gray-100 px-1 rounded">{'{{telefono}}'}</code></p>
          {[
            { key: 'msg_cocina', label: '1️⃣ Orden en cocina' },
            { key: 'msg_repartidor_camino', label: '2️⃣ Repartidor en camino' },
            { key: 'msg_en_ruta', label: '3️⃣ En ruta' },
            { key: 'msg_entregado', label: '4️⃣ Entregado' },
          ].map(f => (
            <Field key={f.key} label={f.label} value={settings[f.key] || ''}
              onChange={v => set(f.key, v)} textarea placeholder="Mensaje WhatsApp..." />
          ))}
        </Section>

        {/* IMAGEN HERO */}
        <Section title="Imagen flotante en el boton">
          <p className="text-xs text-gray-400 mb-3">Sube un PNG con fondo transparente. Aparecera flotando en la tarjeta del restaurante en el home.</p>
          <div className="flex items-center gap-4">
            {settings.hero_img_url && (
              <div className="w-24 h-20 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                <img src={settings.hero_img_url} alt="Hero" className="w-full h-full object-contain" />
              </div>
            )}
            <label className="flex-1 border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer text-sm text-gray-400 block">
              {settings.hero_img_url ? "Cambiar imagen PNG" : "Subir PNG fondo transparente"}
              <input type="file" accept="image/png,image/webp" className="hidden" onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const ext = file.name.split(".").pop();
                const path = `hero/${marca.toLowerCase()}-${Date.now()}.${ext}`;
                await supabase.storage.from("product-photos").upload(path, file, { upsert: true });
                const { data } = supabase.storage.from("product-photos").getPublicUrl(path);
                set("hero_img_url", data.publicUrl);
              }} />
            </label>
            {settings.hero_img_url && (
              <button onClick={() => set("hero_img_url", "")} className="px-3 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold">Quitar</button>
            )}
          </div>
        </Section>

        {/* SONIDO */}
        <Section title="🔔 Alertas Sonoras (Admin)">
          <Toggle label="Sonido activo" value={settings.sonido_activo} onChange={v => set('sonido_activo', v)} />
          {settings.sonido_activo && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Volumen: {settings.sonido_volumen}%</label>
                <input type="range" min={0} max={100} value={settings.sonido_volumen}
                  onChange={e => set('sonido_volumen', Number(e.target.value))}
                  className="w-full accent-current" style={{ accentColor: brandColor }} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Tipo de sonido</label>
                <select value={settings.sonido_tipo}
                  onChange={e => set('sonido_tipo', e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors">
                  {['ALARMA_1','ALARMA_2','ALARMA_3','CAMPANA','BEEP'].map(s => (
                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <button onClick={() => {
                import('howler').then(({ Howl }) => {
                  new Howl({ src: [`/sounds/${settings.sonido_tipo.toLowerCase()}.mp3`], volume: settings.sonido_volumen / 100 }).play()
                })
              }} className="px-4 py-2 bg-gray-100 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">
                🔊 Probar sonido
              </button>
            </>
          )}
        </Section>
        {/* PUNTOS LOVERS */}
        <Section title="⭐ Puntos Lovers">
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Configura cuántos pesos gasta el cliente para ganar 1 punto, y cuánto vale cada punto en descuento.</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">RD$ por punto</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">RD$</span>
                  <input type="number" min={1} value={loyaltyConfig.pesos_por_punto}
                    onChange={e => setLoyaltyConfig(p => ({ ...p, pesos_por_punto: parseInt(e.target.value) || 10 }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors" />
                  <span className="text-sm text-gray-500">= 1 pto</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Valor del punto</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">1 pto =</span>
                  <input type="number" min={1} value={loyaltyConfig.valor_punto}
                    onChange={e => setLoyaltyConfig(p => ({ ...p, valor_punto: parseFloat(e.target.value) || 1 }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors" />
                  <span className="text-sm text-gray-500">RD$</span>
                </div>
              </div>
            </div>
            <div className="p-3 bg-purple-50 rounded-xl text-sm text-purple-700 font-medium">
              💡 Con esta configuración: por cada RD${loyaltyConfig.pesos_por_punto} gastados el cliente gana 1 punto = RD${loyaltyConfig.valor_punto} de descuento
            </div>
            <button onClick={saveLoyaltyConfig} disabled={savingLoyalty}
              className="px-5 py-2 rounded-xl text-white font-bold text-sm disabled:opacity-50 transition-all"
              style={{ background: savedLoyalty ? '#10B981' : brandColor }}>
              {savingLoyalty ? 'Guardando...' : savedLoyalty ? '✓ Guardado' : 'Guardar configuración de puntos'}
            </button>
          </div>
        </Section>

      </main>
    </div>
  )
}

// ---- Sub-components ----

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
      <h2 className="font-black text-base" style={{ fontFamily: 'Syne, serif' }}>{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, key: _key, value, onChange, placeholder, textarea }: {
  label: string; key?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; textarea?: boolean
}) {
  const cls = "w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors"
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-600">{label}</label>
      {textarea
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} className={`${cls} resize-none`} />
        : <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      }
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-green-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
      </label>
    </div>
  )
}
