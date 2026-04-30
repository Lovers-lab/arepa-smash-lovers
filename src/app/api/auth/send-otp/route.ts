import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

async function sendOTP(phone: string, code: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM

  if (!sid || !token || !from) {
    console.error('Twilio no configurado - faltan variables')
    return false
  }

  const digits = phone.replace(/\D/g, '')
  const e164 = digits.startsWith('1') ? '+' + digits : '+1' + digits
  const message = 'Tu codigo de verificacion para Arepa & Smash Lovers es: ' + code + '. Valido por 10 minutos. No lo compartas.'

  try {
    const res = await fetch(
      'https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json',
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(sid + ':' + token).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: from,
          To: 'whatsapp:' + e164,
          Body: message,
        }).toString(),
      }
    )
    const data = await res.json()
    console.log('Twilio response:', JSON.stringify(data))
    return res.ok && !!data.sid
  } catch (err: any) {
    console.error('Twilio error:', err.message)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const { whatsapp } = await request.json()
    if (!whatsapp) return NextResponse.json({ error: 'Numero requerido' }, { status: 400 })

    const digits = whatsapp.replace(/\D/g, '')
    if (digits.length !== 10) return NextResponse.json({ error: 'Numero invalido' }, { status: 400 })

    const supabase = createAdminClient()

    await supabase.from('otp_codes').update({ used: true }).eq('whatsapp', digits).eq('used', false)

    const code = generateOTP()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    const { error } = await supabase.from('otp_codes').insert({
      whatsapp: digits,
      code,
      expires_at: expiresAt,
      used: false,
    })

    if (error) throw error

    const sent = await sendOTP(digits, code)
    if (!sent) return NextResponse.json({ error: 'Error enviando el codigo. Intenta de nuevo.' }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
