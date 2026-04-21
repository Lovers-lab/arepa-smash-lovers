import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const { userId } = await request.json()
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    // Check if offer already exists
    const { data: existing } = await supabase
      .from('welcome_offers')
      .select('id, codigo')
      .eq('user_id', userId)
      .single()

    if (existing) return NextResponse.json({ success: true, codigo: existing.codigo, skipped: true })

    const codigo = `2X1-${userId.substring(0, 8).toUpperCase()}`
    const { error } = await supabase.from('welcome_offers').insert({
      user_id: userId,
      codigo,
      usado: false,
      fecha_expiracion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })

    if (error) throw error
    return NextResponse.json({ success: true, codigo })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
