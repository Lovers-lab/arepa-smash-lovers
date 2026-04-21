// ============================================================
// MIO Payment Gateway Integration (República Dominicana)
// ============================================================

interface MIOPaymentRequest {
  amount: number          // in RD$ cents (e.g., 50000 = RD$500.00)
  currency: string        // 'DOP'
  cardNumber: string
  cardHolder: string
  expiryMonth: string
  expiryYear: string
  cvv: string
  orderId: string
  description: string
  customerPhone: string
}

interface MIOPaymentResponse {
  approved: boolean
  transactionId?: string
  authCode?: string
  errorCode?: string
  errorMessage?: string
  rawResponse?: unknown
}

export async function processMIOPayment(req: MIOPaymentRequest): Promise<MIOPaymentResponse> {
  const apiUrl = process.env.MIO_API_URL
  const apiKey = process.env.MIO_API_KEY
  const apiSecret = process.env.MIO_API_SECRET

  if (!apiUrl || !apiKey || !apiSecret) {
    throw new Error('MIO credentials not configured')
  }

  try {
    const payload = {
      merchant_key: apiKey,
      amount: Math.round(req.amount * 100), // centavos
      currency: req.currency || 'DOP',
      card: {
        number: req.cardNumber.replace(/\s/g, ''),
        holder_name: req.cardHolder,
        expiry_month: req.expiryMonth,
        expiry_year: req.expiryYear,
        cvv: req.cvv,
      },
      order: {
        id: req.orderId,
        description: req.description,
      },
      customer: {
        phone: req.customerPhone,
      },
    }

    const res = await fetch(`${apiUrl}/charges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiSecret}`,
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (res.ok && data.status === 'approved') {
      return {
        approved: true,
        transactionId: data.transaction_id,
        authCode: data.authorization_code,
        rawResponse: data,
      }
    }

    return {
      approved: false,
      errorCode: data.error_code || String(res.status),
      errorMessage: data.error_message || 'Pago rechazado',
      rawResponse: data,
    }
  } catch (err: any) {
    return {
      approved: false,
      errorCode: 'NETWORK_ERROR',
      errorMessage: err.message || 'Error de conexión con MIO',
    }
  }
}

export function validateCardLocally(numero: string, expiry: string, cvv: string): string | null {
  const digits = numero.replace(/\s/g, '')
  if (digits.length < 15 || digits.length > 16) return 'Número de tarjeta inválido'
  const [mm, yy] = expiry.split('/')
  if (!mm || !yy || Number(mm) < 1 || Number(mm) > 12) return 'Fecha de vencimiento inválida'
  const now = new Date()
  const expDate = new Date(2000 + Number(yy), Number(mm) - 1, 1)
  if (expDate < now) return 'Tarjeta vencida'
  if (cvv.length < 3) return 'CVV inválido'
  return null
}
