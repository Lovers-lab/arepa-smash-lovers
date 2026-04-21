import type { Order } from '@/types'

/**
 * Generates a thermal-printer-ready PDF comanda (80mm width)
 * Uses jsPDF loaded dynamically to avoid SSR issues
 */
export async function generateComandaPDF(order: Order) {
  const { jsPDF } = await import('jspdf')

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 200], // 80mm thermal width, auto height
  })

  const W = 80
  const margin = 5
  const lineW = W - margin * 2
  let y = 10

  const line = (text: string, size = 9, bold = false, align: 'left' | 'center' | 'right' = 'left') => {
    doc.setFontSize(size)
    doc.setFont('courier', bold ? 'bold' : 'normal')
    const x = align === 'center' ? W / 2 : align === 'right' ? W - margin : margin
    doc.text(text, x, y, { align })
    y += size * 0.45 + 1
  }

  const separator = () => {
    line('─'.repeat(32), 9)
  }

  // Header
  const marcaNombre = order.marca === 'AREPA' ? 'AREPA LOVERS' : 'SMASH LOVERS'
  const marcaEmoji = order.marca === 'AREPA' ? '🫓' : '🍔'

  line(`${marcaEmoji} ${marcaNombre}`, 12, true, 'center')
  line(`PEDIDO #${order.numero_pedido}`, 11, true, 'center')
  separator()

  // Date / time
  const fecha = new Date(order.fecha_orden)
  line(`Fecha: ${fecha.toLocaleDateString('es-DO')} ${fecha.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}`)

  // Client
  const user = order.user as any
  if (user) {
    line(`Cliente: ${user.nombre || '—'}`)
    line(`Tel: ${user.whatsapp || '—'}`)
  }

  if (order.notas_cliente) {
    line(`Dirección: ${order.notas_cliente}`, 8)
  }

  line(`Pago: ${order.metodo_pago === 'TARJETA' ? 'TARJETA' : 'TRANSFERENCIA'}`)
  separator()

  // Items
  line('PRODUCTOS:', 9, true)
  y += 1
  const items = order.items as any[] || []
  for (const item of items) {
    const nombre = item.product?.nombre || 'Producto'
    const subtotal = `RD$${item.subtotal?.toLocaleString('es-DO')}`
    const col1 = `${item.cantidad}x ${nombre.substring(0, 20)}`
    doc.setFontSize(8.5)
    doc.setFont('courier', 'normal')
    doc.text(col1, margin, y)
    doc.text(subtotal, W - margin, y, { align: 'right' })
    y += 5
    if (item.notas) {
      doc.setFontSize(7.5)
      doc.setFont('courier', 'italic')
      doc.text(`  → ${item.notas}`, margin, y)
      y += 4
    }
  }

  separator()

  // Totals
  const totalLine = (label: string, value: string, bold = false) => {
    doc.setFontSize(9)
    doc.setFont('courier', bold ? 'bold' : 'normal')
    doc.text(label, margin, y)
    doc.text(value, W - margin, y, { align: 'right' })
    y += 5
  }

  totalLine('Subtotal:', `RD$${order.monto_original?.toLocaleString('es-DO')}`)
  if (order.descuento > 0) totalLine('Descuento:', `-RD$${order.descuento.toLocaleString('es-DO')}`)
  totalLine('Envío:', order.costo_envio === 0 ? 'GRATIS' : `RD$${order.costo_envio?.toLocaleString('es-DO')}`)
  y += 1
  separator()
  totalLine('TOTAL:', `RD$${order.total_pagado?.toLocaleString('es-DO')}`, true)
  separator()

  // Special instructions
  if (order.notas_cliente) {
    y += 2
    line('INSTRUCCIONES:', 9, true)
    doc.setFontSize(8.5)
    doc.setFont('courier', 'normal')
    const lines = doc.splitTextToSize(order.notas_cliente, lineW)
    lines.forEach((l: string) => { doc.text(l, margin, y); y += 4 })
    separator()
  }

  // Footer
  y += 3
  line('Preparar para entrega', 9, false, 'center')
  line('¡Gracias!', 10, true, 'center')

  return doc
}
