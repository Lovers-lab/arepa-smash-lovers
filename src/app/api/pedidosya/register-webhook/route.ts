export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

const PYA_TOKEN = process.env['PEDIDOSYA_API_TOKEN']
const APP_URL = process.env['NEXT_PUBLIC_APP_URL'] || 'https://arepa-smash-app.vercel.app'

export async function POST(request: NextRequest) {
  try {
    const res = await fetch('https://courier-api.pedidosya.com/v3/webhooks-configuration', {
      method: 'PUT',
      headers: {
        'Authorization': PYA_TOKEN!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhooksConfiguration: [{
          url: APP_URL + '/api/pedidosya/webhook',
          topic: 'SHIPPING_STATUS',
          isTest: false,
        }]
      }),
    })
    const data = await res.json()
    return NextResponse.json({ ok: res.ok, status: res.status, data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
