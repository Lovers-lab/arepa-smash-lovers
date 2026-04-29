import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')?.toUpperCase().trim()
  const userId = request.nextUrl.searchParams.get('userId')

  if (!code || !userId) return NextResponse.json({ valid: false, reason: 'Datos incompletos' })

  const supabase = createAdminClient()

  // 1. CUPONES DIRECTOS (user_coupons o coupons globales)
  // Buscar en user_coupons primero (cupones asignados a este usuario)
  const { data: userCoupon } = await supabase
    .from('user_coupons')
    .select('*, coupon:coupons(*)')
    .eq('user_id', userId)
    .eq('usado', false)
    .filter('coupon.codigo', 'eq', code)
    .maybeSingle()

  if (userCoupon?.coupon) {
    const c = userCoupon.coupon
    if (!c.activo) return NextResponse.json({ valid: false, reason: 'Cupón inactivo' })
    if (c.expira_at && new Date(c.expira_at) < new Date()) return NextResponse.json({ valid: false, reason: 'Cupón vencido' })
    return NextResponse.json({
      valid: true,
      type: 'CUPON',
      coupon_id: c.id,
      user_coupon_id: userCoupon.id,
      code: c.codigo,
      tipo: c.tipo,
      valor: Number(c.valor),
      minimo_compra: Number(c.minimo_compra || 0),
      discount_pct: c.tipo === 'porcentaje' ? Number(c.valor) : 0,
      discount_fijo: c.tipo === 'fijo' ? Number(c.valor) : 0,
      label: c.descripcion || (c.tipo === 'fijo' ? 'RD$' + c.valor + ' de descuento' : c.valor + '% de descuento'),
    })
  }

  // Buscar en coupons globales (sin asignacion de usuario)
  const { data: coupon } = await supabase
    .from('coupons')
    .select('*')
    .eq('codigo', code)
    .eq('activo', true)
    .maybeSingle()

  if (coupon) {
    if (coupon.expira_at && new Date(coupon.expira_at) < new Date()) return NextResponse.json({ valid: false, reason: 'Cupón vencido' })
    // Verificar que no lo haya usado ya
    const { data: yaUsado } = await supabase
      .from('user_coupons')
      .select('id')
      .eq('coupon_id', coupon.id)
      .eq('user_id', userId)
      .eq('usado', true)
      .maybeSingle()
    if (yaUsado) return NextResponse.json({ valid: false, reason: 'Ya usaste este cupón' })
    return NextResponse.json({
      valid: true,
      type: 'CUPON',
      coupon_id: coupon.id,
      user_coupon_id: null,
      code: coupon.codigo,
      tipo: coupon.tipo,
      valor: Number(coupon.valor),
      minimo_compra: Number(coupon.minimo_compra || 0),
      discount_pct: coupon.tipo === 'porcentaje' ? Number(coupon.valor) : 0,
      discount_fijo: coupon.tipo === 'fijo' ? Number(coupon.valor) : 0,
      label: coupon.descripcion || (coupon.tipo === 'fijo' ? 'RD$' + coupon.valor + ' de descuento' : coupon.valor + '% de descuento'),
    })
  }

  // 2. CODIGO INFLUENCER
  const { data: influencer } = await supabase
    .from('influencer_codes')
    .select('id,codigo,porcentaje_comision,nombre_influencer')
    .eq('codigo', code)
    .eq('activo', true)
    .maybeSingle()

  if (influencer) {
    const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', userId).not('estado', 'eq', 'CANCELADO')
    if ((count || 0) > 0) return NextResponse.json({ valid: false, reason: 'Solo válido en primera compra' })
    return NextResponse.json({
      valid: true, type: 'INFLUENCER', code: influencer.codigo,
      discount_pct: 15, discount_fijo: 0, tipo: 'porcentaje', valor: 15,
      minimo_compra: 0,
      label: \`\${influencer.nombre_influencer} — 15% OFF primera compra\`,
    })
  }

  // 3. CODIGO REFERIDO
  const { data: referral } = await supabase
    .from('referral_codes')
    .select('id,codigo,user_id')
    .eq('codigo', code)
    .maybeSingle()

  if (referral) {
    if (referral.user_id === userId) return NextResponse.json({ valid: false, reason: 'No puedes usar tu propio código' })
    const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', userId).not('estado', 'eq', 'CANCELADO')
    if ((count || 0) > 0) return NextResponse.json({ valid: false, reason: 'Solo válido en primera compra' })
    return NextResponse.json({
      valid: true, type: 'REFERRAL', code: referral.codigo,
      discount_pct: 15, discount_fijo: 0, tipo: 'porcentaje', valor: 15,
      minimo_compra: 0,
      referrer_id: referral.user_id,
      label: '15% OFF — código de referido',
    })
  }

  return NextResponse.json({ valid: false, reason: 'Código no encontrado' })
}
