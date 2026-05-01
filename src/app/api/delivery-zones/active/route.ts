export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('delivery_zones')
    .select('precio_envio, envio_gratis_umbral')
    .eq('activo', true)
    .single()

  return NextResponse.json(data || { precio_envio: 99, envio_gratis_umbral: 500 })
}
