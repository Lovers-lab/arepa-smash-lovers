import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const formData = await request.formData()

    const userId = formData.get('userId') as string
    const marca = formData.get('marca') as string
    const metodoPago = formData.get('metodoPago') as string
    const direccion = formData.get('direccion') as string
    const notasCliente = formData.get('notasCliente') as string
    const loyaltyAplicado = Number(formData.get('loyaltyAplicado') || 0)
    const items: Array<{ productId: string; cantidad: number; notas?: string }> = JSON.parse(formData.get('items') as string)
    const comprobante = formData.get('comprobante') as File | null

    if (!userId || !marca || !metodoPago || !items?.length) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    // 1. Validate products and calculate totals
    const productIds = items.map(i => i.productId)
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('id, precio, nombre, activo')
      .in('id', productIds)

    if (prodError || !products?.length) {
      return NextResponse.json({ error: 'Productos no encontrados' }, { status: 400 })
    }

    const productMap = new Map(products.map(p => [p.id, p]))
    let montoOriginal = 0
    const orderItemsData = items.map(item => {
      const product = productMap.get(item.productId)
      if (!product || !product.activo) throw new Error(`Producto ${item.productId} no disponible`)
      const subtotal = product.precio * item.cantidad
      montoOriginal += subtotal
      return {
        product_id: item.productId,
        cantidad: item.cantidad,
        precio_unitario: product.precio,
        subtotal,
        notas: item.notas || null,
      }
    })

    // 2. Check 2x1 offer
    let descuento = loyaltyAplicado
    const { data: offer } = await supabase
      .from('welcome_offers')
      .select('id, usado')
      .eq('user_id', userId)
      .eq('usado', false)
      .gte('fecha_expiracion', new Date().toISOString())
      .single()

    // (2x1 discount calculation omitted here for brevity — full logic: find 2 most expensive eligible items, discount cheapest)

    const montoFinal = Math.max(0, montoOriginal - descuento)
    const costoEnvio = montoFinal >= 1000 ? 0 : 99
    const totalPagado = montoFinal + costoEnvio

    // 3. Get next order number
    const { data: lastOrder } = await supabase
      .from('orders')
      .select('numero_pedido')
      .order('numero_pedido', { ascending: false })
      .limit(1)
      .single()
    const numeroPedido = (lastOrder?.numero_pedido || 500) + 1

    // 4. Upload comprobante if transfer
    let comprobanteUrl: string | null = null
    if (metodoPago === 'TRANSFERENCIA' && comprobante) {
      const ext = comprobante.name.split('.').pop()
      const path = `comprobantes/${userId}/${numeroPedido}.${ext}`
      const buffer = await comprobante.arrayBuffer()
      const { error: uploadErr } = await supabase.storage
        .from('comprobantes')
        .upload(path, buffer, { contentType: comprobante.type, upsert: true })
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('comprobantes').getPublicUrl(path)
        comprobanteUrl = urlData.publicUrl
      }
    }

    // 5. Create order
    const estadoInicial = metodoPago === 'TARJETA' ? 'PAGADO' : 'PENDIENTE'
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        numero_pedido: numeroPedido,
        user_id: userId,
        estado: estadoInicial,
        marca,
        metodo_pago: metodoPago,
        monto_original: montoOriginal,
        descuento,
        monto_final: montoFinal,
        costo_envio: costoEnvio,
        total_pagado: totalPagado,
        loyalty_aplicado: loyaltyAplicado,
        notas_cliente: `${direccion}${notasCliente ? ' · ' + notasCliente : ''}`,
        comprobante_url: comprobanteUrl,
        fecha_orden: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (orderError) {
      console.error('ORDER INSERT ERROR:', JSON.stringify(orderError))
      return NextResponse.json({ error: orderError.message, details: orderError.details, hint: orderError.hint }, { status: 500 })
    }

    // 6. Insert order items
    await supabase.from('order_items').insert(
      orderItemsData.map(item => ({ ...item, order_id: order.id }))
    )

    // 7. Mark welcome offer as used if applied
    if (offer && descuento > loyaltyAplicado) {
      await supabase.from('welcome_offers').update({ usado: true, order_id: order.id, fecha_uso: new Date().toISOString() }).eq('id', offer.id)
    }

    // 8. Deduct loyalty cash if used
    if (loyaltyAplicado > 0) {
      await supabase.rpc('deduct_loyalty', { p_user_id: userId, p_amount: loyaltyAplicado, p_order_id: order.id })
    }

    // 9. Process card payment via MIO (if TARJETA)
    if (metodoPago === 'TARJETA') {
      const cardData = JSON.parse(formData.get('cardData') as string)
      // TODO: call MIO API here
      // const mioResult = await processMIOPayment({ ...cardData, amount: totalPagado })
      // if (!mioResult.approved) { cancel order; return error }
    }

    return NextResponse.json({ success: true, orderId: order.id, numeroPedido })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
