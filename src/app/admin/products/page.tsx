'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Product, Category, Marca } from '@/types'

const supabase = createClient()

function formatRD(n: number) { return `RD$${n.toLocaleString('es-DO')}` }

interface ProductFormData {
  nombre: string
  descripcion: string
  precio: string
  category_id: string
  activo: boolean
  foto_url: string
}

const EMPTY_FORM: ProductFormData = { nombre: '', descripcion: '', precio: '', category_id: '', activo: true, foto_url: '' }

export default function AdminProductsPage() {
  const [marcaFilter, setMarcaFilter] = useState<Marca>('AREPA')
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [activeCatId, setActiveCatId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [showProductForm, setShowProductForm] = useState(false)
  const [showCatForm, setShowCatForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [productForm, setProductForm] = useState<ProductFormData>(EMPTY_FORM)
  const [catForm, setCatForm] = useState({ nombre: '', descripcion: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => { load(marcaFilter) }, [marcaFilter])

  async function load(marca: Marca) {
    setLoading(true)
    const [{ data: cats }, { data: prods }] = await Promise.all([
      supabase.from('categories').select('*').eq('marca', marca).order('orden'),
      supabase.from('products').select('*').eq('marca', marca).order('orden_en_categoria'),
    ])
    const c = cats || []
    setCategories(c)
    setProducts(prods || [])
    setActiveCatId(c[0]?.id || '')
    setLoading(false)
  }

  // ---- CATEGORY CRUD ----

  async function saveCategory() {
    if (!catForm.nombre.trim()) { setError('Escribe un nombre'); return }
    setSaving(true); setError('')
    if (editingCat) {
      await supabase.from('categories').update({ nombre: catForm.nombre, descripcion: catForm.descripcion }).eq('id', editingCat.id)
    } else {
      const maxOrden = Math.max(0, ...categories.map(c => c.orden))
      await supabase.from('categories').insert({ nombre: catForm.nombre, descripcion: catForm.descripcion, marca: marcaFilter, orden: maxOrden + 1, activo: true })
    }
    await load(marcaFilter)
    setShowCatForm(false); setEditingCat(null); setCatForm({ nombre: '', descripcion: '' })
    setSaving(false)
  }

  async function deleteCategory(cat: Category) {
    const count = products.filter(p => p.category_id === cat.id).length
    if (count > 0) { alert(`Esta categoría tiene ${count} productos. Muévelos primero.`); return }
    if (!confirm(`¿Eliminar categoría "${cat.nombre}"?`)) return
    await supabase.from('categories').delete().eq('id', cat.id)
    await load(marcaFilter)
  }

  async function toggleCategory(cat: Category) {
    await supabase.from('categories').update({ activo: !cat.activo }).eq('id', cat.id)
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, activo: !c.activo } : c))
  }

  async function moveCategoryOrder(cat: Category, dir: -1 | 1) {
    const idx = categories.findIndex(c => c.id === cat.id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= categories.length) return
    const swap = categories[swapIdx]
    await Promise.all([
      supabase.from('categories').update({ orden: swap.orden }).eq('id', cat.id),
      supabase.from('categories').update({ orden: cat.orden }).eq('id', swap.id),
    ])
    await load(marcaFilter)
  }

  // ---- PRODUCT CRUD ----

  async function saveProduct() {
    if (!productForm.nombre.trim() || !productForm.precio || !productForm.category_id) {
      setError('Nombre, precio y categoría son requeridos'); return
    }
    setSaving(true); setError('')
    const payload = {
      nombre: productForm.nombre.trim(),
      descripcion: productForm.descripcion.trim() || null,
      precio: parseFloat(productForm.precio),
      category_id: productForm.category_id,
      marca: marcaFilter,
      activo: productForm.activo,
      foto_url: productForm.foto_url || null,
    }
    if (editingProduct) {
      await supabase.from('products').update(payload).eq('id', editingProduct.id)
    } else {
      const catProds = products.filter(p => p.category_id === productForm.category_id)
      const maxOrden = Math.max(0, ...catProds.map(p => p.orden_en_categoria))
      await supabase.from('products').insert({ ...payload, orden_en_categoria: maxOrden + 1 })
    }
    await load(marcaFilter)
    setShowProductForm(false); setEditingProduct(null); setProductForm(EMPTY_FORM)
    setSaving(false)
  }

  async function deleteProduct(product: Product) {
    if (!confirm(`¿Eliminar "${product.nombre}"?`)) return
    await supabase.from('products').delete().eq('id', product.id)
    setProducts(prev => prev.filter(p => p.id !== product.id))
  }

  async function toggleProduct(product: Product) {
    await supabase.from('products').update({ activo: !product.activo }).eq('id', product.id)
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, activo: !p.activo } : p))
  }

  async function uploadPhoto(file: File, productId?: string): Promise<string> {
    setUploading(true)
    // Upload to Supabase Storage → serve via Cloudinary transform URL
    const ext = file.name.split('.').pop()
    const path = `products/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('product-photos').upload(path, file, { upsert: true })
    if (error) { setUploading(false); throw error }
    const { data } = supabase.storage.from('product-photos').getPublicUrl(path)
    setUploading(false)
    return data.publicUrl
  }

  function openEditProduct(product: Product) {
    setEditingProduct(product)
    setProductForm({
      nombre: product.nombre,
      descripcion: product.descripcion || '',
      precio: String(product.precio),
      category_id: product.category_id,
      activo: product.activo,
      foto_url: product.foto_url || '',
    })
    setShowProductForm(true)
  }

  function openEditCat(cat: Category) {
    setEditingCat(cat)
    setCatForm({ nombre: cat.nombre, descripcion: cat.descripcion || '' })
    setShowCatForm(true)
  }

  const catProducts = products.filter(p => p.category_id === activeCatId)
  const brandColor = marcaFilter === 'AREPA' ? '#C41E3A' : '#0052CC'

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <h1 className="font-black text-lg" style={{ fontFamily: 'Syne, serif' }}>📦 Gestión de Menú</h1>
          <div className="flex gap-2">
            {(['AREPA', 'SMASH'] as Marca[]).map(m => (
              <button key={m} onClick={() => setMarcaFilter(m)}
                className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
                style={marcaFilter === m ? { background: brandColor, color: '#fff' } : { background: '#F3F4F6', color: '#6B7280' }}>
                {m === 'AREPA' ? '🫓 Arepa' : '🍔 Smash'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* LEFT: Categories */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-gray-700">CATEGORÍAS</h2>
            <button onClick={() => { setShowCatForm(true); setEditingCat(null); setCatForm({ nombre: '', descripcion: '' }) }}
              className="text-sm font-bold px-3 py-1.5 rounded-xl text-white"
              style={{ background: brandColor }}>+ Nueva</button>
          </div>

          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="space-y-2">
              {categories.map((cat, idx) => (
                <div key={cat.id}
                  onClick={() => setActiveCatId(cat.id)}
                  className={`bg-white rounded-xl border-2 p-3 cursor-pointer transition-all ${activeCatId === cat.id ? 'shadow-sm' : 'border-gray-100 hover:border-gray-200'} ${!cat.activo ? 'opacity-50' : ''}`}
                  style={activeCatId === cat.id ? { borderColor: brandColor } : {}}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{cat.nombre}</p>
                      <p className="text-xs text-gray-400">{products.filter(p => p.category_id === cat.id).length} productos</p>
                    </div>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => moveCategoryOrder(cat, -1)} disabled={idx === 0} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs">↑</button>
                      <button onClick={() => moveCategoryOrder(cat, 1)} disabled={idx === categories.length - 1} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs">↓</button>
                      <button onClick={() => toggleCategory(cat)} className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cat.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {cat.activo ? 'ON' : 'OFF'}
                      </button>
                      <button onClick={() => openEditCat(cat)} className="p-1 text-gray-400 hover:text-blue-500 text-xs">✏️</button>
                      <button onClick={() => deleteCategory(cat)} className="p-1 text-gray-400 hover:text-red-500 text-xs">🗑</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: Products in selected category */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-gray-700">
              {categories.find(c => c.id === activeCatId)?.nombre || 'Selecciona categoría'} — {catProducts.length} productos
            </h2>
            {activeCatId && (
              <button
                onClick={() => { setShowProductForm(true); setEditingProduct(null); setProductForm({ ...EMPTY_FORM, category_id: activeCatId }) }}
                className="text-sm font-bold px-3 py-1.5 rounded-xl text-white"
                style={{ background: brandColor }}>+ Producto</button>
            )}
          </div>

          <div className="space-y-2">
            {catProducts.map(product => (
              <div key={product.id} className={`bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3 ${!product.activo ? 'opacity-60' : ''}`}>
                {product.foto_url
                  ? <img src={product.foto_url} alt={product.nombre} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                  : <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center text-xl shrink-0">📷</div>
                }
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-900 truncate">{product.nombre}</p>
                  {product.descripcion && <p className="text-xs text-gray-400 truncate">{product.descripcion}</p>}
                  <p className="font-black text-sm mt-0.5" style={{ color: brandColor }}>{formatRD(product.precio)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleProduct(product)}
                    className={`text-xs px-2 py-1 rounded-full font-semibold ${product.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {product.activo ? 'ON' : 'OFF'}
                  </button>
                  <button onClick={() => openEditProduct(product)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs hover:bg-blue-100 transition-colors">✏️ Editar</button>
                  <button onClick={() => deleteProduct(product)} className="p-1.5 bg-red-50 text-red-500 rounded-lg text-xs hover:bg-red-100 transition-colors">🗑</button>
                </div>
              </div>
            ))}

            {!loading && catProducts.length === 0 && activeCatId && (
              <div className="text-center py-10 text-gray-400">
                <p className="text-3xl mb-2">📦</p>
                <p>No hay productos en esta categoría</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PRODUCT FORM MODAL */}
      {showProductForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-black" style={{ fontFamily: 'Syne, serif' }}>
                {editingProduct ? 'Editar producto' : 'Nuevo producto'}
              </h2>
              <button onClick={() => { setShowProductForm(false); setEditingProduct(null) }} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <div className="p-4 space-y-3">
              {[
                { label: 'Nombre *', key: 'nombre', placeholder: 'Ej: Arepa Pollo y Queso Gouda' },
                { label: 'Descripción', key: 'descripcion', placeholder: 'Descripción breve...' },
                { label: 'Precio (RD$) *', key: 'precio', placeholder: '295', type: 'number' },
              ].map(field => (
                <div key={field.key} className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">{field.label}</label>
                  <input
                    type={field.type || 'text'}
                    placeholder={field.placeholder}
                    value={(productForm as any)[field.key]}
                    onChange={e => setProductForm(f => ({ ...f, [field.key]: e.target.value }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors"
                  />
                </div>
              ))}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Categoría *</label>
                <select value={productForm.category_id}
                  onChange={e => setProductForm(f => ({ ...f, category_id: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors">
                  <option value="">Seleccionar...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Foto</label>
                <div className="flex items-center gap-3">
                  {productForm.foto_url && (
                    <img src={productForm.foto_url} alt="" className="w-16 h-16 rounded-xl object-cover" />
                  )}
                  <label className="flex-1 border-2 border-dashed border-gray-200 rounded-xl p-3 text-center text-sm text-gray-400 cursor-pointer hover:border-gray-400 transition-colors">
                    {uploading ? '⏳ Subiendo...' : '📷 Subir foto'}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={async e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const url = await uploadPhoto(file)
                        setProductForm(f => ({ ...f, foto_url: url }))
                      }} />
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm font-semibold text-gray-700">Activo</label>
                <input type="checkbox" checked={productForm.activo}
                  onChange={e => setProductForm(f => ({ ...f, activo: e.target.checked }))}
                  className="w-4 h-4" />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button onClick={saveProduct} disabled={saving}
                className="w-full py-3.5 rounded-xl text-white font-bold disabled:opacity-50 transition-all"
                style={{ background: brandColor }}>
                {saving ? 'Guardando...' : editingProduct ? 'Guardar cambios' : 'Crear producto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY FORM MODAL */}
      {showCatForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-black" style={{ fontFamily: 'Syne, serif' }}>
                {editingCat ? 'Editar categoría' : 'Nueva categoría'}
              </h2>
              <button onClick={() => { setShowCatForm(false); setEditingCat(null) }} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Nombre *</label>
                <input placeholder="Ej: COMBOS ESPECIALES" value={catForm.nombre}
                  onChange={e => setCatForm(f => ({ ...f, nombre: e.target.value.toUpperCase() }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Descripción (opcional)</label>
                <input placeholder="Descripción breve..." value={catForm.descripcion}
                  onChange={e => setCatForm(f => ({ ...f, descripcion: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors" />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button onClick={saveCategory} disabled={saving}
                className="w-full py-3.5 rounded-xl text-white font-bold disabled:opacity-50"
                style={{ background: brandColor }}>
                {saving ? 'Guardando...' : editingCat ? 'Guardar' : 'Crear categoría'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
