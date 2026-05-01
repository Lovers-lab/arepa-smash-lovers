'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Product, Category, CartItem, Marca } from '@/types'
import type { SelectedModifier } from '@/types/modifiers'
import ModifierModal from '@/components/menu/ModifierModal'
import ProductPreviewModal from '@/components/menu/ProductPreviewModal'
import { syncCartToCloud, loadCartFromCloud } from '@/lib/utils/cart'

type Cart = { items: CartItem[]; marca: Marca }

function formatRD(amount: number) {
  return `RD$${amount.toLocaleString('es-DO')}`
}

function createRipple(e: React.MouseEvent<HTMLButtonElement>, color = 'rgba(255,255,255,0.4)') {
  const btn = e.currentTarget
  const circle = document.createElement('span')
  const diameter = Math.max(btn.clientWidth, btn.clientHeight)
  const radius = diameter / 2
  const rect = btn.getBoundingClientRect()
  circle.style.cssText = `width:${diameter}px;height:${diameter}px;left:${e.clientX-rect.left-radius}px;top:${e.clientY-rect.top-radius}px;position:absolute;border-radius:50%;background:${color};transform:scale(0);animation:ripple-anim 0.5s linear;pointer-events:none;`
  circle.classList.add('ripple')
  btn.appendChild(circle)
  setTimeout(() => circle.remove(), 600)
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
  const [modifierProduct, setModifierProduct] = useState<Product | null>(null)
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null)
  const [addedFeedback, setAddedFeedback] = useState<string | null>(null)
  const [pushGranted, setPushGranted] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [appInstalled, setAppInstalled] = useState(false)
  const [showPushBanner, setShowPushBanner] = useState(false)

  async function installApp() {
    if (!installPrompt) return
    installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  async function subscribePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    if (existing) { setPushGranted(true); return }
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: "BOYGrUbcWIt4l-gMGtNA0kSi3Ls1yxy0f7E2sq95RNG5UgcsZ817HzD-cGvE5C1JRaBKRBKEOqlGOkgIzBRs7vA"
    })
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub, user_id: user?.id, marca })
    })
    setPushGranted(true)
  }
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const tabsRef = useRef<HTMLDivElement>(null)
  const isScrollingRef = useRef(false)

  useEffect(() => {
    const storedUser = localStorage.getItem('lovers_user')
    const storedMarca = localStorage.getItem('lovers_marca') as Marca
    const storedCart = localStorage.getItem('lovers_cart')
    // Sync carrito desde cloud en background
    if (storedUser) {
      const u = JSON.parse(storedUser);
      (async () => {
        try {
          const cloudItems = await loadCartFromCloud(u.id, storedMarca || 'AREPA')
          if (cloudItems && cloudItems.length > 0) {
            const localCart = storedCart ? JSON.parse(storedCart) : null
            if (!localCart || !localCart.items || localCart.items.length === 0) {
              localStorage.setItem('lovers_cart', JSON.stringify({ marca: storedMarca || 'AREPA', items: cloudItems }))
              setCart({ marca: storedMarca as Marca || 'AREPA', items: cloudItems })
            }
          }
        } catch {}
      })()
    }
    if (!storedUser) { router.replace('/auth/login'); return }
    const u = JSON.parse(storedUser)
    const m = storedMarca || 'AREPA'
    setUser(u); setMarca(m)
    if (storedCart) { const p: Cart = JSON.parse(storedCart); if (p.marca === m) setCart(p) }
    loadMenu(m); loadBrandColors(m); loadLoyalty(u.id)
    // Detectar si ya esta instalada
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setAppInstalled(true)
    }
    // Capturar prompt de instalacion
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    // Detectar cuando se instala
    window.addEventListener('appinstalled', async () => {
      setAppInstalled(true); setInstallPrompt(null)
      const stored = localStorage.getItem('lovers_user')
      if (stored) {
        const u2 = JSON.parse(stored)
        const res = await fetch('/api/app-install', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: u2.id, marca: localStorage.getItem('lovers_marca') || 'AREPA', accion: 'install' })
        })
        const data = await res.json()
        if (data.cupon) {
          setTimeout(() => alert('🎉 App instalada. Tienes un cupón de RD$100 esperándote en tu billetera.'), 500)
        }
      }
    })
    setTimeout(async () => {
      if (!('Notification' in window)) return
      if (Notification.permission === 'denied') return
      if (localStorage.getItem('push_subscribed') === '1') { setPushGranted(true); return }
      if (Notification.permission === 'granted') {
        const reg = await navigator.serviceWorker.ready
        const existing = await reg.pushManager.getSubscription()
        if (existing) { setPushGranted(true); return }
        // Permiso ya dado pero sin suscripcion - resuscribir silenciosamente
        try {
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: "BOYGrUbcWIt4l-gMGtNA0kSi3Ls1yxy0f7E2sq95RNG5UgcsZ817HzD-cGvE5C1JRaBKRBKEOqlGOkgIzBRs7vA"
          })
          const stored = localStorage.getItem('lovers_user')
          if (stored) {
            const u2 = JSON.parse(stored)
            await fetch('/api/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subscription: sub, user_id: u2.id, marca: localStorage.getItem('lovers_marca') || 'AREPA' })
            })
          }
          setPushGranted(true); return
        } catch(e) { /* silencioso */ }
      }
      setShowPushBanner(true)
    }, 1500)
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      if (isScrollingRef.current) return
      const scrollY = window.scrollY + 160
      let current = categories[0]?.id || ''
      for (const cat of categories) {
        const el = sectionRefs.current[cat.id]
        if (el && el.offsetTop <= scrollY) current = cat.id
      }
      if (current !== activeCategory) {
        setActiveCategory(current)
        const tabEl = tabsRef.current?.querySelector(`[data-catid="${current}"]`) as HTMLElement
        if (tabEl && tabsRef.current) tabsRef.current.scrollTo({ left: tabEl.offsetLeft - 16, behavior: 'smooth' })
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [categories, activeCategory])

  async function loadMenu(m: Marca) {
    setLoading(true)
    const { data: cats } = await supabase.from('categories').select('*').eq('marca', m).eq('activo', true).order('orden')
    const { data: prods } = await supabase.from('products').select('*, category:categories(*)').eq('marca', m).eq('activo', true).order('orden_en_categoria')
    if (cats) { setCategories(cats); setActiveCategory(cats[0]?.id || '') }
    if (prods) setProducts(prods)
    setLoading(false)
  }

  async function loadBrandColors(m: Marca) {
    const { data } = await supabase.from('brand_colors').select('color_primario, color_secundario').eq('marca', m).eq('activo', true).single()
    if (data) setBrandColors({ primary: data.color_primario, secondary: data.color_secundario })
    else setBrandColors(m === 'AREPA' ? { primary: '#C41E3A', secondary: '#E63946' } : { primary: '#0052CC', secondary: '#0066FF' })
  }

  async function loadLoyalty(userId: string) {
    const { data } = await supabase
      .from('loyalty_balances')
      .select('saldo')
      .eq('user_id', userId)
      .single()
    if (data?.saldo !== undefined) setLoyaltySaldo(Number(data.saldo))
  }

  // Escuchar cambios en tiempo real en loyalty_balances
  // Recargar puntos cada vez que el componente se monta
  useEffect(() => {
    const stored = localStorage.getItem('lovers_user')
    if (!stored) return
    const u = JSON.parse(stored)
    loadLoyalty(u.id)
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('lovers_user')
    if (!stored) return
    const u = JSON.parse(stored)
    const ch = supabase.channel('loyalty_' + u.id)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'loyalty_balances',
        filter: 'user_id=eq.' + u.id,
      }, (payload: any) => {
        if (payload.new?.saldo !== undefined) setLoyaltySaldo(Number(payload.new.saldo))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  function scrollToCategory(catId: string) {
    const el = sectionRefs.current[catId]
    if (!el) return
    isScrollingRef.current = true
    setActiveCategory(catId)
    window.scrollTo({ top: el.offsetTop - 130, behavior: 'smooth' })
    setTimeout(() => { isScrollingRef.current = false }, 900)
  }

  function addToCart(product: Product, modifiers: SelectedModifier[] = [], totalExtras: number = 0, notas: string = '') {
    setCart(prev => {
      const hasModifiers = modifiers.length > 0
      // Aplicar descuento al precio antes de guardar en carrito
      const descuentoPct = Number((product as any).descuento_pct || 0)
      const productConPrecioFinal = descuentoPct > 0
        ? { ...product, precio: Math.round(product.precio * (1 - descuentoPct / 100)) }
        : product
      const existing = !hasModifiers ? prev.items.find(i => i.product.id === product.id && !i.modifiers?.length) : null
      const items = existing
        ? prev.items.map(i => i.product.id === product.id && !i.modifiers?.length ? { ...i, cantidad: i.cantidad + 1 } : i)
        : [...prev.items, { product: productConPrecioFinal, cantidad: 1, modifiers, totalExtras, notas }]
      const updated: Cart = { marca, items }
      localStorage.setItem('lovers_cart', JSON.stringify(updated))
      return updated
    })
    setAddedFeedback(product.id)
    setTimeout(() => setAddedFeedback(null), 1000)
  }

  function removeFromCart(productId: string) {
    setCart(prev => {
      const existing = prev.items.find(i => i.product.id === productId)
      if (!existing) return prev
      const items = existing.cantidad === 1 ? prev.items.filter(i => i.product.id !== productId) : prev.items.map(i => i.product.id === productId ? { ...i, cantidad: i.cantidad - 1 } : i)
      const updated: Cart = { marca, items }
      localStorage.setItem('lovers_cart', JSON.stringify(updated))
      return updated
    })
  }

  const cartCount = cart.items.reduce((a, i) => a + i.cantidad, 0)
  const cartSubtotal = cart.items.reduce((a, i) => a + (i.product.precio + (i.totalExtras || 0)) * i.cantidad, 0)
  const brandLogo = marca === 'AREPA' ? '/logos/logo-arepa.png' : '/logos/logo-smash.png'

  if (loading) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F8FA' }}>
      <div style={{ textAlign: 'center' }}>
        <img src={brandLogo} style={{ width: '72px', height: '72px', borderRadius: '18px', marginBottom: '12px', opacity: 0.7 }} alt="" />
        <p style={{ color: '#9CA3AF', fontSize: '14px' }}>Cargando menú...</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', background: '#F7F8FA', paddingBottom: '120px', fontFamily: 'var(--font-body)' }}>
      <style>{`
        @keyframes ripple-anim { to { transform:scale(4); opacity:0; } }
        @keyframes slideUp { from { opacity:0; transform:translateX(-50%) translateY(16px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        @keyframes popIn { 0%{transform:scale(0.7);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
        .md-ripple { position:relative; overflow:hidden; }
        .scrollbar-hide::-webkit-scrollbar { display:none; }
        .scrollbar-hide { scrollbar-width:none; }
      `}</style>

      {/* HEADER */}
      <header style={{ position:'sticky', top:0, zIndex:30, background:'white', borderBottom:'1px solid #E4E6EA', boxShadow:'0 1px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth:'640px', margin:'0 auto', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <button onClick={() => router.push('/')} style={{ display:'flex', alignItems:'center', gap:'10px', background:'none', border:'none', cursor:'pointer', padding:0 }}>
            <img src={brandLogo} style={{ width:'36px', height:'36px', borderRadius:'10px', objectFit:'cover' }} alt="" />
            <div style={{ textAlign:'left' }}>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'16px', color:brandColors.primary, lineHeight:1 }}>
                {marca === 'AREPA' ? 'Arepa Lovers' : 'Smash Lovers'}
              </div>
              <div style={{ fontSize:'11px', color:'#9CA3AF', marginTop:'2px' }}>Toca para cambiar ‹</div>
            </div>
          </button>
          <button onClick={() => router.push('/wallet')}
            style={{ display:'flex', alignItems:'center', gap:'5px', padding:'7px 14px', borderRadius:'999px', border:'none', cursor:'pointer', background:`${brandColors.primary}12`, color:brandColors.primary, fontSize:'12px', fontWeight:700 }}>
            💰 {loyaltySaldo > 0 ? `${loyaltySaldo} pts` : 'Billetera'}
          </button>
        </div>

        {/* Category chips */}
        <div ref={tabsRef} className="scrollbar-hide"
          style={{ display:'flex', gap:'8px', padding:'0 16px 12px', overflowX:'auto', maxWidth:'640px', margin:'0 auto' }}>
          {categories.map(cat => (
            <button key={cat.id} data-catid={cat.id}
              onClick={(e) => { createRipple(e, activeCategory === cat.id ? 'rgba(255,255,255,0.3)' : `${brandColors.primary}20`); scrollToCategory(cat.id) }}
              className="md-ripple"
              style={{ padding:'8px 18px', borderRadius:'999px', border:'none', fontFamily:'var(--font-body)', fontSize:'13px', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, transition:'all 0.2s', background: activeCategory === cat.id ? brandColors.primary : '#F3F4F6', color: activeCategory === cat.id ? 'white' : '#6B7280', boxShadow: activeCategory === cat.id ? `0 2px 8px ${brandColors.primary}40` : 'none' }}>
              {cat.nombre}
            </button>
          ))}
        </div>
      </header>

      {/* PRODUCTS */}
      <main style={{ maxWidth:'640px', margin:'0 auto', padding:'0 14px' }}>
        {categories.map(cat => {
          const catProducts = products.filter(p => p.category_id === cat.id)
          if (!catProducts.length) return null
          return (
            <section key={cat.id} ref={el => { sectionRefs.current[cat.id] = el }} style={{ paddingTop:'24px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'14px' }}>
                <h2 style={{ fontFamily:'var(--font-display)', fontSize:'20px', fontWeight:800, color:'#0D0F12', margin:0 }}>{cat.nombre}</h2>
                <div style={{ height:'2px', flex:1, background:'#F0F2F5', borderRadius:'2px' }} />
                <span style={{ fontSize:'12px', color:'#9CA3AF', fontWeight:600 }}>{catProducts.length}</span>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                {catProducts.map(product => {
                  const inCartItem = cart.items.find(i => i.product.id === product.id)
                  const inCartQty = inCartItem?.cantidad || 0
                  const justAdded = addedFeedback === product.id
                  const descuento = (product as any).descuento_pct
                  const esDestacado = (product as any).es_destacado

                  return (
                    <div key={product.id}
                      onClick={() => setPreviewProduct(product)}
                      onClick={() => setPreviewProduct(product)}
                      style={{ background:'white', borderRadius:'20px', border:'1px solid #E8EAED', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 2px 8px rgba(0,0,0,0.04)', transition:'transform 0.15s, box-shadow 0.15s', cursor:'pointer', WebkitTapHighlightColor:'transparent' }}>

                      {/* Image */}
                      <div style={{ position:'relative', height:'120px', background:'linear-gradient(135deg, #FEF3C7, #FDE68A)', overflow:'hidden' }}>
                        {product.foto_url
                          ? <img src={product.foto_url} alt={product.nombre} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'40px' }}>{marca === 'AREPA' ? '🫓' : '🍔'}</div>
                        }
                        {descuento > 0 && (
                          <div style={{ position:'absolute', top:'8px', left:'8px', background:'#FFD600', color:'#1A1A1A', fontSize:'13px', fontWeight:900, padding:'5px 12px', borderRadius:'999px', boxShadow:'0 2px 6px rgba(0,0,0,0.15)' }}>{descuento}% OFF</div>
                        )}
                        {esDestacado && (
                          <div style={{ position:'absolute', top:'8px', right:'8px', background:brandColors.primary, color:'white', fontSize:'13px', fontWeight:900, padding:'5px 12px', borderRadius:'999px', boxShadow:'0 2px 6px rgba(0,0,0,0.2)' }}>⭐ Top</div>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ padding:'10px 12px', flex:1, display:'flex', flexDirection:'column', justifyContent:'space-between', gap:'8px' }}>
                        <div>
                          <h3 style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'13px', color:'#0D0F12', lineHeight:1.3, margin:'0 0 3px' }}>{product.nombre}</h3>
                          {product.descripcion && (
                            <p style={{ fontSize:'11px', color:'#9CA3AF', lineHeight:1.4, margin:0, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                              {product.descripcion}
                            </p>
                          )}
                        </div>

                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                          <div>
                            <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'16px', color:brandColors.primary, lineHeight:1.2 }}>
                              {descuento > 0 ? formatRD(Math.round(product.precio * (1 - descuento/100))) : formatRD(product.precio)}
                            </div>
                            {descuento > 0 && (
                              <div style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:'11px', color:'#9CA3AF', textDecoration:'line-through', marginTop:'2px' }}>{formatRD(product.precio)}</div>
                            )}
                          </div>

                          {inCartQty > 0 ? (
                            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                              <button onClick={() => removeFromCart(product.id)} className="md-ripple"
                                style={{ width:'28px', height:'28px', borderRadius:'50%', border:`2px solid ${brandColors.primary}`, background:'white', color:brandColors.primary, fontSize:'16px', fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>−</button>
                              <span style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'14px', minWidth:'16px', textAlign:'center', animation: justAdded ? 'popIn 0.3s ease' : 'none' }}>{inCartQty}</span>
                              <button onClick={(e) => { createRipple(e); setModifierProduct(product) }} className="md-ripple"
                                style={{ width:'28px', height:'28px', borderRadius:'50%', border:'none', background:brandColors.primary, color:'white', fontSize:'16px', fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', boxShadow:`0 2px 8px ${brandColors.primary}40` }}>+</button>
                            </div>
                          ) : (
                            <button onClick={(e) => { createRipple(e); setModifierProduct(product) }} className="md-ripple"
                              style={{ width:'34px', height:'34px', borderRadius:'50%', border:'none', background:brandColors.primary, color:'white', fontSize:'22px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', boxShadow:`0 3px 10px ${brandColors.primary}45`, lineHeight:1 }}>+</button>
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

        {categories.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'#9CA3AF' }}>
            <p style={{ fontSize:'48px', marginBottom:'12px' }}>{marca === 'AREPA' ? '🫓' : '🍔'}</p>
            <p style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'18px', color:'#374151', marginBottom:'8px' }}>Menú en preparación</p>
            <p style={{ fontSize:'14px' }}>Pronto tendremos todo listo</p>
          </div>
        )}
      </main>

      {/* PUSH BANNER */}
      {showPushBanner && !pushGranted && (
        <div style={{ position:'fixed', bottom: cartCount > 0 ? '100px' : '24px', left:'16px', right:'16px', zIndex:35, background:'white', borderRadius:'16px', padding:'14px 16px', boxShadow:'0 4px 24px rgba(0,0,0,0.12)', display:'flex', alignItems:'center', gap:'12px', animation:'slideUp 0.3s ease' }}>
          <div style={{ fontSize:'24px' }}>🔔</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:'13px', fontWeight:800, color:'#1A1A1A' }}>Activa las notificaciones</div>
            <div style={{ fontSize:'11px', color:'#9CA3AF', marginTop:'1px' }}>Entérate de ofertas y el estado de tu pedido</div>
          </div>
          <button onClick={async () => { await subscribePush(); setShowPushBanner(false) }}
            style={{ padding:'8px 14px', borderRadius:'999px', border:'none', background:brandColors.primary, color:'white', fontSize:'12px', fontWeight:700, cursor:'pointer', flexShrink:0 }}>
            Activar
          </button>
          <button onClick={() => setShowPushBanner(false)}
            style={{ width:'24px', height:'24px', borderRadius:'50%', border:'none', background:'#F3F4F6', color:'#9CA3AF', fontSize:'14px', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>
      )}

      {/* PRODUCT PREVIEW MODAL */}
      {previewProduct && (
        <ProductPreviewModal
          product={previewProduct}
          brandColor={brandColors.primary}
          marca={marca}
          inCartQty={cart.items.find(i => i.product.id === previewProduct.id)?.cantidad || 0}
          onClose={() => setPreviewProduct(null)}
          onAddToCart={() => {
            setPreviewProduct(null)
            setModifierProduct(previewProduct)
          }}
          onRemoveFromCart={() => removeFromCart(previewProduct.id)}
        />
      )}

      {/* MODIFIER MODAL */}
      {modifierProduct && (
        <ModifierModal product={modifierProduct} brandColor={brandColors.primary}
          onConfirm={(modifiers, totalExtras, notas) => { addToCart(modifierProduct, modifiers, totalExtras, notas || ''); setModifierProduct(null) }}
          onClose={() => setModifierProduct(null)} />
      )}

      {/* CART FAB */}
      {cartCount > 0 && (
        <div style={{ position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)', zIndex:40, width:'100%', maxWidth:'420px', padding:'0 16px', animation:'slideUp 0.3s ease' }}>
          <button onClick={() => router.push('/cart')} className="md-ripple"
            style={{ width:'100%', padding:'18px 24px', borderRadius:'20px', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', background:`linear-gradient(135deg, ${brandColors.primary}, ${brandColors.secondary})`, boxShadow:`0 8px 32px ${brandColors.primary}50`, position:'relative' }}>
            <span style={{ background:'rgba(255,255,255,0.2)', borderRadius:'999px', padding:'4px 12px', fontSize:'14px', fontWeight:800, color:'white' }}>{cartCount}</span>
            <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'15px', color:'white' }}>Ver carrito</span>
            <span style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'16px', color:'white' }}>{formatRD(cartSubtotal)}</span>
          </button>
        </div>
      )}
    </div>
  )
}
