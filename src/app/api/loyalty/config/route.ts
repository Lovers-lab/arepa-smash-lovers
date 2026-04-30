import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createAdminClient()
  const { data } = await supabase.from('loyalty_config').select('*').single()
  return NextResponse.json(data || { pesos_por_punto: 10, valor_punto: 1 })
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const { pesos_por_punto, valor_punto } = await request.json()

  if (!pesos_por_punto || pesos_por_punto < 1) {
    return NextResponse.json({ error: 'Configuración inválida' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('loyalty_config')
    .update({ pesos_por_punto, valor_punto, updated_at: new Date().toISOString() })
    .eq('activo', true)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}
