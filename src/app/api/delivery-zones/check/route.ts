// src/app/api/delivery-zones/check/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get('lat'))
  const lng = Number(request.nextUrl.searchParams.get('lng'))

  if (!lat || !lng) return NextResponse.json({ dentro: false })

  const supabase = createAdminClient()
  const { data: zones } = await supabase
    .from('delivery_zones')
    .select('nombre, coordenadas')
    .eq('activo', true)

  if (!zones?.length) return NextResponse.json({ dentro: true }) // No zones = accept all

  for (const zone of zones) {
    const coords = zone.coordenadas as any
    if (
      lat >= coords.minLat && lat <= coords.maxLat &&
      lng >= coords.minLng && lng <= coords.maxLng
    ) {
      return NextResponse.json({ dentro: true, zona: zone.nombre })
    }
  }

  return NextResponse.json({ dentro: false })
}
