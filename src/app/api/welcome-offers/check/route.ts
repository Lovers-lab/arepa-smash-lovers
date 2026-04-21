// src/app/api/welcome-offers/check/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ hasOffer: false })

  const supabase = createAdminClient()

  // Check if user has any previous orders (2x1 is only for first purchase)
  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('estado', 'eq', 'CANCELADO')

  if ((count || 0) > 0) return NextResponse.json({ hasOffer: false, reason: 'not_first_order' })

  // Check for active welcome offer
  const { data: offer } = await supabase
    .from('welcome_offers')
    .select('id, codigo, fecha_expiracion')
    .eq('user_id', userId)
    .eq('usado', false)
    .gte('fecha_expiracion', new Date().toISOString())
    .single()

  return NextResponse.json({ hasOffer: !!offer, offer })
}
