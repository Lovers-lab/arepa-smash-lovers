import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET: obtener reseñas públicas por marca
export async function GET(request: NextRequest) {
  const marca = request.nextUrl.searchParams.get('marca')?.toUpperCase()
  if (!marca) return NextResponse.json({ reviews: [] })

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('reviews')
    .select('*')
    .eq('marca', marca)
    .eq('visible', true)
    .order('created_at', { ascending: false })

  return NextResponse.json({ reviews: data || [] })
}
