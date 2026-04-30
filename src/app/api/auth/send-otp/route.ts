import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

async function sendWhatsAppOTP(phone: string, code: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM

  console.log('Twilio config:', { sid: !!sid, token: !!token, from: from || 'MISSING' })
  if (!sid || !token || !from) {
    console.error('Twilio no configurado - variables faltantes')
    return false
  }

  const digits = phone.replace(/\D/g, '')
  const e164 = digits.startsWith('1') ? `+${digits}` : `+1${digits}`

  const message = `🔐 Tu código de verificación para Arepa & Smash Lovers es:\n\n*${code}*\n\nVálido por 10 minutos. No lo compartas con nadie.`

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: from, To: `whatsapp:${e164}`, Body: message }),
      }
    )
    const data = await res.json()
    return res.ok && !!data.sid
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const { whatsapp } = await request.json()
    if (!whatsapp) return NextResponse.json({ error: 'Número requerido' }, { status: 400 })

    const digits = whatsapp.replace(/\D/g, '')
    if (digits.length !== 10) return NextResponse.json({ error: 'Número inválido' }, { status: 400 })

    const supabase = createAdminClient()

    // Invalidar OTPs anteriores del mismo número
    await supabase.from('otp_codes').update({ used: true }).eq('whatsapp', digits).eq('used', false)

    // Generar nuevo OTP
    const code = generateOTP()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    const { error } = await supabase.from('otp_codes').insert({
      whatsapp: digits,
      code,
      expires_at: expiresAt,
      used: false,
    })

    if (error) throw error

    // Enviar por WhatsApp
    const sent = await sendWhatsAppOTP(digits, code)
    if (!sent) return NextResponse.json({ error: 'Error enviando el código. Intenta de nuevo.' }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
