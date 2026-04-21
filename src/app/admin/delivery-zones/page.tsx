'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DeliveryZone } from '@/types'

const supabase = createClient()

// Simple bounding-box zone editor (no PostGIS required)
// For production: replace with Leaflet draw polygon

interface BBoxZone {
  minLat: number; maxLat: number; minLng: number; maxLng: number
}

const SANTO_DOMINGO_DEFAULT: BBoxZone = {
  minLat: 18.43, maxLat: 18.56, minLng: -70.02, maxLng: -69.82
}

export default function AdminDeliveryZonesPage() {
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null)
  const [form, setForm] = useState({ nombre: '', bbox: SANTO_DOMINGO_DEFAULT })
  const [saving, setSaving] = useState(false)
  const [testCoords, setTestCoords] = useState({ lat: '', lng: '' })
  const [testResult, setTestResult] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('delivery_zones').select('*').order('created_at')
    setZones(data as DeliveryZone[] || [])
    setLoading(false)
  }

  async function save() {
    if (!form.nombre.trim()) return
    setSaving(true)
    const payload = {
      nombre: form.nombre.trim(),
      coordenadas: form.bbox,
      activo: true,
    }
    if (editingZone) {
      await supabase.from('delivery_zones').update(payload).eq('id', editingZone.id)
    } else {
      await supabase.from('delivery_zones').insert(payload)
    }
    await load()
    setShowForm(false); setEditingZone(null)
    setForm({ nombre: '', bbox: SANTO_DOMINGO_DEFAULT })
    setSaving(false)
  }

  async function toggleZone(zone: DeliveryZone) {
    await supabase.from('delivery_zones').update({ activo: !zone.activo }).eq('id', zone.id)
    setZones(prev => prev.map(z => z.id === zone.id ? { ...z, activo: !z.activo } : z))
  }

  async function deleteZone(zone: DeliveryZone) {
    if (!confirm(`¿Eliminar zona "${zone.nombre}"?`)) return
    await supabase.from('delivery_zones').delete().eq('id', zone.id)
    setZones(prev => prev.filter(z => z.id !== zone.id))
  }

  async function testLocation() {
    const lat = parseFloat(testCoords.lat)
    const lng = parseFloat(testCoords.lng)
    if (isNaN(lat) || isNaN(lng)) { setTestResult('Coordenadas inválidas'); return }

    const res = await fetch(`/api/delivery-zones/check?lat=${lat}&lng=${lng}`)
    const data = await res.json()
    setTestResult(data.dentro ? `✅ Dentro de zona: ${data.zona}` : '❌ Fuera de zona de entrega')
  }

  function useMyLocation() {
    navigator.geolocation.getCurrentPosition(pos => {
      setTestCoords({ lat: String(pos.coords.latitude.toFixed(6)), lng: String(pos.coords.longitude.toFixed(6)) })
    })
  }

  function openEdit(zone: DeliveryZone) {
    setEditingZone(zone)
    setForm({ nombre: zone.nombre, bbox: zone.coordenadas as unknown as BBoxZone })
    setShowForm(true)
  }

  function setB(key: keyof BBoxZone, value: string) {
    setForm(p => ({ ...p, bbox: { ...p.bbox, [key]: parseFloat(value) || 0 } }))
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-black text-lg" style={{ fontFamily: 'Syne, serif' }}>📍 Zonas de Entrega</h1>
          <button onClick={() => { setShowForm(true); setEditingZone(null); setForm({ nombre: '', bbox: SANTO_DOMINGO_DEFAULT }) }}
            className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold">
            + Nueva zona
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">

        {/* How it works */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800">
          <p className="font-bold mb-1">ℹ️ Cómo funciona</p>
          <p>Define zonas por coordenadas (Norte/Sur/Este/Oeste). Al checkout, el GPS del cliente se verifica contra estas zonas. Si está fuera, no puede completar la compra.</p>
        </div>

        {/* Zones list */}
        {loading ? (
          <div className="text-center py-8 text-gray-400">Cargando...</div>
        ) : (
          <div className="space-y-3">
            {zones.map(zone => {
              const bbox = zone.coordenadas as unknown as BBoxZone
              return (
                <div key={zone.id} className={`bg-white rounded-2xl border border-gray-100 p-4 ${!zone.activo ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900">{zone.nombre}</p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${zone.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {zone.activo ? 'ACTIVA' : 'INACTIVA'}
                        </span>
                      </div>
                      {bbox && (
                        <div className="grid grid-cols-2 gap-x-4 mt-2 text-xs text-gray-400 font-mono">
                          <span>Norte: {bbox.maxLat}</span><span>Sur: {bbox.minLat}</span>
                          <span>Este: {bbox.maxLng}</span><span>Oeste: {bbox.minLng}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => toggleZone(zone)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${zone.activo ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                        {zone.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button onClick={() => openEdit(zone)} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold">✏️</button>
                      <button onClick={() => deleteZone(zone)} className="px-3 py-1.5 bg-red-50 text-red-500 rounded-xl text-xs font-bold">🗑</button>
                    </div>
                  </div>
                </div>
              )
            })}
            {zones.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                <p className="text-3xl mb-2">📍</p>
                <p>No hay zonas definidas. Sin zonas, se aceptan todas las direcciones.</p>
              </div>
            )}
          </div>
        )}

        {/* Test a location */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <h2 className="font-black text-sm" style={{ fontFamily: 'Syne, serif' }}>🧪 Probar una ubicación</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">Latitud</label>
              <input type="number" step="any" placeholder="18.4861" value={testCoords.lat}
                onChange={e => setTestCoords(p => ({ ...p, lat: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-gray-900 transition-colors" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">Longitud</label>
              <input type="number" step="any" placeholder="-69.9312" value={testCoords.lng}
                onChange={e => setTestCoords(p => ({ ...p, lng: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-gray-900 transition-colors" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={useMyLocation} className="px-4 py-2 bg-gray-100 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-200 transition-colors">
              📍 Usar mi ubicación
            </button>
            <button onClick={testLocation} className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold">
              Verificar
            </button>
          </div>
          {testResult && (
            <p className={`text-sm font-semibold px-4 py-3 rounded-xl ${testResult.startsWith('✅') ? 'bg-green-50 text-green-700' : testResult.startsWith('❌') ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'}`}>
              {testResult}
            </p>
          )}
        </div>
      </main>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-black" style={{ fontFamily: 'Syne, serif' }}>
                {editingZone ? 'Editar zona' : 'Nueva zona de entrega'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditingZone(null) }} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Nombre de la zona *</label>
                <input placeholder="Ej: Santo Domingo Norte" value={form.nombre}
                  onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Límites del área (coordenadas decimales)</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Norte (maxLat)', key: 'maxLat', placeholder: '18.56' },
                    { label: 'Sur (minLat)', key: 'minLat', placeholder: '18.43' },
                    { label: 'Este (maxLng)', key: 'maxLng', placeholder: '-69.82' },
                    { label: 'Oeste (minLng)', key: 'minLng', placeholder: '-70.02' },
                  ].map(f => (
                    <div key={f.key} className="space-y-1">
                      <label className="text-xs text-gray-500">{f.label}</label>
                      <input type="number" step="any" placeholder={f.placeholder}
                        value={(form.bbox as any)[f.key] || ''}
                        onChange={e => setB(f.key as keyof BBoxZone, e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-gray-900 transition-colors" />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Tip: usa Google Maps, haz clic derecho → "¿Qué hay aquí?" para obtener coordenadas.
                </p>
              </div>
              <button onClick={save} disabled={saving || !form.nombre}
                className="w-full py-3.5 rounded-xl bg-gray-900 text-white font-bold disabled:opacity-50">
                {saving ? 'Guardando...' : editingZone ? 'Guardar cambios' : 'Crear zona'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
