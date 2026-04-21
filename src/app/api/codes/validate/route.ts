import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Validates a referral or influencer code and returns discount info
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')?.toUpperCase()
  const userId = request.nextUrl.searchParams.get('userId')

  if (!code || !userId) return NextResponse.json({ valid: false })

  const supabase = createAdminClient()

  // Check if user already has orders (referral only works on first purchase)
  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('estado', 'eq', 'CANCELADO')

  if ((count || 0) > 0) {
    return NextResponse.json({ valid: false, reason: 'Solo válido en primera compra' })
  }

  // Check influencer code first
  const { data: influencer } = await supabase
    .from('influencer_codes')
    .select('id, codigo, porcentaje_comision, nombre_influencer')
    .eq('codigo', code)
    .eq('activo', true)
    .single()

  if (influencer) {
    return NextResponse.json({
      valid: true,
      type: 'INFLUENCER',
      code: influencer.codigo,
      discount_pct: 15, // 15% descuento primera compra
      influencer_pct: influencer.porcentaje_comision,
      label: `${influencer.nombre_influencer} — 15% OFF primera compra`,
    })
  }

  // Check referral code
  const { data: referral } = await supabase
    .from('referral_codes')
    .select('id, codigo, user_id')
    .eq('codigo', code)
    .single()

  if (referral) {
    // Make sure they're not using their own code
    if (referral.user_id === userId) {
      return NextResponse.json({ valid: false, reason: 'No puedes usar tu propio código' })
    }
    return NextResponse.json({
      valid: true,
      type: 'REFERRAL',
      code: referral.codigo,
      discount_pct: 15,
      referrer_id: referral.user_id,
      label: '15% OFF — código de referido',
    })
  }

  return NextResponse.json({ valid: false, reason: 'Código no encontrado' })
}
