'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

interface Zone {
  id: string
  nombre: string
  precio_envio: number
  envio_gratis_umbral: number
  poligono: Array<{ lat: number; lng: number }>
  activo: boolean
}

export default function AdminDeliveryZonesPage() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const polygonRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [zone, setZone] = useState<Zone | null>(null)
  const [loading, setLoading] = useState(true)
  const [drawing, setDrawing] = useState(false)
  const [points, setPoints] = useState<Array<{ lat: number; lng: number }>>([])
  const [precio, setPrecio] = useState('99')
  const [umbral, setUmbral] = useState('500')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const pointsRef = useRef<Array<{ lat: number; lng: number }>>([])

  useEffect(() => { loadZone(); loadLeaflet() }, [])

  async function loadZone() {
    const { data } = await supabase.from('delivery_zones').select('*').eq('activo', true).single()
    if (data) {
      setZone(data as Zone)
      setPrecio(String(data.precio_envio))
      setUmbral(String(data.envio_gratis_umbral))
      const pts = data.poligono || []
      setPoints(pts)
      pointsRef.current = pts
    }
    setLoading(false)
  }

  function loadLeaflet() {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
      document.head.appendChild(link)
    }
    if ((window as any).L) { setTimeout(initMap, 100); return }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
    script.onload = () => { setTimeout(initMap, 100); setMapLoaded(true) }
    document.head.appendChild(script)
  }

  function initMap() {
    if (!mapRef.current || mapInstanceRef.current) return
    const L = (window as any).L
    const map = L.map(mapRef.current, { center: [18.4793, -69.9318], zoom: 13 })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map)
    mapInstanceRef.current = map
    setMapLoaded(true)
    if (pointsRef.current.length > 0) drawPolygon(pointsRef.current, map)
    map.on('click', (e: any) => {
      if (!drawingRef.current) return
      const newPoint = { lat: e.latlng.lat, lng: e.latlng.lng }
      const updated = [...pointsRef.current, newPoint]
      pointsRef.current = updated
      setPoints([...updated])
      drawPolygon(updated, map)
    })
  }

  const drawingRef = useRef(false)

  function drawPolygon(pts: Array<{ lat: number; lng: number }>, map?: any) {
    const L = (window as any).L
    const m = map || mapInstanceRef.current
    if (!m || !L || pts.length < 2) return
    if (polygonRef.current) polygonRef.current.remove()
    markersRef.current.forEach(mk => mk.remove())
    markersRef.current = []
    polygonRef.current = L.polygon(pts.map(p => [p.lat, p.lng]), { color: '#C41E3A', fillColor: '#C41E3A', fillOpacity: 0.15, weight: 2 }).addTo(m)
    pts.forEach((p, i) => {
      const mk = L.circleMarker([p.lat, p.lng], { radius: 6, color: '#C41E3A', fillColor: 'white', fillOpacity: 1, weight: 2 }).addTo(m).bindTooltip(`${i + 1}`)
      markersRef.current.push(mk)
    })
  }

  function startDrawing() {
    drawingRef.current = true
    setDrawing(true)
    pointsRef.current = []
    setPoints([])
    if (polygonRef.current) polygonRef.current.remove()
    markersRef.current.forEach(mk => mk.remove())
    markersRef.current = []
    if (mapInstanceRef.current) mapInstanceRef.current.getContainer().style.cursor = 'crosshair'
  }

  function stopDrawing() {
    drawingRef.current = false
    setDrawing(false)
    if (mapInstanceRef.current) mapInstanceRef.current.getContainer().style.cursor = ''
  }

  function undoLastPoint() {
    const updated = pointsRef.current.slice(0, -1)
    pointsRef.current = updated
    setPoints([...updated])
    drawPolygon(updated)
  }

  function clearAll() {
    pointsRef.current = []
    setPoints([])
    drawingRef.current = false
    setDrawing(false)
    if (polygonRef.current) polygonRef.current.remove()
    markersRef.current.forEach(mk => mk.remove())
    markersRef.current = []
    if (mapInstanceRef.current) mapInstanceRef.current.getContainer().style.cursor = ''
  }

  async function saveZone() {
    setSaving(true)
    const payload = { precio_envio: parseFloat(precio), envio_gratis_umbral: parseFloat(umbral), poligono: pointsRef.current }
    if (zone) {
      await supabase.from('delivery_zones').update(payload).eq('id', zone.id)
    } else {
      await supabase.from('delivery_zones').insert({ ...payload, nombre: 'Zona Principal', activo: true })
    }
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    stopDrawing()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F8FA', paddingBottom: '80px', fontFamily: 'var(--font-body)' }}>
      <div style={{ background: 'white', borderBottom: '1px solid #E4E6EA', padding: '14px 20px', position: 'sticky', top: 0, zIndex: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 800 }}>📍 Zona de Entrega</h1>
          <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>Define el área donde haces delivery y los costos de envío</p>
        </div>
      </div>

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E4E6EA', padding: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: '8px' }}>🛵 Costo de envío (RD$)</label>
            <input type="number" value={precio} onChange={e => setPrecio(e.target.value)} min={0}
              style={{ width: '100%', border: '2px solid #E4E6EA', borderRadius: '10px', padding: '10px 14px', fontSize: '20px', fontFamily: 'var(--font-display)', fontWeight: 800, outline: 'none', color: '#C41E3A' }} />
          </div>
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E4E6EA', padding: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: '8px' }}>🎉 Envío gratis desde (RD$)</label>
            <input type="number" value={umbral} onChange={e => setUmbral(e.target.value)} min={0}
              style={{ width: '100%', border: '2px solid #E4E6EA', borderRadius: '10px', padding: '10px 14px', fontSize: '20px', fontFamily: 'var(--font-display)', fontWeight: 800, outline: 'none', color: '#15803D' }} />
          </div>
        </div>

        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '14px', padding: '14px 16px', marginBottom: '16px', fontSize: '13px', color: '#1E40AF', display: 'flex', gap: '10px' }}>
          <span style={{ fontSize: '18px', flexShrink: 0 }}>💡</span>
          <div><strong>Cómo delimitar tu zona:</strong>
            <ol style={{ marginTop: '6px', paddingLeft: '16px', lineHeight: '1.8' }}>
              <li>Clic en <strong>"Dibujar zona"</strong></li>
              <li>Toca los bordes de tu área de entrega en el mapa</li>
              <li>Mínimo 3 puntos para cerrar el polígono</li>
              <li>Clic en <strong>"Listo"</strong> y luego <strong>"Guardar"</strong></li>
            </ol>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {!drawing ? (
            <button onClick={startDrawing} style={{ padding: '10px 20px', background: '#C41E3A', color: 'white', border: 'none', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
              ✏️ Dibujar zona
            </button>
          ) : (
            <>
              <button onClick={stopDrawing} style={{ padding: '10px 20px', background: '#10B981', color: 'white', border: 'none', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                ✓ Listo ({points.length} puntos)
              </button>
              <button onClick={undoLastPoint} disabled={points.length === 0} style={{ padding: '10px 16px', background: '#FEF3C7', color: '#92400E', border: 'none', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: points.length === 0 ? 0.4 : 1 }}>
                ↩ Deshacer
              </button>
            </>
          )}
          {points.length > 0 && (
            <button onClick={clearAll} style={{ padding: '10px 16px', background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
              🗑 Borrar
            </button>
          )}
        </div>

        {drawing && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px', padding: '10px 14px', marginBottom: '12px', fontSize: '13px', color: '#92400E', fontWeight: 600 }}>
            🖱️ Toca el mapa para agregar puntos al perímetro...
          </div>
        )}

        <div style={{ borderRadius: '16px', overflow: 'hidden', border: '2px solid #E4E6EA', marginBottom: '16px', position: 'relative' }}>
          <div ref={mapRef} style={{ height: '420px', width: '100%', background: '#F0F2F5' }} />
          {!mapLoaded && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F8FA' }}>
              <p style={{ color: '#9CA3AF' }}>Cargando mapa...</p>
            </div>
          )}
        </div>

        {points.length >= 3 && (
          <div style={{ background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: '14px', padding: '14px 16px', marginBottom: '16px', fontSize: '13px', color: '#15803D' }}>
            ✅ Zona definida con {points.length} puntos · Envío: <strong>RD${precio}</strong> · Gratis desde: <strong>RD${umbral}</strong>
          </div>
        )}

        <button onClick={saveZone} disabled={saving || points.length < 3}
          style={{ width: '100%', padding: '16px', background: saving || points.length < 3 ? '#E4E6EA' : saved ? '#10B981' : '#C41E3A', color: saving || points.length < 3 ? '#9CA3AF' : 'white', border: 'none', borderRadius: '16px', fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 800, cursor: saving || points.length < 3 ? 'not-allowed' : 'pointer', transition: 'all 0.3s' }}>
          {saving ? 'Guardando...' : saved ? '✓ ¡Guardado!' : points.length < 3 ? 'Dibuja al menos 3 puntos en el mapa' : 'Guardar zona de entrega'}
        </button>
      </div>
    </div>
  )
}
