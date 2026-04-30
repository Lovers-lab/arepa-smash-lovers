import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PYA_BASE = 'https://courier-api.pedidosya.com/v3'
const PYA_TOKEN = process.env.PEDIDOSYA_API_TOKEN!
const PICKUP_LAT = parseFloat(process.env.PEDIDOSYA_PICKUP_LAT || '18.454333')
const PICKUP_LNG = parseFloat(process.env.PEDIDOSYA_PICKUP_LNG || '-69.931222')
const PICKUP_ADDRESS = process.env.PEDIDOSYA_PICKUP_ADDRESS || 'Av. José Contreras 191, Santo Domingo'
const PICKUP_NAME = process.env.PEDIDOSYA_PICKUP_NAME || 'Arepa & Smash Lovers'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function pyaRequest(method: string, path: string, body?: any) {
  const res = await fetch(`${PYA_BASE}${path}`, {
    method,
    headers: {
      'Authorization': PYA_TOKEN,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data: any = {}
  try { data = await res.json() } catch {}
  return { ok: res.ok, status: res.status, data }
}

// POST — crear envío real o estimación de prueba
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const { orderId, test = false } = await request.json()
    if (!orderId) return NextResponse.json({ error: 'orderId requerido' }, { status: 400 })

    const { data: order } = await supabase
      .from('orders')
      .select('*, user:users(nombre, whatsapp)')
      .eq('id', orderId)
      .single()

    if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

    const user = order.user as any
    const dropLat = order.delivery_lat || 18.4861
    const dropLng = order.delivery_lng || -69.9312
    const dropAddress = order.notas_cliente || 'Santo Domingo, RD'
    const phone = user?.whatsapp ? `+1${user.whatsapp}` : '+18095551234'

    const payload = {
      referenceId: order.id,
      isTest: test,
      items: [{
        type: 'STANDARD',
        value: order.total_pagado || 500,
        description: `Pedido #${order.numero_pedido} - ${order.marca}`,
        quantity: 1,
        volume: 5,
        weight: 1,
      }],
      waypoints: [
        {
          type: 'PICK_UP',
          addressStreet: PICKUP_ADDRESS,
          city: 'Santo Domingo',
          latitude: PICKUP_LAT,
          longitude: PICKUP_LNG,
          phone: '+18095551234',
          name: PICKUP_NAME,
          instructions: `Pedido #${order.numero_pedido}`,
        },
        {
          type: 'DROP_OFF',
          addressStreet: dropAddress,
          city: 'Santo Domingo',
          latitude: dropLat,
          longitude: dropLng,
          phone,
          name: user?.nombre || 'Cliente',
          instructions: dropAddress,
        },
      ],
    }

    // Prueba usa endpoint de estimación
    const path = test ? '/shippings/estimates' : '/shippings'
    const { ok, data: result } = await pyaRequest('POST', path, payload)

    if (test) {
      return NextResponse.json({ test: true, ok, estimate: result })
    }

    console.log('PedidosYa response:', JSON.stringify(result))
    if (!ok) {
      console.error('PedidosYa error:', JSON.stringify(result))
      return NextResponse.json({ error: 'Error en PedidosYa', details: result }, { status: 500 })
    }

    // Guardar en la orden
    const shippingId = result.shippingId || result.id
    const trackingUrl = result.trackingUrl || result.tracking_url || null

    await supabase.from('orders').update({
      pedidosya_shipping_id: shippingId,
      pedidosya_tracking_url: trackingUrl,
      pedidosya_estado: 'CREADO',
      usar_pedidosya: true,
      estado: 'ENVIO_SOLICITADO',
    }).eq('id', orderId)

    return NextResponse.json({ success: true, shippingId, trackingUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET — obtener tracking
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const orderId = request.nextUrl.searchParams.get('orderId')
    if (!orderId) return NextResponse.json({ tracking: null })

    const { data: order } = await supabase
      .from('orders')
      .select('pedidosya_shipping_id, pedidosya_tracking_url, pedidosya_estado')
      .eq('id', orderId)
      .single()

    if (!order?.pedidosya_shipping_id) return NextResponse.json({ tracking: null })

    const { ok, data } = await pyaRequest('GET', `/shippings/${order.pedidosya_shipping_id}`)

    if (ok) {
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
        } : null,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE — cancelar envío
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabase()
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
