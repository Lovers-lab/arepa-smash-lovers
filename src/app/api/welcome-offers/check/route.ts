import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')
  const marca = request.nextUrl.searchParams.get('marca') || 'AREPA'
  if (!userId) return NextResponse.json({ hasOffer: false })

  const supabase = createAdminClient()

  // Check if user already has a completed order (not cancelled)
  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('estado', ['PAGADO', 'EN_COCINA', 'LISTO', 'EN_CAMINO', 'ENTREGADO'])

  // If they have a previous completed/active order → no gift
  if ((count || 0) > 0) {
    return NextResponse.json({ hasOffer: false, reason: 'not_first_order' })
  }

  // First order — gift is active
  const giftName = marca === 'SMASH' ? 'Papas Bacon Cheese' : 'Tequeños'
  const giftDesc = marca === 'SMASH' 
    ? 'Papas Bacon Cheese gratis en tu primera compra con Smash'
    : 'Tequeños gratis en tu primera compra con Arepa Lovers'

  return NextResponse.json({ 
    hasOffer: true,
    giftName,
    giftDesc,
    marca,
  })
}
