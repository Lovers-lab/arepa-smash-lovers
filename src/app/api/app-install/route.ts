import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function generateCode() {
  return 'INSTALL-' + Math.random().toString(36).substring(2,8).toUpperCase()
}

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { user_id, marca, accion } = await req.json()

  // Registrar instalacion
  await supabase.from('app_installs').insert({ user_id, marca, accion })

  // Si es instalacion nueva, dar cupon de RD$100
  if (accion === 'install') {
    // Crear cupon unico
    const codigo = generateCode()
    const { data: coupon } = await supabase.from('coupons').insert({
      codigo,
      valor: 100,
      tipo: 'fijo',
      minimo_compra: 500,
      descripcion: 'Bienvenido a la app - RD$100 de descuento',
      activo: true,
      expira_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }).select().single()

    if (coupon) {
      await supabase.from('user_coupons').insert({
        user_id, coupon_id: coupon.id
      })
    }
    return NextResponse.json({ ok: true, cupon: codigo })
  }

  return NextResponse.json({ ok: true })
}
