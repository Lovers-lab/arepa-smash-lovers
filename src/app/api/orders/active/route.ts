import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ orders: [] })

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('orders')
    .select('id, numero_pedido, estado, marca, total_pagado, fecha_orden')
    .eq('user_id', userId)
    .in('estado', ['PENDIENTE', 'PAGADO', 'EN_COCINA', 'LISTO', 'ENVIO_SOLICITADO', 'EN_CAMINO'])
    .order('fecha_orden', { ascending: false })
    .limit(10)

  return NextResponse.json({ orders: data || [] }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' }
  })
}
