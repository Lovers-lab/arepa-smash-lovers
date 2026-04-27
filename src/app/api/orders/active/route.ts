export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

const SUPA_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SUPA_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ orders: [] })

  const estados = ['PENDIENTE', 'PAGADO', 'EN_COCINA', 'LISTO', 'ENVIO_SOLICITADO', 'EN_CAMINO']
  const estadosFilter = estados.map(e => `estado.eq.${e}`).join(',')

  const url = `${SUPA_URL}/rest/v1/orders?select=id,numero_pedido,estado,marca,total_pagado,fecha_orden&user_id=eq.${userId}&or=(${estadosFilter})&order=fecha_orden.desc&limit=10`

  const res = await fetch(url, {
    headers: {
      'apikey': SUPA_KEY!,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Cache-Control': 'no-cache, no-store',
      'Pragma': 'no-cache',
    },
    cache: 'no-store',
  })

  const data = await res.json()
  return NextResponse.json({ orders: Array.isArray(data) ? data : [] }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' }
  })
}
