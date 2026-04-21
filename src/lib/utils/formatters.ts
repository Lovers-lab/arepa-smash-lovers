// ============================================================
// Formatters
// ============================================================

export function formatRD(amount: number): string {
  return `RD$${amount.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function formatDate(dateStr: string, includeTime = false): string {
  const date = new Date(dateStr)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
  if (includeTime) { opts.hour = '2-digit'; opts.minute = '2-digit' }
  return date.toLocaleDateString('es-DO', opts)
}

export function timeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'Ahora mismo'
  if (mins === 1) return 'Hace 1 minuto'
  if (mins < 60) return `Hace ${mins} minutos`
  const hrs = Math.floor(mins / 60)
  if (hrs === 1) return 'Hace 1 hora'
  if (hrs < 24) return `Hace ${hrs} horas`
  return formatDate(dateStr)
}

export function formatOrderNumber(n: number): string {
  return `#${String(n).padStart(4, '0')}`
}

export function calculateLoyaltyEarned(amount: number): number {
  return Math.floor(amount / 10)
}

export function calculateShipping(subtotal: number, umbral = 1000, costo = 50): number {
  return subtotal >= umbral ? 0 : costo
}

export function calculate2x1Discount(items: Array<{ precio: number; isMainDish: boolean }>): number {
  // Get the two most expensive main dishes, discount the cheapest
  const mainDishes = items
    .filter(i => i.isMainDish)
    .map(i => i.precio)
    .sort((a, b) => b - a)

  if (mainDishes.length < 2) return 0
  return mainDishes[1] // discount the second (cheaper) one
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return `${str.slice(0, maxLength)}...`
}
