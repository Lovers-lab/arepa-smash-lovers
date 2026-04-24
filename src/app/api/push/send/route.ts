import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
  const { title, body, url, icon, marca, user_ids } = await req.json()
  let query = supabase.from('push_subscriptions').select('*')
  if (marca) query = query.eq('marca', marca)
  if (user_ids?.length) query = query.in('user_id', user_ids)
  const { data: subs } = await query
  if (!subs?.length) return NextResponse.json({ sent: 0 })
  const payload = JSON.stringify({ title, body, url: url || '/', icon: icon || '/icons/icon-192.png' })
  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
      sent++
    } catch (e: any) {
      if (e.statusCode === 410) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    }
  }
  return NextResponse.json({ sent })
}
