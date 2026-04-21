import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  notifyOrderEnCocina,
  notifyOrderRepartidorCamino,
  notifyOrderEntregado,
} from '@/lib/api/whatsapp'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAdminClient()
    const { estado, adminNombre } = await request.json()
    const orderId = params.id

    // Verify admin auth
    const { data: { user } } = await supabase.auth.getUser(
      request.headers.get('Authorization')?.replace('Bearer ', '') || ''
    )
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Get order with user phone and settings
    const { data: order } = await supabase
      .from('orders')
      .select('*, user:users(whatsapp, nombre), marca')
      .eq('id', orderId)
      .single()

    if (!order) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })

    // Build update payload
    const now = new Date().toISOString()
    const updates: Record<string, unknown> = {
      estado,
      notas_admin: `${adminNombre} → ${estado} @ ${new Date().toLocaleTimeString('es-DO')}`,
    }

    if (estado === 'EN_COCINA') updates.hora_pago_confirmado = now
    if (estado === 'LISTO') updates.hora_listo = now
    if (estado === 'ENTREGADO') updates.hora_entregado = now

    await supabase.from('orders').update(updates).eq('id', orderId)

    // Get WhatsApp message templates from settings
    const { data: settings } = await supabase
      .from('app_settings')
      .select('msg_cocina, msg_repartidor_camino, msg_en_ruta, msg_entregado')
      .eq('marca', order.marca)
      .single()

    // Send WhatsApp notification
    const phone = (order.user as any)?.whatsapp
    if (phone && settings) {
      switch (estado) {
        case 'EN_COCINA':
          await notifyOrderEnCocina(phone, order.numero_pedido, settings.msg_cocina)
          break
        case 'ENVIO_SOLICITADO':
          await notifyOrderRepartidorCamino(phone, order.numero_pedido, settings.msg_repartidor_camino)
          break
        case 'ENTREGADO':
          await notifyOrderEntregado(phone, order.numero_pedido, settings.msg_entregado)
          // Schedule review request after 30 minutes (via Edge Function cron)
          await supabase.from('review_requests').insert({
            order_id: orderId,
            user_id: order.user_id,
            send_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          }).select()
          break
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
