import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { whatsapp, code } = await request.json()
    if (!whatsapp || !code) return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 })

    const digits = whatsapp.replace(/\D/g, '')
    const supabase = createAdminClient()

    // Buscar OTP válido
    const { data: otp } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('whatsapp', digits)
      .eq('code', code.trim())
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!otp) {
      return NextResponse.json({ error: 'Código incorrecto o expirado' }, { status: 401 })
    }

    // Marcar como usado
    await supabase.from('otp_codes').update({ used: true }).eq('id', otp.id)

    // Buscar o retornar usuario
    const { data: user } = await supabase
      .from('users')
      .select('id, nombre, whatsapp')
      .eq('whatsapp', digits)
      .single()

    return NextResponse.json({
      success: true,
      user: user || null,
      isNewUser: !user,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
