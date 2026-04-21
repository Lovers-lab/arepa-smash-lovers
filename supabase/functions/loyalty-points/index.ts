// supabase/functions/loyalty-points/index.ts
// Triggered by Supabase Webhooks when order estado = ENTREGADO

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const body = await req.json()
    const order = body.record

    if (!order || order.estado !== 'ENTREGADO') {
      return new Response(JSON.stringify({ skipped: true }), { headers: corsHeaders })
    }

    // 1. Earn loyalty: RD$10 = 1 punto
    const puntos = Math.floor(order.total_pagado / 10)
    if (puntos > 0) {
      // Upsert loyalty balance
      const { data: existing } = await supabase
        .from('loyalty_balances')
        .select('saldo, total_ganado')
        .eq('user_id', order.user_id)
        .single()

      const newSaldo = (existing?.saldo || 0) + puntos
      await supabase.from('loyalty_balances').upsert({
        user_id: order.user_id,
        saldo: newSaldo,
        total_ganado: (existing?.total_ganado || 0) + puntos,
        updated_at: new Date().toISOString(),
      })

      await supabase.from('loyalty_transactions').insert({
        user_id: order.user_id,
        order_id: order.id,
        tipo: 'GANADO',
        puntos,
        saldo_resultante: newSaldo,
        descripcion: `Compra #${order.numero_pedido}`,
      })
    }

    // 2. Update user stats
    await supabase.rpc('increment_user_stats', {
      p_user_id: order.user_id,
      p_amount: order.total_pagado,
    })

    // 3. Send WhatsApp notification
    const { data: user } = await supabase
      .from('users')
      .select('whatsapp, nombre')
      .eq('id', order.user_id)
      .single()

    if (user && puntos > 0) {
      const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID')
      const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN')
      const twilioFrom = Deno.env.get('TWILIO_WHATSAPP_NUMBER')

      if (twilioSid && twilioToken && twilioFrom) {
        const digits = user.whatsapp.replace(/\D/g, '')
        const to = `whatsapp:+1${digits}`
        const body = `💰 ¡Ganaste ${puntos} Loyalty Cash con tu pedido #${order.numero_pedido}! Ahora tienes RD$${newSaldo} disponibles para tu próxima compra. 🫓🍔`

        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ From: twilioFrom, To: to, Body: body }),
        })
      }
    }

    // 4. Schedule review request (30 min)
    await supabase.from('review_requests').upsert({
      order_id: order.id,
      user_id: order.user_id,
      send_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      sent: false,
    })

    return new Response(JSON.stringify({ success: true, puntos }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
