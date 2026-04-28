export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

const MIO_AUTH_URL = process.env['MIO_AUTH_URL']
const MIO_BASE_URL = process.env['MIO_BASE_URL']
const MIO_CLIENT_ID = process.env['MIO_CLIENT_ID']
const MIO_CLIENT_SECRET = process.env['MIO_CLIENT_SECRET']
const SUPA_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SUPA_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']

async function getMioToken(): Promise<string> {
  const res = await fetch(MIO_AUTH_URL + '/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: MIO_CLIENT_ID,
      client_secret: MIO_CLIENT_SECRET,
      scope: '*',
    }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error('MIO Auth error ' + res.status + ': ' + text)
  const data = JSON.parse(text)
  return data.access_token
}

export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json()
    if (!orderId) return NextResponse.json({ error: 'orderId requerido' }, { status: 400 })

    const orderRes = await fetch(SUPA_URL + '/rest/v1/orders?id=eq.' + orderId + '&select=*', {
      headers: { 'apikey': SUPA_KEY!, 'Authorization': 'Bearer ' + SUPA_KEY },
      cache: 'no-store',
    })
    const orders = await orderRes.json()
    const order = Array.isArray(orders) ? orders[0] : null
    if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })

    const token = await getMioToken()
    const appUrl = process.env['NEXT_PUBLIC_APP_URL'] || 'https://arepa-smash-app.vercel.app'

    const res = await fetch(MIO_BASE_URL + '/api/v2/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            currency: '214',
            items: [{
              id: 1,
              name: 'Pedido #' + order.numero_pedido + ' - ' + order.marca,
              unitPrice: { currency: '214', amount: Math.round(order.total_pagado * 100) },
              quantity: 1,
            }],
            redirectOnSuccess: appUrl + '/orders/' + orderId + '?pago=exitoso',
            redirectOnFailure: appUrl + '/orders/' + orderId + '?pago=cancelado',
          },
        },
      }),
    })

    const mioText = await res.text()
    if (!res.ok) return NextResponse.json({ error: 'Error MIO status ' + res.status, details: mioText }, { status: 500 })
    const mioData = JSON.parse(mioText)
    const checkoutUrl = mioData?.data?.attributes?.links?.checkout
    const mioOrderId = mioData?.data?.attributes?.uuid || mioData?.data?.id

    await fetch(SUPA_URL + '/rest/v1/orders?id=eq.' + orderId, {
      method: 'PATCH',
      headers: {
        'apikey': SUPA_KEY!,
        'Authorization': 'Bearer ' + SUPA_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ mio_order_id: mioOrderId, mio_checkout_url: checkoutUrl }),
    })

    return NextResponse.json({ success: true, checkoutUrl, mioOrderId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const orderId = request.nextUrl.searchParams.get('orderId')
    if (!orderId) return NextResponse.json({ status: null })

    const orderRes = await fetch(SUPA_URL + '/rest/v1/orders?id=eq.' + orderId + '&select=mio_order_id', {
      headers: { 'apikey': SUPA_KEY!, 'Authorization': 'Bearer ' + SUPA_KEY },
      cache: 'no-store',
    })
    const orders = await orderRes.json()
    const order = Array.isArray(orders) ? orders[0] : null
    if (!order?.mio_order_id) return NextResponse.json({ status: null })

    const token = await getMioToken()
    const res = await fetch(MIO_BASE_URL + '/api/v2/orders/' + order.mio_order_id, {
      headers: { 'Accept': 'application/vnd.api+json', 'Authorization': 'Bearer ' + token },
    })
    const data = await res.json()
    const status = data?.data?.attributes?.status

    if (status === 'APPROVED' || status === 'PAID') {
      await fetch(SUPA_URL + '/rest/v1/orders?id=eq.' + orderId, {
        method: 'PATCH',
        headers: {
          'apikey': SUPA_KEY!,
          'Authorization': 'Bearer ' + SUPA_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ estado: 'PENDIENTE', metodo_pago: 'TARJETA_MIO' }),
      })
    }

    return NextResponse.json({ status })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
