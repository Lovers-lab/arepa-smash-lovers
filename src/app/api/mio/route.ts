export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const MIO_AUTH_URL = process.env.MIO_AUTH_URL!
const MIO_BASE_URL = process.env.MIO_BASE_URL!
const MIO_CLIENT_ID = process.env.MIO_CLIENT_ID!
const MIO_CLIENT_SECRET = process.env.MIO_CLIENT_SECRET!

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function getMioToken(): Promise<string> {
  const res = await fetch(`${MIO_AUTH_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: MIO_CLIENT_ID,
      client_secret: MIO_CLIENT_SECRET,
      scope: 'api_orders_post',
    }),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`MIO Auth error ${res.status}: ${text}`)
  }
  try {
    const data = JSON.parse(text)
    return data.access_token
  } catch {
    throw new Error(`MIO Auth respuesta inválida: ${text.substring(0,200)}`)
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const { orderId } = await request.json()
    if (!orderId) return NextResponse.json({ error: 'orderId requerido' }, { status: 400 })

    const { data: order } = await supabase
      .from('orders')
      .select('*, user:users(nombre, whatsapp)')
      .eq('id', orderId)
      .single()

    if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

    const token = await getMioToken()

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://arepa-smash-app.vercel.app'

    const res = await fetch(`${MIO_BASE_URL}/api/v2/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            currency: '214',
            items: [{
              id: 1,
              name: `Pedido #${order.numero_pedido} - ${order.marca}`,
              unitPrice: {
                currency: '214',
                amount: Math.round(order.total_pagado * 100),
              },
              quantity: 1,
            }],
            successUrl: `${appUrl}/orders/${orderId}?pago=exitoso`,
            cancelUrl: `${appUrl}/orders/${orderId}?pago=cancelado`,
          },
        },
      }),
    })

    const mioData = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: 'Error creando pago en MIO', details: mioData }, { status: 500 })
    }

    const checkoutUrl = mioData?.data?.links?.checkout
    const mioOrderId = mioData?.data?.id

    await supabase.from('orders').update({
      mio_order_id: mioOrderId,
      mio_checkout_url: checkoutUrl,
    }).eq('id', orderId)

    return NextResponse.json({ success: true, checkoutUrl, mioOrderId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const orderId = request.nextUrl.searchParams.get('orderId')
    if (!orderId) return NextResponse.json({ error: 'orderId requerido' }, { status: 400 })

    const { data: order } = await supabase
      .from('orders')
      .select('mio_order_id')
      .eq('id', orderId)
      .single()

    if (!order?.mio_order_id) return NextResponse.json({ status: null })

    const token = await getMioToken()
    const res = await fetch(`${MIO_BASE_URL}/api/v2/orders/${order.mio_order_id}`, {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await res.json()
    const status = data?.data?.attributes?.status

    if (status === 'APPROVED' || status === 'PAID') {
      await supabase.from('orders').update({
        estado: 'PAGADO',
        metodo_pago: 'TARJETA_MIO',
      }).eq('id', orderId)
    }

    return NextResponse.json({ status, raw: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
