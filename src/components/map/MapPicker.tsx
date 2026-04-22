'use client'

import { useEffect, useRef, useState } from 'react'

interface MapPickerProps {
  onLocationSelected: (lat: number, lng: number, address: string) => void
  brandColor: string
  zonaPoligono?: Array<{ lat: number; lng: number }>
  precioEnvio?: number
  envioGratisUmbral?: number
  subtotal?: number
}

// Point in polygon algorithm
function pointInPolygon(point: { lat: number; lng: number }, polygon: Array<{ lat: number; lng: number }>): boolean {
  if (!polygon || polygon.length < 3) return true // No polygon = allow all
  let inside = false
  const x = point.lng, y = point.lat
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat
    const xj = polygon[j].lng, yj = polygon[j].lat
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

export default function MapPicker({ onLocationSelected, brandColor, zonaPoligono, precioEnvio = 99, envioGratisUmbral = 500, subtotal = 0 }: MapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const [address, setAddress] = useState('')
  const [searching, setSearching] = useState(false)
  const [selectedPos, setSelectedPos] = useState<{ lat: number; lng: number } | null>(null)
  const [inZone, setInZone] = useState<boolean | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  const envioGratis = subtotal >= envioGratisUmbral
  const costoEnvio = envioGratis ? 0 : precioEnvio

  useEffect(() => {
    // Load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
      document.head.appendChild(link)
    }

    // Load Leaflet JS
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
    script.onload = () => initMap()
    document.head.appendChild(script)

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  function initMap() {
    if (!mapRef.current || mapInstanceRef.current) return
    const L = (window as any).L

    // Center on Distrito Nacional
    const map = L.map(mapRef.current, {
      center: [18.4793, -69.9318],
      zoom: 13,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)

    // Draw coverage polygon if provided
    if (zonaPoligono && zonaPoligono.length > 0) {
      const latlngs = zonaPoligono.map(p => [p.lat, p.lng])
      L.polygon(latlngs, {
        color: brandColor,
        fillColor: brandColor,
        fillOpacity: 0.12,
        weight: 2,
        dashArray: '6, 4',
      }).addTo(map)
    }

    // Click to place marker
    map.on('click', (e: any) => {
      placeMarker(e.latlng.lat, e.latlng.lng, map)
    })

    mapInstanceRef.current = map
    setMapLoaded(true)
  }

  function placeMarker(lat: number, lng: number, map?: any) {
    const L = (window as any).L
    const m = map || mapInstanceRef.current
    if (!m) return

    // Custom marker icon
    const icon = L.divIcon({
      html: `<div style="
        width:36px;height:36px;
        background:${brandColor};
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:3px solid white;
        box-shadow:0 4px 12px rgba(0,0,0,0.3);
      "></div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      className: '',
    })

    if (markerRef.current) markerRef.current.remove()
    markerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(m)

    markerRef.current.on('dragend', (e: any) => {
      const pos = e.target.getLatLng()
      checkZoneAndUpdate(pos.lat, pos.lng)
    })

    checkZoneAndUpdate(lat, lng)
  }

  function checkZoneAndUpdate(lat: number, lng: number) {
    const inside = pointInPolygon({ lat, lng }, zonaPoligono || [])
    setInZone(inside)
    setSelectedPos({ lat, lng })

    if (inside) {
      // Reverse geocode with Nominatim
      reverseGeocode(lat, lng)
    }
  }

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`)
      const data = await res.json()
      const addr = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      const shortAddr = addr.split(',').slice(0, 3).join(',').trim()
      setAddress(shortAddr)
      onLocationSelected(lat, lng, shortAddr)
    } catch {
      onLocationSelected(lat, lng, `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    }
  }

  async function searchAddress() {
    if (!address.trim()) return
    setSearching(true)
    try {
      const query = encodeURIComponent(`${address}, Santo Domingo, República Dominicana`)
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&accept-language=es`)
      const data = await res.json()
      if (data.length > 0) {
        const { lat, lon } = data[0]
        const latNum = parseFloat(lat)
        const lngNum = parseFloat(lon)
        mapInstanceRef.current?.setView([latNum, lngNum], 16)
        placeMarker(latNum, lngNum)
      } else {
        alert('No encontramos esa dirección. Intenta ser más específico o toca el mapa.')
      }
    } catch {
      alert('Error buscando dirección. Toca el mapa para colocar tu ubicación.')
    }
    setSearching(false)
  }

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      {/* Address search */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: '6px' }}>
          Escribe tu dirección
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Ej: Calle El Conde 101, Zona Colonial"
            value={address}
            onChange={e => setAddress(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchAddress()}
            style={{
              flex: 1, border: '2px solid #E4E6EA', borderRadius: '12px',
              padding: '12px 14px', fontSize: '14px', outline: 'none',
              fontFamily: 'var(--font-body)',
            }}
          />
          <button onClick={searchAddress} disabled={searching || !address.trim()}
            style={{
              padding: '12px 16px', background: brandColor, color: 'white',
              border: 'none', borderRadius: '12px', fontSize: '13px', fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap', opacity: searching ? 0.6 : 1,
            }}>
            {searching ? '...' : '🔍 Buscar'}
          </button>
        </div>
        <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '6px' }}>
          💡 Busca tu dirección o toca directamente en el mapa para colocar tu ubicación
        </p>
      </div>

      {/* Map */}
      <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '2px solid #E4E6EA', marginBottom: '12px' }}>
        <div ref={mapRef} style={{ height: '280px', width: '100%', background: '#F0F2F5' }} />
        {!mapLoaded && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F8FA' }}>
            <p style={{ color: '#9CA3AF', fontSize: '14px' }}>Cargando mapa...</p>
          </div>
        )}
      </div>

      {/* Zone status */}
      {selectedPos && (
        <div style={{
          padding: '12px 16px', borderRadius: '12px', marginBottom: '8px',
          background: inZone ? '#DCFCE7' : '#FEE2E2',
          border: `1px solid ${inZone ? '#86EFAC' : '#FECACA'}`,
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ fontSize: '20px' }}>{inZone ? '✅' : '❌'}</span>
          <div>
            {inZone ? (
              <>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#15803D' }}>¡Llegamos a tu zona!</div>
                <div style={{ fontSize: '12px', color: '#166534', marginTop: '2px' }}>
                  {envioGratis
                    ? '🎉 Envío GRATIS en tu pedido'
                    : `Costo de envío: RD$${costoEnvio}`
                  }
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#DC2626' }}>Lo sentimos, no llegamos a tu zona</div>
                <div style={{ fontSize: '12px', color: '#B91C1C', marginTop: '2px' }}>
                  Solo hacemos delivery en el Distrito Nacional. Mueve el pin a tu ubicación correcta.
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Confirm location */}
      {selectedPos && inZone && address && (
        <div style={{ background: '#F7F8FA', borderRadius: '12px', padding: '12px 14px', fontSize: '13px', color: '#374151' }}>
          <div style={{ fontWeight: 700, marginBottom: '2px' }}>📍 Tu ubicación:</div>
          <div style={{ color: '#6B7280' }}>{address}</div>
        </div>
      )}
    </div>
  )
}
