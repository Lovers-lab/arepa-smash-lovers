// Sincronizar carrito con Supabase
export async function syncCartToCloud(userId: string, marca: string, items: any[]) {
  try {
    await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, marca, items }),
    })
  } catch {
    // silencioso — localStorage sigue funcionando como fallback
  }
}

// Cargar carrito desde Supabase
export async function loadCartFromCloud(userId: string, marca: string): Promise<any[] | null> {
  try {
    const res = await fetch(`/api/cart?userId=${userId}&marca=${marca}`)
    const data = await res.json()
    const cart = data.carts?.find((c: any) => c.marca === marca)
    return cart?.items || null
  } catch {
    return null
  }
}

// Cargar pedidos activos desde Supabase
export async function loadActiveOrdersFromCloud(userId: string): Promise<any[]> {
  try {
    const res = await fetch(`/api/orders/active?userId=${userId}`, { cache: 'no-store' })
    const data = await res.json()
    return data.orders || []
  } catch {
    return []
  }
}
