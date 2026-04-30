import { NextRequest, NextResponse } from 'next/server'

const VERIFY_SID = 'VAee20c1a92ff273af4ab47149884170da'

export async function POST(request: NextRequest) {
  try {
    const { whatsapp } = await request.json()
    if (!whatsapp) return NextResponse.json({ error: 'Numero requerido' }, { status: 400 })

    const digits = whatsapp.replace(/\D/g, '')
    if (digits.length !== 10) return NextResponse.json({ error: 'Numero invalido' }, { status: 400 })

    const sid = process.env.TWILIO_ACCOUNT_SID
    const token = process.env.TWILIO_AUTH_TOKEN
    if (!sid || !token) return NextResponse.json({ error: 'Config faltante' }, { status: 500 })

    const e164 = '+1' + digits

    const res = await fetch(
      'https://verify.twilio.com/v2/Services/' + VERIFY_SID + '/Verifications',
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(sid + ':' + token).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: e164, Channel: 'sms' }).toString(),
      }
    )

    const data = await res.json()
    console.log('Verify send:', JSON.stringify(data))

    if (!res.ok) return NextResponse.json({ error: data.message || 'Error enviando codigo' }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
