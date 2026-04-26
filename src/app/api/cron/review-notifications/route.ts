import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_NUMBER
  if (!sid || !token || !from) { console.warn('Twilio no configurado'); return false }
  const digits = to.replace(/\D/g, '')
  const e164 = digits.startsWith('1') ? `+${digits}` : `+1${digits}`
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: from, To: `whatsapp:${e164}`, Body: message }),
    })
    const data = await res.json()
    return res.ok && !!data.sid
  } catch { return false }
}

export async function GET(request: NextRequest) {
  // Verificar que es Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Buscar jobs pendientes que ya es hora de enviar
  const { data: jobs } = await supabase
    .from('review_jobs')
    .select('*, order:orders(numero_pedido, marca)')
    .eq('sent', false)
    .lte('scheduled_at', new Date().toISOString())
    .limit(20)

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  let sent = 0
  for (const job of jobs) {
    const token = btoa(job.order_id).slice(0, 16)
    const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/review/${job.order_id}?t=${token}`
    const nombreRestaurante = job.order?.marca === 'SMASH' ? 'Smash Lovers' : 'Arepa Lovers'
    const message = `🙏 ¡Gracias por tu pedido #${job.order?.numero_pedido} en ${nombreRestaurante}!\n\n¿Cómo estuvo tu experiencia? Tu opinión nos ayuda a mejorar.\n\n⭐ Deja tu reseña aquí:\n${reviewUrl}\n\nSolo toma 30 segundos 😊`
    const ok = await sendWhatsApp(job.whatsapp, message)
    if (ok) {
      await supabase.from('review_jobs').update({ sent: true, sent_at: new Date().toISOString() }).eq('id', job.id)
      sent++
    }
  }

  return NextResponse.json({ processed: jobs.length, sent })
}
