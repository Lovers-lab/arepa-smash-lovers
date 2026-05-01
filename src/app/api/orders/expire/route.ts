export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json()
    const supabase = createAdminClient()

    if (orderId) {
      // Verificar una orden específica
      const { data: order } = await supabase
        .from('orders')
        .select('estado, metodo_pago, fecha_orden')
        .eq('id', orderId)
        .single()

      if (order?.estado === 'PENDIENTE' && order?.metodo_pago === 'TARJETA') {
        const fechaOrden = new Date(order.fecha_orden)
        const ahora = new Date()
        const minutos = (ahora.getTime() - fechaOrden.getTime()) / 60000

        if (minutos >= 15) {
          await supabase.from('orders').update({ estado: 'EXPIRADO' }).eq('id', orderId)
          return NextResponse.json({ expired: true })
        }
      }
      return NextResponse.json({ expired: false })
    }

    // Expirar todas las ordenes pendientes vencidas
    const { data } = await supabase
      .from('orders')
      .update({ estado: 'EXPIRADO' })
      .eq('estado', 'PENDIENTE')
      .eq('metodo_pago', 'TARJETA')
      .lt('fecha_orden', new Date(Date.now() - 15 * 60 * 1000).toISOString())
      .select('id, numero_pedido')

    return NextResponse.json({ expired: true, count: data?.length || 0 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
