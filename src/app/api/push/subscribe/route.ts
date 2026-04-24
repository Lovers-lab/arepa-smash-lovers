import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { subscription, user_id, marca } = await req.json()
  const { endpoint, keys } = subscription
  await supabase.from('push_subscriptions').upsert({
    user_id, endpoint, p256dh: keys.p256dh, auth: keys.auth, marca
  }, { onConflict: 'endpoint' })
  return NextResponse.json({ ok: true })
}
