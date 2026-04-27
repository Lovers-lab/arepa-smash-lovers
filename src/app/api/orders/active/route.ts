export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SUPA_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ orders: [], debug: 'no userId' })

  console.log('SUPA_URL:', SUPA_URL ? 'SET' : 'MISSING')
  console.log('SUPA_KEY:', SUPA_KEY ? 'SET' : 'MISSING')

  const supabase = createClient(SUPA_URL!, SUPA_KEY!, { auth: { persistSession: false } })

  const { data, error } = await supabase
    .from('orders')
    .select('id, numero_pedido, estado, marca, total_pagado, fecha_orden')
    .eq('user_id', userId)
    .in('estado', ['PENDIENTE', 'PAGADO', 'EN_COCINA', 'LISTO', 'ENVIO_SOLICITADO', 'EN_CAMINO'])
    .order('fecha_orden', { ascending: false })
    .limit(10)

  return NextResponse.json({ orders: data || [], error: error?.message, supaUrl: SUPA_URL ? 'set' : 'missing' }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' }
  })
}
