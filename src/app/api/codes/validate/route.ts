import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')?.toUpperCase().trim()
  const userId = request.nextUrl.searchParams.get('userId')
  const subtotal = parseFloat(request.nextUrl.searchParams.get('subtotal') || '0')

  if (!code || !userId) return NextResponse.json({ valid: false, reason: 'Datos incompletos' })

  const supabase = createAdminClient()

  // 1. CUPONES GLOBALES Y PERSONALES
  const { data: coupon } = await supabase
    .from('coupons')
    .select('*')
    .eq('codigo', code)
    .eq('activo', true)
    .maybeSingle()

  if (coupon) {
    if (coupon.expira_at && new Date(coupon.expira_at) < new Date())
      return NextResponse.json({ valid: false, reason: 'Cupón vencido' })

    // Verificar si este usuario ya usó este cupón
    const { data: uso } = await supabase
      .from('user_coupons')
      .select('id, usado')
      .eq('coupon_id', coupon.id)
      .eq('user_id', userId)
      .maybeSingle()

    if (uso?.usado)
      return NextResponse.json({ valid: false, reason: 'Ya usaste este cupón' })

    // Validar mínimo de compra
    const minimo = Number(coupon.minimo_compra || 0)
    if (subtotal > 0 && minimo > 0 && subtotal < minimo)
      return NextResponse.json({ valid: false, reason: 'Mínimo de compra: RD$' + minimo.toLocaleString('es-DO') })

    return NextResponse.json({
      valid: true, type: 'CUPON',
      coupon_id: coupon.id,
      user_coupon_id: uso?.id || null,
      code: coupon.codigo,
      tipo: coupon.tipo,
      valor: Number(coupon.valor),
      minimo_compra: minimo,
      discount_pct: coupon.tipo === 'porcentaje' ? Number(coupon.valor) : 0,
      discount_fijo: coupon.tipo === 'fijo' ? Number(coupon.valor) : 0,
      label: coupon.descripcion || (coupon.tipo === 'fijo' ? 'RD$' + coupon.valor + ' de descuento' : coupon.valor + '% de descuento'),
    })
  }

  // 2. CUPONES PERSONALES (user_coupons sin coupon global)
  const { data: userCoupon } = await supabase
    .from('user_coupons')
    .select('id, usado, coupon:coupons(*)')
    .eq('user_id', userId)
    .eq('usado', false)
    .maybeSingle()

  if (userCoupon?.coupon) {
    const c = userCoupon.coupon as any
    if (c.codigo?.toUpperCase() === code) {
      const minimo = Number(c.minimo_compra || 0)
      if (subtotal > 0 && minimo > 0 && subtotal < minimo)
        return NextResponse.json({ valid: false, reason: 'Minimo de compra: RD$' + minimo.toLocaleString('es-DO') })

      return NextResponse.json({
        valid: true, type: 'CUPON',
        coupon_id: c.id,
        user_coupon_id: userCoupon.id,
        code: c.codigo, tipo: c.tipo,
        valor: Number(c.valor),
        minimo_compra: minimo,
        discount_pct: c.tipo === 'porcentaje' ? Number(c.valor) : 0,
        discount_fijo: c.tipo === 'fijo' ? Number(c.valor) : 0,
        label: c.descripcion || (c.tipo === 'fijo' ? 'RD$' + c.valor + ' de descuento' : c.valor + '% de descuento'),
      })
    }
  }

  // 3. INFLUENCER
  const { data: influencer } = await supabase
    .from('influencer_codes')
    .select('id,codigo,porcentaje_comision,nombre_influencer')
    .eq('codigo', code).eq('activo', true).maybeSingle()

  if (influencer) {
    const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', userId).not('estado', 'eq', 'CANCELADO')
    if ((count || 0) > 0) return NextResponse.json({ valid: false, reason: 'Solo valido en primera compra' })
    return NextResponse.json({
      valid: true, type: 'INFLUENCER', code: influencer.codigo,
      discount_pct: 15, discount_fijo: 0, tipo: 'porcentaje', valor: 15, minimo_compra: 0,
      label: influencer.nombre_influencer + ' - 15% OFF primera compra',
    })
  }

  // 4. REFERIDO
  const { data: referral } = await supabase
    .from('referral_codes')
    .select('id,codigo,user_id')
    .eq('codigo', code).maybeSingle()

  if (referral) {
    if (referral.user_id === userId) return NextResponse.json({ valid: false, reason: 'No puedes usar tu propio codigo' })
    const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', userId).not('estado', 'eq', 'CANCELADO')
    if ((count || 0) > 0) return NextResponse.json({ valid: false, reason: 'Solo valido en primera compra' })
    return NextResponse.json({
      valid: true, type: 'REFERRAL', code: referral.codigo,
      discount_pct: 15, discount_fijo: 0, tipo: 'porcentaje', valor: 15, minimo_compra: 0,
      referrer_id: referral.user_id, label: '15% OFF - codigo de referido',
    })
  }

  return NextResponse.json({ valid: false, reason: 'Codigo no encontrado' })
}
