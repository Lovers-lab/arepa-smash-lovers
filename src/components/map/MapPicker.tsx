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

const GMAPS_KEY = 'AIzaSyA4BFabr0k5BGhpVQQLldixCRQNHuoCZuM'
const SD_CENTER = { lat: 18.4793, lng: -69.9318 }

function pointInPolygon(point: { lat: number; lng: number }, polygon: Array<{ lat: number; lng: number }>): boolean {
  if (!polygon || polygon.length < 3) return true
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

export default function MapPicker({ onLocationSelected, brandColor, zonaPoligono, precioEnvio = 99, envioGratisUmbral = 1000, subtotal = 0 }: MapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const autocompleteRef = useRef<any>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [address, setAddress] = useState('')
  const [selectedPos, setSelectedPos] = useState<{ lat: number; lng: number } | null>(null)
  const [inZone, setInZone] = useState<boolean | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [searching, setSearching] = useState(false)

  const envioGratis = subtotal >= envioGratisUmbral
  const costoEnvio = envioGratis ? 0 : precioEnvio

  useEffect(() => {
    if ((window as any).google?.maps) { initMap(); return }
    if (document.getElementById('gmaps-script')) return

    const script = document.createElement('script')
    script.id = 'gmaps-script'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places&language=es`
    script.async = true
    script.onload = () => initMap()
    document.head.appendChild(script)

    return () => {
      if (mapInstanceRef.current) mapInstanceRef.current = null
    }
  }, [])

  function initMap() {
    if (!mapRef.current || mapInstanceRef.current) return
    const google = (window as any).google

    const map = new google.maps.Map(mapRef.current, {
      center: SD_CENTER,
      zoom: 13,
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      ]
    })

    // Draw coverage polygon
    if (zonaPoligono && zonaPoligono.length > 0) {
      new google.maps.Polygon({
        paths: zonaPoligono,
        strokeColor: brandColor,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: brandColor,
        fillOpacity: 0.12,
        map,
      })
    }

    // Click to place marker
    map.addListener('click', (e: any) => {
      placeMarker(e.latLng.lat(), e.latLng.lng())
    })

    mapInstanceRef.current = map

    // Autocomplete
    if (inputRef.current) {
      const ac = new google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'do' },
        fields: ['geometry', 'formatted_address'],
        types: ['geocode', 'establishment'],
      })
      ac.addListener('place_changed', () => {
        const place = ac.getPlace()
        if (!place.geometry?.location) return
        const lat = place.geometry.location.lat()
        const lng = place.geometry.location.lng()
        const addr = place.formatted_address || ''
        map.setCenter({ lat, lng })
        map.setZoom(17)
        placeMarker(lat, lng, addr)
      })
      autocompleteRef.current = ac
    }

    setMapLoaded(true)
  }

  function placeMarker(lat: number, lng: number, addr?: string) {
    const google = (window as any).google
    const map = mapInstanceRef.current
    if (!map) return

    if (markerRef.current) markerRef.current.setMap(null)

    markerRef.current = new google.maps.Marker({
      position: { lat, lng },
      map,
      draggable: true,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: brandColor,
        fillOpacity: 1,
        strokeColor: 'white',
        strokeWeight: 3,
      },
      animation: google.maps.Animation.DROP,
    })

    markerRef.current.addListener('dragend', (e: any) => {
      reverseGeocode(e.latLng.lat(), e.latLng.lng())
    })

    const inside = pointInPolygon({ lat, lng }, zonaPoligono || [])
    setInZone(inside)
    setSelectedPos({ lat, lng })

    if (addr) {
      setAddress(addr)
      if (inside) onLocationSelected(lat, lng, addr)
    } else {
      reverseGeocode(lat, lng)
    }
  }

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GMAPS_KEY}&language=es`
      )
      const data = await res.json()
      const addr = data.results?.[0]?.formatted_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      setAddress(addr)
      const inside = pointInPolygon({ lat, lng }, zonaPoligono || [])
      if (inside) onLocationSelected(lat, lng, addr)
    } catch {
      onLocationSelected(lat, lng, `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    }
  }

  async function searchManual() {
    if (!address.trim()) return
    setSearching(true)
    try {
      const q = encodeURIComponent(`${address}, Santo Domingo, Dominican Republic`)
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${GMAPS_KEY}&language=es`
      )
      const data = await res.json()
      if (data.results?.length > 0) {
        const loc = data.results[0].geometry.location
        const addr = data.results[0].formatted_address
        mapInstanceRef.current?.setCenter(loc)
        mapInstanceRef.current?.setZoom(17)
        placeMarker(loc.lat, loc.lng, addr)
      } else {
        alert('No encontramos esa dirección. Intenta ser más específico o toca el mapa.')
      }
    } catch {
      alert('Error buscando. Toca el mapa para seleccionar tu ubicación.')
    }
    setSearching(false)
  }

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: '6px' }}>
          📍 Escribe tu dirección
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Ej: Av. Winston Churchill 101, Piantini"
            value={address}
            onChange={e => setAddress(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchManual()}
            style={{
              flex: 1, border: '2px solid #E4E6EA', borderRadius: '12px',
              padding: '12px 14px', fontSize: '14px', outline: 'none',
              fontFamily: 'var(--font-body)',
            }}
          />
          <button onClick={searchManual} disabled={searching || !address.trim()}
            style={{
              padding: '12px 16px', background: brandColor, color: 'white',
              border: 'none', borderRadius: '12px', fontSize: '13px', fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap', opacity: searching ? 0.6 : 1,
            }}>
            {searching ? '...' : '🔍'}
          </button>
        </div>
        <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '6px' }}>
          💡 Selecciona del listado o toca el mapa para ajustar tu ubicación
        </p>
      </div>

      <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '2px solid #E4E6EA', marginBottom: '12px' }}>
        <div ref={mapRef} style={{ height: '280px', width: '100%', background: '#F0F2F5' }} />
        {!mapLoaded && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F8FA' }}>
            <p style={{ color: '#9CA3AF', fontSize: '14px' }}>Cargando Google Maps...</p>
          </div>
        )}
      </div>

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
                  {envioGratis ? '🎉 Envío GRATIS' : `Costo de envío: RD$${costoEnvio}`}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#DC2626' }}>Lo sentimos, no llegamos a tu zona</div>
                <div style={{ fontSize: '12px', color: '#B91C1C', marginTop: '2px' }}>Solo hacemos delivery en el Distrito Nacional.</div>
              </>
            )}
          </div>
        </div>
      )}

      {selectedPos && inZone && address && (
        <div style={{ background: '#F7F8FA', borderRadius: '12px', padding: '12px 14px', fontSize: '13px', color: '#374151' }}>
          <div style={{ fontWeight: 700, marginBottom: '2px' }}>📍 Tu ubicación:</div>
          <div style={{ color: '#6B7280' }}>{address}</div>
        </div>
      )}
    </div>
  )
}
