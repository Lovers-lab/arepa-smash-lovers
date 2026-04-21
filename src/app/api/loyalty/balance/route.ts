// src/app/api/loyalty/balance/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ saldo: 0 })

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('loyalty_balances')
    .select('saldo, total_ganado, total_gastado')
    .eq('user_id', userId)
    .single()

  return NextResponse.json(data || { saldo: 0, total_ganado: 0, total_gastado: 0 })
}
