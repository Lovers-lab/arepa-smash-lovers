'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
const GMAPS_KEY = 'AIzaSyA4BFabr0k5BGhpVQQLldixCRQNHuoCZuM'

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
  const drawingManagerRef = useRef<any>(null)
  const [zone, setZone] = useState<Zone | null>(null)
  const [loading, setLoading] = useState(true)
  const [drawing, setDrawing] = useState(false)
  const [points, setPoints] = useState<Array<{ lat: number; lng: number }>>([])
  const [precio, setPrecio] = useState('99')
  const [umbral, setUmbral] = useState('1000')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const pointsRef = useRef<Array<{ lat: number; lng: number }>>([])

  useEffect(() => {
    loadZone()
    if ((window as any).google?.maps) { initMap(); return }
    if (document.getElementById('gmaps-script')) { 
      const wait = setInterval(() => {
        if ((window as any).google?.maps) { clearInterval(wait); initMap() }
      }, 100)
      return
    }
    const script = document.createElement('script')
    script.id = 'gmaps-script'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=drawing,places&language=es`
    script.async = true
    script.onload = () => initMap()
    document.head.appendChild(script)
  }, [])

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

  function initMap() {
    if (!mapRef.current || mapInstanceRef.current) return
    const google = (window as any).google

    const map = new google.maps.Map(mapRef.current, {
      center: { lat: 18.4793, lng: -69.9318 },
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }]
    })

    mapInstanceRef.current = map
    setMapLoaded(true)

    // Show existing polygon
    if (pointsRef.current.length > 0) {
      drawPolygonOnMap(pointsRef.current)
    }

    // Click to add points manually
    map.addListener('click', (e: any) => {
      if (!drawingRef.current) return
      const newPoint = { lat: e.latLng.lat(), lng: e.latLng.lng() }
      const updated = [...pointsRef.current, newPoint]
      pointsRef.current = updated
      setPoints([...updated])
      drawPolygonOnMap(updated)
      addMarker(newPoint, updated.length)
    })
  }

  const drawingRef = useRef(false)

  function drawPolygonOnMap(pts: Array<{ lat: number; lng: number }>) {
    const google = (window as any).google
    const map = mapInstanceRef.current
    if (!map || !google || pts.length < 2) return

    if (polygonRef.current) polygonRef.current.setMap(null)

    polygonRef.current = new google.maps.Polygon({
      paths: pts,
      strokeColor: '#C41E3A',
      strokeOpacity: 0.9,
      strokeWeight: 2,
      fillColor: '#C41E3A',
      fillOpacity: 0.15,
      map,
    })
  }

  function addMarker(point: { lat: number; lng: number }, num: number) {
    const google = (window as any).google
    const map = mapInstanceRef.current
    if (!map) return

    const marker = new google.maps.Marker({
      position: point,
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: '#C41E3A',
        fillOpacity: 1,
        strokeColor: 'white',
        strokeWeight: 2,
      },
      label: { text: String(num), color: 'white', fontSize: '9px', fontWeight: 'bold' },
    })
    markersRef.current.push(marker)
  }

  function startDrawing() {
    drawingRef.current = true
    setDrawing(true)
    pointsRef.current = []
    setPoints([])
    if (polygonRef.current) polygonRef.current.setMap(null)
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
    if (mapInstanceRef.current) mapInstanceRef.current.getDiv().style.cursor = 'crosshair'
  }

  function stopDrawing() {
    drawingRef.current = false
    setDrawing(false)
    if (mapInstanceRef.current) mapInstanceRef.current.getDiv().style.cursor = ''
    if (pointsRef.current.length >= 3) drawPolygonOnMap(pointsRef.current)
  }

  function undoLastPoint() {
    const updated = pointsRef.current.slice(0, -1)
    pointsRef.current = updated
    setPoints([...updated])
    const lastMarker = markersRef.current.pop()
    if (lastMarker) lastMarker.setMap(null)
    if (updated.length >= 2) drawPolygonOnMap(updated)
    else if (polygonRef.current) polygonRef.current.setMap(null)
  }

  function clearAll() {
    pointsRef.current = []
    setPoints([])
    drawingRef.current = false
    setDrawing(false)
    if (polygonRef.current) polygonRef.current.setMap(null)
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
    if (mapInstanceRef.current) mapInstanceRef.current.getDiv().style.cursor = ''
  }

  async function saveZone() {
    setSaving(true)
    const payload = {
      precio_envio: parseFloat(precio),
      envio_gratis_umbral: parseFloat(umbral),
      poligono: pointsRef.current
    }
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
          <div><strong>Cómo delimitar tu zona con Google Maps:</strong>
            <ol style={{ marginTop: '6px', paddingLeft: '16px', lineHeight: '1.8' }}>
              <li>Clic en <strong>"Dibujar zona"</strong></li>
              <li>Toca los bordes del área de entrega en el mapa</li>
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
              🗑 Borrar todo
            </button>
          )}
        </div>

        {drawing && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px', padding: '10px 14px', marginBottom: '12px', fontSize: '13px', color: '#92400E', fontWeight: 600 }}>
            🖱️ Toca el mapa para agregar puntos al perímetro de entrega...
          </div>
        )}

        <div style={{ borderRadius: '16px', overflow: 'hidden', border: '2px solid #E4E6EA', marginBottom: '16px', position: 'relative' }}>
          <div ref={mapRef} style={{ height: '450px', width: '100%', background: '#F0F2F5' }} />
          {!mapLoaded && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F8FA' }}>
              <p style={{ color: '#9CA3AF' }}>Cargando Google Maps...</p>
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
