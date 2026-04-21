// supabase/functions/welcome-offer-generator/index.ts

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

    // Triggered by DB webhook on users INSERT, OR called manually from API
    const userId = body.record?.id || body.userId
    if (!userId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400 })

    // Check if offer already exists
    const { data: existing } = await supabase
      .from('welcome_offers')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (existing) {
      return new Response(JSON.stringify({ skipped: true, reason: 'offer already exists' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Generate offer
    const codigo = `2X1-${userId.substring(0, 8).toUpperCase()}`
    const fechaExpiracion = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    await supabase.from('welcome_offers').insert({
      user_id: userId,
      codigo,
      usado: false,
      fecha_expiracion: fechaExpiracion,
    })

    // Send WhatsApp welcome message
    const { data: user } = await supabase
      .from('users')
      .select('whatsapp, nombre')
      .eq('id', userId)
      .single()

    if (user) {
      const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID')
      const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN')
      const twilioFrom = Deno.env.get('TWILIO_WHATSAPP_NUMBER')

      if (twilioSid && twilioToken && twilioFrom) {
        const digits = user.whatsapp.replace(/\D/g, '')
        const to = `whatsapp:+1${digits}`
        const msg = `🎁 ¡Bienvenido ${user.nombre}! Tienes un 2x1 esperándote en tu PRIMERA compra.\n\nElige 2 platos fuertes y paga solo el más caro. ¡Empieza a pedir! 🫓🍔\n\nVálido por 30 días.`

        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ From: twilioFrom, To: to, Body: msg }),
        })
      }
    }

    return new Response(JSON.stringify({ success: true, codigo }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
