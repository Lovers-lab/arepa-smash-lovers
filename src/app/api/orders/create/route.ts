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
    const deliveryLat = formData.get('lat') ? parseFloat(formData.get('lat') as string) : null
    const deliveryLng = formData.get('lng') ? parseFloat(formData.get('lng') as string) : null
    const notasCliente = formData.get('notasCliente') as string
    const promoCode = formData.get('promoCode') as string
    const promoType = formData.get('promoType') as string
    const couponId = formData.get('couponId') as string
    const userCouponId = formData.get('userCouponId') as string
    const loyaltyAplicado = Number(formData.get('loyaltyAplicado') || 0)
    const items: Array<{ productId: string; cantidad: number; notas?: string; modifiers?: Array<{groupId:string;groupNombre:string;optionId:string;optionNombre:string;precioExtra:number}> }> = JSON.parse(formData.get('items') as string)
    const comprobante = formData.get('comprobante') as File | null

    if (!userId || !marca || !metodoPago || !items?.length) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    // 1. Validate products and calculate totals
    const productIds = items.map(i => i.productId)
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('id, precio, nombre, activo, descuento_pct')
      .in('id', productIds)

    if (prodError || !products?.length) {
      return NextResponse.json({ error: 'Productos no encontrados' }, { status: 400 })
    }

    const productMap = new Map(products.map(p => [p.id, p]))
    let montoOriginal = 0
    const orderItemsData = items.map(item => {
      const product = productMap.get(item.productId)
      if (!product || !product.activo) throw new Error(`Producto ${item.productId} no disponible`)
      const descuentoPct = Number((product as any).descuento_pct || 0)
      const precioFinal = descuentoPct > 0 ? Math.round(product.precio * (1 - descuentoPct / 100)) : product.precio
      const subtotal = precioFinal * item.cantidad
      montoOriginal += subtotal
      return {
        product_id: item.productId,
        cantidad: item.cantidad,
        precio_unitario: precioFinal,
        subtotal,
        notas: item.notas || null,
      }
    })

    // 2. Check welcome offer (regalo físico, NO afecta el total)
    const { data: offer } = await supabase
      .from('welcome_offers')
      .select('id, usado')
      .eq('user_id', userId)
      .eq('usado', false)
      .single()

    const isFirstOrder = !!offer

    // 3. Calcular descuento — solo puntos O cupón, nunca ambos, nunca en primera compra
    let descuento = 0
    if (!isFirstOrder) {
      // Solo uno puede tener valor, el frontend garantiza exclusividad
      descuento = loyaltyAplicado || 0
    }

    const montoFinal = Math.max(0, montoOriginal - descuento)
    // Leer costo de envío desde la zona de entrega
    const { data: zona } = await supabase.from('delivery_zones').select('precio_envio, envio_gratis_umbral').eq('activo', true).single()
    const precioEnvio = zona?.precio_envio ?? 99
    const umbralGratis = zona?.envio_gratis_umbral ?? 1000
    const costoEnvio = (umbralGratis === 0 || montoFinal >= umbralGratis) ? 0 : precioEnvio
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
    const estadoInicial = 'PENDIENTE'
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
        notas_cliente: notasCliente || null,
        direccion_texto: direccion,
        delivery_lat: deliveryLat,
        delivery_lng: deliveryLng,
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

    // 6b. Insert order item modifiers
    const orderItemsInserted = await supabase.from('order_items').select('id, product_id').eq('order_id', order.id)
    if (orderItemsInserted.data) {
      const modifierRows: any[] = []
      for (const item of items) {
        if (!item.modifiers?.length) continue
        const orderItem = orderItemsInserted.data.find((oi: any) => oi.product_id === item.productId)
        if (!orderItem) continue
        for (const mod of item.modifiers) {
          modifierRows.push({
            order_item_id: orderItem.id,
            modifier_group_id: mod.groupId,
            modifier_option_id: mod.optionId,
            group_nombre: mod.groupNombre,
            option_nombre: mod.optionNombre,
            precio_extra: mod.precioExtra || 0,
          })
        }
      }
      if (modifierRows.length > 0) {
        await supabase.from('order_item_modifiers').insert(modifierRows)
      }
    }

    // 6c. Marcar cupón como usado
    if (couponId && promoType === 'CUPON') {
      if (userCouponId) {
        // Cupón asignado al usuario
        await supabase.from('user_coupons').update({ usado: true, usado_at: new Date().toISOString(), orden_id: order.id }).eq('id', userCouponId)
      } else {
        // Cupón global — registrar uso
        await supabase.from('user_coupons').insert({ user_id: userId, coupon_id: couponId, usado: true, usado_at: new Date().toISOString(), orden_id: order.id })
      }
    }

    // 7. Mark welcome offer as used (regalo físico)
    if (offer) {
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
