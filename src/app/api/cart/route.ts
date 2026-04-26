import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET: obtener carrito del usuario
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')
  const marca = request.nextUrl.searchParams.get('marca')
  if (!userId) return NextResponse.json({ items: [] })

  const supabase = createAdminClient()
  let query = supabase.from('carts').select('*').eq('user_id', userId)
  if (marca) query = query.eq('marca', marca)

  const { data } = await query.order('updated_at', { ascending: false })
  return NextResponse.json({ carts: data || [] })
}

// POST: guardar carrito
export async function POST(request: NextRequest) {
  try {
    const { userId, marca, items } = await request.json()
    if (!userId || !marca) return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 })

    const supabase = createAdminClient()
    const { error } = await supabase.from('carts').upsert({
      user_id: userId,
      marca,
      items: items || [],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,marca' })

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE: limpiar carrito
export async function DELETE(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')
  const marca = request.nextUrl.searchParams.get('marca')
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })

  const supabase = createAdminClient()
  let query = supabase.from('carts').delete().eq('user_id', userId)
  if (marca) query = query.eq('marca', marca)
  await query

  return NextResponse.json({ success: true })
}
