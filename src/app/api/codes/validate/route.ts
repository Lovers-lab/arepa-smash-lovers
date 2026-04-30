import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')?.toUpperCase().trim()
  const userId = request.nextUrl.searchParams.get('userId')
  const subtotal = parseFloat(request.nextUrl.searchParams.get('subtotal') || '0')

  if (!code || !userId) return NextResponse.json({ valid: false, reason: 'Datos requeridos' })

  const supabase = createAdminClient()

  // 1. CUPON PERSONAL (asignado al usuario)
  const { data: userCoupon } = await supabase
    .from('user_coupons')
    .select('id, usado, coupon:coupons(id, codigo, tipo, valor, minimo_compra, descripcion, activo)')
    .eq('user_id', userId)
    .eq('usado', false)
    .filter('coupon.codigo', 'eq', code)
    .maybeSingle()

  if (userCoupon?.coupon) {
    const c = userCoupon.coupon as any
    if (!c.activo) return NextResponse.json({ valid: false, reason: 'Cupón inactivo' })
    if (subtotal > 0 && c.minimo_compra > 0 && subtotal < c.minimo_compra) {
      return NextResponse.json({ valid: false, reason: 'Monto mínimo: RD$' + c.minimo_compra })
    }
    return NextResponse.json({
      valid: true, type: 'CUPON',
      code: c.codigo,
      coupon_id: c.id,
      user_coupon_id: userCoupon.id,
      tipo: c.tipo,
      valor: c.valor,
      discount_pct: c.tipo === 'porcentaje' ? c.valor : 0,
      discount_fijo: c.tipo === 'fijo' ? c.valor : 0,
      minimo_compra: c.minimo_compra || 0,
      label: c.descripcion || (c.tipo === 'fijo' ? 'RD$' + c.valor + ' de descuento' : c.valor + '% de descuento'),
    })
  }

  // 2. CUPON GLOBAL (sin asignar, cualquiera puede usar una vez)
  const { data: globalCoupon } = await supabase
    .from('coupons')
    .select('id, codigo, tipo, valor, minimo_compra, descripcion, activo')
    .eq('codigo', code)
    .eq('activo', true)
    .maybeSingle()

  if (globalCoupon) {
    // Verificar que este usuario no lo haya usado antes
    const { data: yaUsado } = await supabase
      .from('user_coupons')
      .select('id')
      .eq('user_id', userId)
      .eq('coupon_id', globalCoupon.id)
      .maybeSingle()

    if (yaUsado) return NextResponse.json({ valid: false, reason: 'Ya usaste este cupón anteriormente' })

    if (subtotal > 0 && globalCoupon.minimo_compra > 0 && subtotal < globalCoupon.minimo_compra) {
      return NextResponse.json({ valid: false, reason: 'Monto mínimo: RD$' + globalCoupon.minimo_compra })
    }

    return NextResponse.json({
      valid: true, type: 'CUPON',
      code: globalCoupon.codigo,
      coupon_id: globalCoupon.id,
      user_coupon_id: null,
      tipo: globalCoupon.tipo,
      valor: globalCoupon.valor,
      discount_pct: globalCoupon.tipo === 'porcentaje' ? globalCoupon.valor : 0,
      discount_fijo: globalCoupon.tipo === 'fijo' ? globalCoupon.valor : 0,
      minimo_compra: globalCoupon.minimo_compra || 0,
      label: globalCoupon.descripcion || (globalCoupon.tipo === 'fijo' ? 'RD$' + globalCoupon.valor + ' de descuento' : globalCoupon.valor + '% de descuento'),
    })
  }

  // 3. CODIGO INFLUENCER
  const { data: influencer } = await supabase
    .from('influencer_codes')
    .select('id, codigo, porcentaje_comision, nombre_influencer, descripcion')
    .eq('codigo', code)
    .eq('activo', true)
    .maybeSingle()

  if (influencer) {
    // Verificar que este usuario no lo haya usado antes
    const { data: yaUsado } = await supabase
      .from('influencer_uses')
      .select('id')
      .eq('influencer_code_id', influencer.id)
      .eq('user_id', userId)
      .maybeSingle()

    if (yaUsado) return NextResponse.json({ valid: false, reason: 'Ya usaste este código anteriormente' })

    // Obtener config de beneficio para el cliente
    const { data: config } = await supabase.from('referral_config').select('*').single()
    const descPct = config?.beneficio_referido_pct || 15

    return NextResponse.json({
      valid: true, type: 'INFLUENCER',
      code: influencer.codigo,
      influencer_id: influencer.id,
      discount_pct: descPct,
      discount_fijo: 0,
      tipo: 'porcentaje',
      valor: descPct,
      minimo_compra: 0,
      label: influencer.nombre_influencer + ' — ' + descPct + '% OFF',
    })
  }

  // 4. CODIGO REFERIDO
  const { data: referral } = await supabase
    .from('referral_codes')
    .select('id, codigo, user_id')
    .eq('codigo', code)
    .maybeSingle()

  if (referral) {
    if (referral.user_id === userId) {
      return NextResponse.json({ valid: false, reason: 'No puedes usar tu propio código' })
    }

    // Verificar que este usuario no lo haya usado antes
    const { data: yaUsado } = await supabase
      .from('referral_uses')
      .select('id')
      .eq('referred_user_id', userId)
      .maybeSingle()

    if (yaUsado) return NextResponse.json({ valid: false, reason: 'Ya usaste un código de referido anteriormente' })

    // Obtener config
    const { data: config } = await supabase.from('referral_config').select('*').single()
    const descPct = config?.beneficio_referido_pct || 15

    return NextResponse.json({
      valid: true, type: 'REFERRAL',
      code: referral.codigo,
      referral_code_id: referral.id,
      referrer_user_id: referral.user_id,
      discount_pct: descPct,
      discount_fijo: 0,
      tipo: 'porcentaje',
      valor: descPct,
      minimo_compra: 0,
      label: descPct + '% OFF — código de referido',
    })
  }

  return NextResponse.json({ valid: false, reason: 'Código no encontrado' })
}
