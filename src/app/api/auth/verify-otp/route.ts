import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const VERIFY_SERVICE_SID = 'VAee20c1a92ff273af4ab47149884170da'

export async function POST(request: NextRequest) {
  try {
    const { whatsapp, code } = await request.json()
    if (!whatsapp || !code) return NextResponse.json({ valid: false, error: 'Datos requeridos' }, { status: 400 })

    const digits = whatsapp.replace(/\D/g, '')
    const e164 = '+1' + digits

    const sid = process.env.TWILIO_ACCOUNT_SID
    const token = process.env.TWILIO_AUTH_TOKEN
    if (!sid || !token) return NextResponse.json({ valid: false, error: 'Configuracion faltante' }, { status: 500 })

    const res = await fetch(
      'https://verify.twilio.com/v2/Services/' + VERIFY_SERVICE_SID + '/VerificationCheck',
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(sid + ':' + token).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: e164,
          Code: code,
        }).toString(),
      }
    )

    const data = await res.json()
    console.log('VerifyCheck response:', JSON.stringify(data))

    if (data.status !== 'approved') {
      return NextResponse.json({ valid: false, error: 'Codigo incorrecto o vencido' })
    }

    // Buscar o crear usuario en Supabase
    const supabase = createAdminClient()
    const { data: existing } = await supabase
      .from('users')
      .select('id, nombre, activo')
      .eq('whatsapp', digits)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ valid: true, userId: existing.id, isNew: false, nombre: existing.nombre })
    }

    // Usuario nuevo
    const { data: newUser } = await supabase
      .from('users')
      .insert({ whatsapp: digits, activo: true, fecha_registro: new Date().toISOString() })
      .select('id')
      .single()

    return NextResponse.json({ valid: true, userId: newUser?.id, isNew: true })
  } catch (err: any) {
    console.error('VerifyCheck error:', err.message)
    return NextResponse.json({ valid: false, error: err.message }, { status: 500 })
  }
}
