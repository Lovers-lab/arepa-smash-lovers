'use client'nexport const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Product, Category, CartItem, Marca } from '@/types'

type Cart = { items: CartItem[]; marca: Marca }

function formatRD(amount: number) {
  return `RD$${amount.toLocaleString('es-DO')}`
}

export default function MenuPage() {
  const router = useRouter()
  const supabase = createClient()

  const [marca, setMarca] = useState<Marca>('AREPA')
  const [user, setUser] = useState<{ id: string; nombre: string } | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<Cart>({ items: [], marca: 'AREPA' })
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [loyaltySaldo, setLoyaltySaldo] = useState(0)
  const [loading, setLoading] = useState(true)
  const [brandColors, setBrandColors] = useState({ primary: '#C41E3A', secondary: '#E63946' })

  useEffect(() => {
    const storedUser = localStorage.getItem('lovers_user')
    const storedMarca = localStorage.getItem('lovers_marca') as Marca
    const storedCart = localStorage.getItem('lovers_cart')

    if (!storedUser) { router.replace('/auth/login'); return }

    const u = JSON.parse(storedUser)
    const m = storedMarca || 'AREPA'
    setUser(u)
    setMarca(m)

    if (storedCart) {
      const parsed: Cart = JSON.parse(storedCart)
      if (parsed.marca === m) setCart(parsed)
    }

    loadMenu(m)
    loadBrandColors(m)
    loadLoyalty(u.id)
  }, [])

  async function loadMenu(m: Marca) {
    setLoading(true)
    const { data: cats } = await supabase
      .from('categories')
      .select('*')
      .eq('marca', m)
      .eq('activo', true)
      .order('orden')

    const { data: prods } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('marca', m)
      .eq('activo', true)
      .order('orden_en_categoria')

    if (cats) {
      setCategories(cats)
      setActiveCategory(cats[0]?.id || '')
    }
    if (prods) setProducts(prods)
    setLoading(false)
  }

  async function loadBrandColors(m: Marca) {
    const { data } = await supabase
      .from('brand_colors')
      .select('color_primario, color_secundario')
      .eq('marca', m)
      .eq('activo', true)
      .single()

    if (data) {
      setBrandColors({ primary: data.color_primario, secondary: data.color_secundario })
    } else {
      setBrandColors(m === 'AREPA'
        ? { primary: '#C41E3A', secondary: '#E63946' }
        : { primary: '#0052CC', secondary: '#0066FF' }
      )
    }
  }

  async function loadLoyalty(userId: string) {
    const { data } = await supabase
      .from('loyalty_balances')
      .select('saldo')
      .eq('user_id', userId)
      .single()
    if (data) setLoyaltySaldo(data.saldo)
  }

  // Subscribe to real-time brand color changes
  useEffect(() => {
    if (!marca) return
    const channel = supabase
      .channel('brand_colors_realtime')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'brand_colors',
        filter: `marca=eq.${marca}`,
      }, (payload) => {
        const c = payload.new as { color_primario: string; color_secundario: string }
        setBrandColors({ primary: c.color_primario, secondary: c.color_secundario })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [marca])

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.items.find(i => i.product.id === product.id)
      const items = existing
        ? prev.items.map(i => i.product.id === product.id ? { ...i, cantidad: i.cantidad + 1 } : i)
        : [...prev.items, { product, cantidad: 1 }]
      const updated: Cart = { marca, items }
      localStorage.setItem('lovers_cart', JSON.stringify(updated))
      return updated
    })
  }

  function removeFromCart(productId: string) {
    setCart(prev => {
      const existing = prev.items.find(i => i.product.id === productId)
      if (!existing) return prev
      const items = existing.cantidad === 1
        ? prev.items.filter(i => i.product.id !== productId)
        : prev.items.map(i => i.product.id === productId ? { ...i, cantidad: i.cantidad - 1 } : i)
      const updated: Cart = { marca, items }
      localStorage.setItem('lovers_cart', JSON.stringify(updated))
      return updated
    })
  }

  const cartCount = cart.items.reduce((acc, i) => acc + i.cantidad, 0)
  const cartSubtotal = cart.items.reduce((acc, i) => acc + i.product.precio * i.cantidad, 0)
  const categorizedProducts = (catId: string) => products.filter(p => p.category_id === catId)

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="animate-pulse text-center space-y-2">
          <div className="text-4xl">{marca === 'AREPA' ? '🫓' : '🍔'}</div>
          <p className="text-gray-500 text-sm">Cargando menú...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gray-50 pb-32">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button onClick={() => router.push('/')} className="flex items-center gap-2 font-bold text-sm" style={{ color: brandColors.primary }}>
            <span>{marca === 'AREPA' ? '🫓' : '🍔'}</span>
            <span style={{ fontFamily: 'Syne, serif' }}>{marca === 'AREPA' ? 'Arepa Lovers' : 'Smash Lovers'}</span>
          </button>

          <div className="flex items-center gap-3">
            {loyaltySaldo > 0 && (
              <div className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: `${brandColors.primary}15`, color: brandColors.primary }}>
                💰 {formatRD(loyaltySaldo)}
              </div>
            )}
            <span className="text-sm text-gray-500">Hola, {user?.nombre?.split(' ')[0]}</span>
          </div>
        </div>

        {/* Category tabs */}
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 px-4 pb-3 whitespace-nowrap">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="text-sm font-semibold px-4 py-2 rounded-full transition-all duration-200 shrink-0"
                style={activeCategory === cat.id
                  ? { background: brandColors.primary, color: '#fff' }
                  : { background: '#F3F4F6', color: '#6B7280' }
                }
              >
                {cat.nombre}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Products */}
      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-6">
        {categories
          .filter(cat => !activeCategory || cat.id === activeCategory)
          .map(cat => {
            const catProducts = categorizedProducts(cat.id)
            if (!catProducts.length) return null
            return (
              <section key={cat.id}>
                <h2 className="text-lg font-black mb-3" style={{ fontFamily: 'Syne, serif' }}>{cat.nombre}</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {catProducts.map(product => {
                    const inCart = cart.items.find(i => i.product.id === product.id)
                    return (
                      <div key={product.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow">
                        {product.foto_url && (
                          <div className="h-40 overflow-hidden">
                            <img src={product.foto_url} alt={product.nombre} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                          <div>
                            <h3 className="font-bold text-sm text-gray-900">{product.nombre}</h3>
                            {product.descripcion && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{product.descripcion}</p>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="font-black text-base" style={{ color: brandColors.primary }}>
                              {formatRD(product.precio)}
                            </span>
                            {inCart ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => removeFromCart(product.id)}
                                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-lg"
                                  style={{ background: brandColors.primary }}
                                >−</button>
                                <span className="font-bold text-sm w-4 text-center">{inCart.cantidad}</span>
                                <button
                                  onClick={() => addToCart(product)}
                                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-lg"
                                  style={{ background: brandColors.primary }}
                                >+</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => addToCart(product)}
                                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-lg transition-transform hover:scale-110"
                                style={{ background: brandColors.primary }}
                              >+</button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
      </main>

      {/* Floating cart button */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-4">
          <button
            onClick={() => router.push('/cart')}
            className="w-full py-4 px-6 rounded-2xl text-white font-bold flex items-center justify-between shadow-2xl transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: `linear-gradient(135deg, ${brandColors.primary}, ${brandColors.secondary})` }}
          >
            <span className="bg-white/20 rounded-full px-2 py-0.5 text-sm font-black">{cartCount}</span>
            <span>Ver carrito</span>
            <span className="font-black">{formatRD(cartSubtotal)}</span>
          </button>
        </div>
      )}
    </div>
  )
}
