import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const PYA_BASE = 'https://courier-api.pedidosya.com/v3'
const PYA_TOKEN = process.env.PEDIDOSYA_API_TOKEN!
const PICKUP_LAT = parseFloat(process.env.PEDIDOSYA_PICKUP_LAT || '18.454333')
const PICKUP_LNG = parseFloat(process.env.PEDIDOSYA_PICKUP_LNG || '-69.931222')
const PICKUP_ADDRESS = process.env.PEDIDOSYA_PICKUP_ADDRESS || 'Av. José Contreras 191, Santo Domingo'
const PICKUP_NAME = process.env.PEDIDOSYA_PICKUP_NAME || 'Arepa & Smash Lovers'

async function pyaRequest(method: string, path: string, body?: any) {
  const res = await fetch(`${PYA_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${PYA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, data }
}

// POST /api/pedidosya — crear envío o pedido de prueba
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const { orderId, test = false } = await request.json()

    if (!orderId) return NextResponse.json({ error: 'orderId requerido' }, { status: 400 })

    // Obtener pedido con coordenadas y datos del cliente
    const { data: order } = await supabase
      .from('orders')
      .select('*, user:users(nombre, whatsapp)')
      .eq('id', orderId)
      .single()

    if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    if (!order.delivery_lat || !order.delivery_lng) {
      return NextResponse.json({ error: 'El pedido no tiene coordenadas de entrega' }, { status: 400 })
    }

    const user = order.user as any
    const phone = user?.whatsapp ? `+1${user.whatsapp}` : '+18095551234'

    // Si es prueba, usar endpoint de estimación (sin costo)
    if (test) {
      const { ok, data } = await pyaRequest('POST', '/shippings/estimate', {
        pickup: {
          addressStreet: PICKUP_ADDRESS,
          latitude: PICKUP_LAT,
          longitude: PICKUP_LNG,
        },
        dropoff: {
          addressStreet: order.notas_cliente || 'Santo Domingo',
          latitude: order.delivery_lat,
          longitude: order.delivery_lng,
        },
        packages: [{ quantity: 1, weight: 1, dimensions: { height: 15, width: 20, length: 20 } }],
      })
      return NextResponse.json({ test: true, ok, estimate: data })
    }

    // Crear envío real
    const { ok, data: shipping } = await pyaRequest('POST', '/shippings', {
      referenceId: order.id,
      pickup: {
        name: PICKUP_NAME,
        addressStreet: PICKUP_ADDRESS,
        latitude: PICKUP_LAT,
        longitude: PICKUP_LNG,
        phone: '+18095551234',
        instructions: `Pedido #${order.numero_pedido} — ${order.marca}`,
      },
      dropoff: {
        name: user?.nombre || 'Cliente',
        addressStreet: order.notas_cliente || 'Santo Domingo',
        latitude: order.delivery_lat,
        longitude: order.delivery_lng,
        phone,
        instructions: order.notas_cliente || '',
      },
      packages: [{ quantity: 1, weight: 1, dimensions: { height: 15, width: 20, length: 20 } }],
      payment: { type: 'ONLINE' },
    })

    if (!ok) {
      return NextResponse.json({ error: 'Error creando envío en PedidosYa', details: shipping }, { status: 500 })
    }

    // Guardar ID y tracking URL en la orden
    await supabase.from('orders').update({
      pedidosya_shipping_id: shipping.id || shipping.shippingId,
      pedidosya_tracking_url: shipping.trackingUrl || shipping.tracking_url,
      pedidosya_estado: 'CREADO',
      usar_pedidosya: true,
      estado: 'ENVIO_SOLICITADO',
    }).eq('id', orderId)

    return NextResponse.json({
      success: true,
      shippingId: shipping.id || shipping.shippingId,
      trackingUrl: shipping.trackingUrl || shipping.tracking_url,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET /api/pedidosya?orderId=xxx — obtener estado del tracking
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const orderId = request.nextUrl.searchParams.get('orderId')
    if (!orderId) return NextResponse.json({ error: 'orderId requerido' }, { status: 400 })

    const { data: order } = await supabase
      .from('orders')
      .select('pedidosya_shipping_id, pedidosya_tracking_url, pedidosya_estado')
      .eq('id', orderId)
      .single()

    if (!order?.pedidosya_shipping_id) {
      return NextResponse.json({ tracking: null })
    }

    // Consultar estado en PedidosYa
    const { ok, data } = await pyaRequest('GET', `/shippings/${order.pedidosya_shipping_id}`)

    if (ok) {
      // Actualizar estado en Supabase
      await supabase.from('orders').update({
        pedidosya_estado: data.status || data.state,
      }).eq('id', orderId)
    }

    return NextResponse.json({
      tracking: {
        shippingId: order.pedidosya_shipping_id,
        trackingUrl: order.pedidosya_tracking_url,
        estado: data.status || data.state,
        repartidor: data.courier ? {
          nombre: data.courier.name,
          lat: data.courier.latitude,
          lng: data.courier.longitude,
          telefono: data.courier.phone,
        } : null,
        raw: ok ? data : null,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/pedidosya?orderId=xxx — cancelar envío
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const orderId = request.nextUrl.searchParams.get('orderId')
    if (!orderId) return NextResponse.json({ error: 'orderId requerido' }, { status: 400 })

    const { data: order } = await supabase
      .from('orders')
      .select('pedidosya_shipping_id')
      .eq('id', orderId)
      .single()

    if (!order?.pedidosya_shipping_id) {
      return NextResponse.json({ error: 'No hay envío activo' }, { status: 400 })
    }

    const { ok, data } = await pyaRequest('DELETE', `/shippings/${order.pedidosya_shipping_id}`)

    if (ok) {
      await supabase.from('orders').update({
        pedidosya_estado: 'CANCELADO',
        usar_pedidosya: false,
      }).eq('id', orderId)
    }

    return NextResponse.json({ success: ok, data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
