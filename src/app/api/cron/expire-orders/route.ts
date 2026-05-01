export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('orders')
    .update({ estado: 'EXPIRADO' })
    .eq('estado', 'PENDIENTE')
    .eq('metodo_pago', 'TARJETA')
    .lt('fecha_orden', new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .select('id, numero_pedido')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expired: data?.length || 0, orders: data?.map((o: any) => o.numero_pedido) })
}
