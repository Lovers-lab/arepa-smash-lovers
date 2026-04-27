export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

const SUPA_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SUPA_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']

const EVENT_MAP: Record<string, string> = {
  'CONFIRMED': 'ENVIO_SOLICITADO',
  'IN_PROGRESS': 'EN_CAMINO',
  'NEAR_PICKUP': 'EN_CAMINO',
  'PICKED_UP': 'EN_CAMINO',
  'NEAR_DROPOFF': 'EN_CAMINO',
  'COMPLETED': 'ENTREGADO',
  'CANCELLED': 'CANCELADO_EN_RUTA',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('PedidosYa webhook:', JSON.stringify(body))
    const { shippingId, eventCode } = body
    if (!shippingId || !eventCode) return NextResponse.json({ ok: true })
    const nuevoEstado = EVENT_MAP[eventCode]
    if (!nuevoEstado) return NextResponse.json({ ok: true, skipped: eventCode })
    const searchUrl = SUPA_URL + '/rest/v1/orders?pedidosya_shipping_id=eq.' + shippingId + '&select=id,numero_pedido,estado'
    const searchRes = await fetch(searchUrl, {
      headers: { 'apikey': SUPA_KEY!, 'Authorization': 'Bearer ' + SUPA_KEY },
      cache: 'no-store',
    })
    const orders = await searchRes.json()
    if (!Array.isArray(orders) || orders.length === 0) return NextResponse.json({ ok: true })
    const order = orders[0]
    const updateData: any = { pedidosya_estado: eventCode, estado: nuevoEstado }
    if (eventCode === 'COMPLETED') updateData.hora_entregado = new Date().toISOString()
    await fetch(SUPA_URL + '/rest/v1/orders?id=eq.' + order.id, {
      method: 'PATCH',
      headers: {
        'apikey': SUPA_KEY!,
        'Authorization': 'Bearer ' + SUPA_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(updateData),
    })
    console.log('Pedido actualizado:', order.numero_pedido, nuevoEstado)
    return NextResponse.json({ ok: true, updated: order.numero_pedido, estado: nuevoEstado })
  } catch (err: any) {
    console.error('Webhook error:', err.message)
    return NextResponse.json({ ok: true })
  }
}
