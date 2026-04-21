// ============================================================
// WhatsApp Notifications via Twilio
// ============================================================

interface WhatsAppMessage {
  to: string       // phone number with country code, e.g. '18095551234'
  template: string // message text with {{variables}} replaced
}

export function buildMessage(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`)
}

export async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_NUMBER // 'whatsapp:+14155238886'

  if (!sid || !token || !from) {
    console.warn('Twilio not configured — WhatsApp message skipped')
    return false
  }

  // Normalize DR number to E.164
  const digits = to.replace(/\D/g, '')
  const e164 = digits.startsWith('1') ? `+${digits}` : `+1${digits}`

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: from,
          To: `whatsapp:${e164}`,
          Body: message,
        }),
      }
    )
    const data = await res.json()
    return res.ok && data.sid
  } catch {
    return false
  }
}

// Convenience functions for each order state

export async function notifyOrderEnCocina(
  phone: string, numeroPedido: number, template: string
) {
  const msg = buildMessage(template, { numero: String(numeroPedido) })
  return sendWhatsApp(phone, msg)
}

export async function notifyOrderRepartidorCamino(
  phone: string, numeroPedido: number, template: string
) {
  const msg = buildMessage(template, { numero: String(numeroPedido), eta: '8' })
  return sendWhatsApp(phone, msg)
}

export async function notifyOrderEnRuta(
  phone: string, numeroPedido: number, repartidor: string, telefono: string, template: string
) {
  const msg = buildMessage(template, { numero: String(numeroPedido), repartidor, telefono })
  return sendWhatsApp(phone, msg)
}

export async function notifyOrderEntregado(
  phone: string, numeroPedido: number, template: string
) {
  const msg = buildMessage(template, { numero: String(numeroPedido) })
  return sendWhatsApp(phone, msg)
}

export async function notifyLoyaltyGanado(phone: string, puntos: number) {
  const msg = `💰 ¡Ganaste ${puntos} Loyalty Cash! Equivale a RD$${puntos} para tu próximo pedido. Sigue pidiendo y sigue ganando. 🫓🍔`
  return sendWhatsApp(phone, msg)
}

export async function notifyWelcomeOffer(phone: string, nombre: string) {
  const msg = `🎁 ¡Bienvenido ${nombre}! Tienes un 2x1 en tu primera compra. Elige 2 platos fuertes y paga solo el más caro. ¡Empieza ya! 🫓🍔`
  return sendWhatsApp(phone, msg)
}
