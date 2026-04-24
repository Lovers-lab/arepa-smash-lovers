import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const user_id = req.nextUrl.searchParams.get('user_id')
  const { data } = await supabase
    .from('user_coupons')
    .select('*, coupon:coupons(*)')
    .eq('user_id', user_id)
    .eq('usado', false)
    .order('created_at', { ascending: false })
  return NextResponse.json(data || [])
}
