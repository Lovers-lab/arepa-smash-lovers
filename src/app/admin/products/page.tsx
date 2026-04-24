'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Product, Category, Marca } from '@/types'
import ModifierManager from '@/components/menu/ModifierManager'

const supabase = createClient()
function formatRD(n: number) { return `RD$${n.toLocaleString('es-DO')}` }

interface PForm { nombre: string; descripcion: string; precio: string; category_id: string; activo: boolean; foto_url: string; es_destacado: boolean; descuento_pct: string }
const EMPTY: PForm = { nombre: '', descripcion: '', precio: '', category_id: '', activo: true, foto_url: '', es_destacado: false, descuento_pct: '' }

function ripple(e: React.MouseEvent<HTMLButtonElement>, c = 'rgba(255,255,255,0.4)') {
  const b = e.currentTarget, d = Math.max(b.clientWidth, b.clientHeight)
  const r = b.getBoundingClientRect(), s = document.createElement('span')
  s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX-r.left-d/2}px;top:${e.clientY-r.top-d/2}px;position:absolute;border-radius:50%;background:${c};transform:scale(0);animation:rpl 0.5s linear;pointer-events:none;`
  b.appendChild(s); setTimeout(() => s.remove(), 600)
}

export default function AdminProductsPage() {
  const [marca, setMarca] = useState<Marca>('AREPA')
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [activeCatId, setActiveCatId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [showProductForm, setShowProductForm] = useState(false)
  const [showCatForm, setShowCatForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [pForm, setPForm] = useState<PForm>(EMPTY)
  const [catForm, setCatForm] = useState({ nombre: '', descripcion: '' })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [modifierProduct, setModifierProduct] = useState<Product | null>(null)

  const bc = marca === 'AREPA' ? '#C41E3A' : '#0052CC'

  useEffect(() => { load(marca) }, [marca])

  async function load(m: Marca) {
    setLoading(true)
    const [{ data: cats }, { data: prods }] = await Promise.all([
      supabase.from('categories').select('*').eq('marca', m).order('orden'),
      supabase.from('products').select('*').eq('marca', m).order('orden_en_categoria'),
    ])
    const c = cats || []
    setCategories(c); setProducts(prods || [])
    setActiveCatId(c[0]?.id || '')
    setLoading(false)
  }

  async function saveCategory() {
    if (!catForm.nombre.trim()) { setError('Escribe un nombre'); return }
    setSaving(true); setError('')
    if (editingCat) {
      await supabase.from('categories').update({ nombre: catForm.nombre, descripcion: catForm.descripcion }).eq('id', editingCat.id)
    } else {
      const max = Math.max(0, ...categories.map(c => c.orden))
      await supabase.from('categories').insert({ nombre: catForm.nombre, descripcion: catForm.descripcion, marca, orden: max + 1, activo: true })
    }
    await load(marca); setShowCatForm(false); setEditingCat(null); setCatForm({ nombre: '', descripcion: '' }); setSaving(false)
  }

  async function deleteCategory(cat: Category) {
    const count = products.filter(p => p.category_id === cat.id).length
    if (count > 0) { alert(`Esta categoría tiene ${count} productos. Muévelos primero.`); return }
    if (!confirm(`¿Eliminar "${cat.nombre}"?`)) return
    await supabase.from('categories').delete().eq('id', cat.id); await load(marca)
  }

  async function toggleCategory(cat: Category) {
    await supabase.from('categories').update({ activo: !cat.activo }).eq('id', cat.id)
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, activo: !c.activo } : c))
  }

  async function moveCat(cat: Category, dir: -1 | 1) {
    const idx = categories.findIndex(c => c.id === cat.id)
    const swap = categories[idx + dir]
    if (!swap) return
    await Promise.all([
      supabase.from('categories').update({ orden: swap.orden }).eq('id', cat.id),
      supabase.from('categories').update({ orden: cat.orden }).eq('id', swap.id),
    ]); await load(marca)
  }

  async function saveProduct() {
    if (!pForm.nombre.trim() || !pForm.precio || !pForm.category_id) { setError('Nombre, precio y categoría son requeridos'); return }
    setSaving(true); setError('')
    const payload = {
      nombre: pForm.nombre.trim(),
      descripcion: pForm.descripcion.trim() || null,
      precio: parseFloat(pForm.precio),
      category_id: pForm.category_id,
      marca,
      activo: pForm.activo,
      foto_url: pForm.foto_url || null,
      es_destacado: pForm.es_destacado,
      descuento_pct: pForm.descuento_pct ? parseFloat(pForm.descuento_pct) : 0,
    }
    if (editingProduct) {
      const { error: err } = await supabase.from('products').update(payload).eq('id', editingProduct.id)
      if (err) { setError('Error al guardar: ' + err.message); setSaving(false); return }
    } else {
      const catProds = products.filter(p => p.category_id === pForm.category_id)
      const max = Math.max(0, ...catProds.map(p => p.orden_en_categoria))
      const { error: err } = await supabase.from('products').insert({ ...payload, orden_en_categoria: max + 1 })
      if (err) { setError('Error al crear: ' + err.message); setSaving(false); return }
    }
    await load(marca); setShowProductForm(false); setEditingProduct(null); setPForm(EMPTY); setSaving(false)
  }

  async function deleteProduct(p: Product) {
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return
    await supabase.from('products').delete().eq('id', p.id)
    setProducts(prev => prev.filter(x => x.id !== p.id))
  }

  async function toggleProduct(p: Product) {
    await supabase.from('products').update({ activo: !p.activo }).eq('id', p.id)
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, activo: !x.activo } : x))
  }

  async function uploadPhoto(file: File): Promise<string> {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `products/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('product-photos').upload(path, file, { upsert: true })
    if (upErr) { setError('Error subiendo foto: ' + upErr.message); setUploading(false); return '' }
    const { data } = supabase.storage.from('product-photos').getPublicUrl(path)
    setUploading(false)
    return data.publicUrl
  }

  function openEdit(p: Product) {
    setEditingProduct(p)
    setPForm({
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      precio: String(p.precio),
      category_id: p.category_id,
      activo: p.activo,
      foto_url: p.foto_url || '',
      es_destacado: (p as any).es_destacado || false,
      descuento_pct: String((p as any).descuento_pct || ''),
    })
    setShowProductForm(true)
  }

  const catProducts = products.filter(p => p.category_id === activeCatId)
  const activeCat = categories.find(c => c.id === activeCatId)

  return (
    <div style={{ minHeight:'100dvh', background:'#F7F8FA', fontFamily:'var(--font-body)' }}>
      <style>{`@keyframes rpl{to{transform:scale(4);opacity:0}} .rpl{position:relative;overflow:hidden;}`}</style>

      <header style={{ background:'white', borderBottom:'1px solid #E4E6EA', position:'sticky', top:0, zIndex:20, boxShadow:'0 1px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
          <h1 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'20px', margin:0 }}>📦 Gestión de Menú</h1>
          <div style={{ display:'flex', gap:'8px' }}>
            {(['AREPA', 'SMASH'] as Marca[]).map(m => (
              <button key={m} onClick={(e) => { ripple(e, m==='AREPA'?'rgba(196,30,58,0.2)':'rgba(0,82,204,0.2)'); setMarca(m) }} className="rpl"
                style={{ padding:'9px 20px', borderRadius:'999px', border:'none', fontWeight:700, fontSize:'13px', cursor:'pointer', transition:'all 0.2s', position:'relative', background: marca===m ? (m==='AREPA'?'#C41E3A':'#0052CC') : '#F3F4F6', color: marca===m ? 'white' : '#6B7280', boxShadow: marca===m ? `0 2px 10px ${m==='AREPA'?'rgba(196,30,58,0.35)':'rgba(0,82,204,0.35)'}` : 'none' }}>
                {m === 'AREPA' ? '🫓 Arepa Lovers' : '🍔 Smash Lovers'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'16px', display:'grid', gridTemplateColumns:'260px 1fr', gap:'16px' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
            <span style={{ fontSize:'12px', fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.5px' }}>Categorías</span>
            <button onClick={() => { setShowCatForm(true); setEditingCat(null); setCatForm({ nombre:'', descripcion:'' }) }} className="rpl"
              style={{ padding:'7px 14px', borderRadius:'999px', border:'none', background:bc, color:'white', fontSize:'12px', fontWeight:700, cursor:'pointer', position:'relative' }}>+ Nueva</button>
          </div>
          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {[1,2,3].map(i => <div key={i} style={{ height:'64px', background:'white', borderRadius:'14px', opacity:0.6 }} />)}
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {categories.map((cat, idx) => (
                <div key={cat.id} onClick={() => setActiveCatId(cat.id)}
                  style={{ background:'white', borderRadius:'14px', border:`2px solid ${activeCatId===cat.id?bc:'#E4E6EA'}`, padding:'12px 14px', cursor:'pointer', transition:'all 0.2s', opacity:cat.activo?1:0.5, boxShadow: activeCatId===cat.id?`0 2px 10px ${bc}25`:'none' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <p style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'14px', margin:'0 0 2px', color: activeCatId===cat.id?bc:'#0D0F12' }}>{cat.nombre}</p>
                      <p style={{ fontSize:'11px', color:'#9CA3AF', margin:0 }}>{products.filter(p=>p.category_id===cat.id).length} productos</p>
                    </div>
                    <div style={{ display:'flex', gap:'4px', alignItems:'center' }} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>moveCat(cat,-1)} disabled={idx===0} style={{ width:'22px', height:'22px', background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', fontSize:'12px', opacity:idx===0?0.2:1 }}>↑</button>
                      <button onClick={()=>moveCat(cat,1)} disabled={idx===categories.length-1} style={{ width:'22px', height:'22px', background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', fontSize:'12px', opacity:idx===categories.length-1?0.2:1 }}>↓</button>
                      <button onClick={()=>toggleCategory(cat)} style={{ padding:'2px 8px', borderRadius:'999px', border:'none', fontSize:'10px', fontWeight:700, cursor:'pointer', background:cat.activo?'#DCFCE7':'#F3F4F6', color:cat.activo?'#15803D':'#9CA3AF' }}>{cat.activo?'ON':'OFF'}</button>
                      <button onClick={()=>{ setEditingCat(cat); setCatForm({nombre:cat.nombre,descripcion:cat.descripcion||''}); setShowCatForm(true) }} style={{ width:'24px', height:'24px', background:'#EFF6FF', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'11px' }}>✏️</button>
                      <button onClick={()=>deleteCategory(cat)} style={{ width:'24px', height:'24px', background:'#FEF2F2', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'11px' }}>🗑</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
            <div>
              <span style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'18px' }}>{activeCat?.nombre || 'Selecciona una categoría'}</span>
              <span style={{ fontSize:'13px', color:'#9CA3AF', marginLeft:'8px' }}>{catProducts.length} productos</span>
            </div>
            {activeCatId && (
              <button onClick={() => { setShowProductForm(true); setEditingProduct(null); setPForm({...EMPTY, category_id:activeCatId}) }} className="rpl"
                style={{ padding:'9px 20px', borderRadius:'999px', border:'none', background:bc, color:'white', fontSize:'13px', fontWeight:700, cursor:'pointer', position:'relative', boxShadow:`0 2px 10px ${bc}35` }}>
                + Producto
              </button>
            )}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:'12px' }}>
            {catProducts.map(product => (
              <div key={product.id}
                style={{ background:'white', borderRadius:'18px', border:'1px solid #E4E6EA', overflow:'hidden', opacity:product.activo?1:0.55, boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ position:'relative', height:'130px', background:'linear-gradient(135deg,#FEF3C7,#FDE68A)', overflow:'hidden' }}>
                  {product.foto_url
                    ? <img src={product.foto_url} alt={product.nombre} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'40px' }}>📷</div>
                  }
                  {(product as any).descuento_pct > 0 && (
                    <div style={{ position:'absolute', top:'8px', left:'8px', background:'#F59E0B', color:'white', fontSize:'10px', fontWeight:800, padding:'3px 8px', borderRadius:'999px' }}>-{(product as any).descuento_pct}%</div>
                  )}
                  {(product as any).es_destacado && (
                    <div style={{ position:'absolute', top:'8px', right:'8px', background:bc, color:'white', fontSize:'10px', fontWeight:800, padding:'3px 8px', borderRadius:'999px' }}>⭐ Top</div>
                  )}
                  <div style={{ position:'absolute', bottom:'8px', right:'8px' }}>
                    <button onClick={()=>toggleProduct(product)} style={{ padding:'4px 10px', borderRadius:'999px', border:'none', fontSize:'10px', fontWeight:800, cursor:'pointer', background:product.activo?'#DCFCE7':'rgba(0,0,0,0.5)', color:product.activo?'#15803D':'white' }}>
                      {product.activo?'ON':'OFF'}
                    </button>
                  </div>
                </div>
                <div style={{ padding:'12px' }}>
                  <p style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'14px', margin:'0 0 3px', lineHeight:1.3 }}>{product.nombre}</p>
                  {product.descripcion && <p style={{ fontSize:'11px', color:'#9CA3AF', margin:'0 0 8px', lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{product.descripcion}</p>}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
                    <span style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'16px', color:bc }}>{formatRD(product.precio)}</span>
                  </div>
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button onClick={()=>openEdit(product)} className="rpl"
                      style={{ flex:1, padding:'8px', borderRadius:'10px', border:'none', background:'#EFF6FF', color:'#1D4ED8', fontSize:'12px', fontWeight:700, cursor:'pointer', position:'relative' }}>✏️ Editar</button>
                    <button onClick={()=>setModifierProduct(product)} className="rpl"
                      style={{ flex:1, padding:'8px', borderRadius:'10px', border:'none', background:'#EDE9FE', color:'#7C3AED', fontSize:'12px', fontWeight:700, cursor:'pointer', position:'relative' }}>🎛️ Opciones</button>
                    <button onClick={()=>deleteProduct(product)} className="rpl"
                      style={{ width:'34px', padding:'8px', borderRadius:'10px', border:'none', background:'#FEF2F2', color:'#DC2626', fontSize:'12px', cursor:'pointer', position:'relative' }}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
            {!loading && catProducts.length === 0 && activeCatId && (
              <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'48px 20px', color:'#9CA3AF' }}>
                <p style={{ fontSize:'40px', marginBottom:'8px' }}>📦</p>
                <p style={{ fontWeight:600, fontSize:'15px' }}>No hay productos en esta categoría</p>
                <p style={{ fontSize:'13px', marginTop:'4px' }}>Clic en "+ Producto" para agregar</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showProductForm && (
        <div style={{ position:'fixed', inset:0, zIndex:50, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}
          onClick={e=>{ if(e.target===e.currentTarget){setShowProductForm(false);setEditingProduct(null)} }}>
          <div style={{ background:'white', borderRadius:'24px 24px 0 0', width:'100%', maxWidth:'480px', maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'20px', borderBottom:'1px solid #F3F4F6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <h2 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'18px', margin:0 }}>{editingProduct?'Editar producto':'Nuevo producto'}</h2>
              <button onClick={()=>{setShowProductForm(false);setEditingProduct(null)}} style={{ width:'32px', height:'32px', borderRadius:'50%', background:'#F3F4F6', border:'none', cursor:'pointer', fontSize:'18px', color:'#6B7280' }}>✕</button>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
              <div>
                <label style={{ fontSize:'12px', fontWeight:700, color:'#6B7280', display:'block', marginBottom:'8px' }}>Foto del producto</label>
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  {pForm.foto_url && <img src={pForm.foto_url} alt="" style={{ width:'72px', height:'72px', borderRadius:'14px', objectFit:'cover', flexShrink:0 }} />}
                  <label style={{ flex:1, border:`2px dashed ${pForm.foto_url?bc:'#E4E6EA'}`, borderRadius:'14px', padding:'16px', textAlign:'center', cursor:'pointer', fontSize:'13px', color: uploading?bc:'#9CA3AF', fontWeight: uploading?700:400 }}>
                    {uploading ? '⏳ Subiendo foto...' : pForm.foto_url ? '📷 Cambiar foto' : '📷 Subir foto'}
                    <input type="file" accept="image/*" style={{ display:'none' }} onChange={async e => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      const url = await uploadPhoto(f)
                      if (url) setPForm(p => ({ ...p, foto_url: url }))
                    }} />
                  </label>
                </div>
              </div>
              <div>
                <label style={{ fontSize:'12px', fontWeight:700, color:'#6B7280', display:'block', marginBottom:'6px' }}>Nombre *</label>
                <input placeholder="Ej: Arepa Pollo y Queso Gouda" value={pForm.nombre} onChange={e=>setPForm(p=>({...p,nombre:e.target.value}))}
                  style={{ width:'100%', border:'2px solid #E4E6EA', borderRadius:'12px', padding:'12px 14px', fontSize:'14px', outline:'none', fontFamily:'var(--font-body)', boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize:'12px', fontWeight:700, color:'#6B7280', display:'block', marginBottom:'6px' }}>Descripción</label>
                <textarea placeholder="Descripción breve del producto..." value={pForm.descripcion} onChange={e=>setPForm(p=>({...p,descripcion:e.target.value}))} rows={2}
                  style={{ width:'100%', border:'2px solid #E4E6EA', borderRadius:'12px', padding:'12px 14px', fontSize:'14px', outline:'none', resize:'none', fontFamily:'var(--font-body)', boxSizing:'border-box' }} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <div>
                  <label style={{ fontSize:'12px', fontWeight:700, color:'#6B7280', display:'block', marginBottom:'6px' }}>Precio (RD$) *</label>
                  <input type="number" placeholder="295" value={pForm.precio} onChange={e=>setPForm(p=>({...p,precio:e.target.value}))}
                    style={{ width:'100%', border:'2px solid #E4E6EA', borderRadius:'12px', padding:'12px 14px', fontSize:'14px', outline:'none', fontFamily:'var(--font-body)', boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize:'12px', fontWeight:700, color:'#6B7280', display:'block', marginBottom:'6px' }}>Descuento % (opcional)</label>
                  <input type="number" placeholder="20" min="0" max="100" value={pForm.descuento_pct} onChange={e=>setPForm(p=>({...p,descuento_pct:e.target.value}))}
                    style={{ width:'100%', border:'2px solid #E4E6EA', borderRadius:'12px', padding:'12px 14px', fontSize:'14px', outline:'none', fontFamily:'var(--font-body)', boxSizing:'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize:'12px', fontWeight:700, color:'#6B7280', display:'block', marginBottom:'6px' }}>Categoría *</label>
                <select value={pForm.category_id} onChange={e=>setPForm(p=>({...p,category_id:e.target.value}))}
                  style={{ width:'100%', border:'2px solid #E4E6EA', borderRadius:'12px', padding:'12px 14px', fontSize:'14px', outline:'none', background:'white', fontFamily:'var(--font-body)', boxSizing:'border-box' }}>
                  <option value="">Seleccionar...</option>
                  {categories.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div style={{ display:'flex', gap:'12px' }}>
                {[{key:'activo',label:'Activo'},{key:'es_destacado',label:'⭐ Destacado'}].map(sw=>(
                  <div key={sw.key} style={{ display:'flex', alignItems:'center', gap:'8px', background:'#F7F8FA', borderRadius:'12px', padding:'10px 14px', flex:1 }}>
                    <span style={{ fontSize:'13px', fontWeight:600, color:'#374151', flex:1 }}>{sw.label}</span>
                    <button onClick={()=>setPForm(p=>({...p,[sw.key]:!(p as any)[sw.key]}))}
                      style={{ width:'44px', height:'24px', borderRadius:'999px', border:'none', cursor:'pointer', background:(pForm as any)[sw.key]?bc:'#E5E7EB', position:'relative', transition:'background 0.2s' }}>
                      <span style={{ position:'absolute', top:'2px', left:(pForm as any)[sw.key]?'22px':'2px', width:'20px', height:'20px', borderRadius:'50%', background:'white', boxShadow:'0 1px 4px rgba(0,0,0,0.2)', transition:'left 0.2s', display:'block' }} />
                    </button>
                  </div>
                ))}
              </div>
              {error && <p style={{ color:'#EF4444', fontSize:'13px', fontWeight:600, background:'#FEF2F2', padding:'10px 14px', borderRadius:'10px' }}>{error}</p>}
            </div>
            <div style={{ padding:'16px 20px', borderTop:'1px solid #F3F4F6' }}>
              <button onClick={saveProduct} disabled={saving} className="rpl"
                style={{ width:'100%', padding:'16px', borderRadius:'14px', border:'none', background:saving?'#E4E6EA':bc, color:saving?'#9CA3AF':'white', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'16px', cursor:saving?'not-allowed':'pointer', position:'relative' }}>
                {saving ? 'Guardando...' : editingProduct ? 'Guardar cambios' : 'Crear producto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modifierProduct && (
        <ModifierManager productId={modifierProduct.id} productName={modifierProduct.nombre} brandColor={bc} onClose={()=>setModifierProduct(null)} />
      )}

      {showCatForm && (
        <div style={{ position:'fixed', inset:0, zIndex:50, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}
          onClick={e=>{ if(e.target===e.currentTarget){setShowCatForm(false);setEditingCat(null)} }}>
          <div style={{ background:'white', borderRadius:'20px', width:'100%', maxWidth:'400px', overflow:'hidden' }}>
            <div style={{ padding:'20px', borderBottom:'1px solid #F3F4F6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <h2 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'18px', margin:0 }}>{editingCat?'Editar categoría':'Nueva categoría'}</h2>
              <button onClick={()=>{setShowCatForm(false);setEditingCat(null)}} style={{ width:'32px', height:'32px', borderRadius:'50%', background:'#F3F4F6', border:'none', cursor:'pointer', fontSize:'18px', color:'#6B7280' }}>✕</button>
            </div>
            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:'12px' }}>
              <div>
                <label style={{ fontSize:'12px', fontWeight:700, color:'#6B7280', display:'block', marginBottom:'6px' }}>Nombre *</label>
                <input placeholder="Ej: COMBOS ESPECIALES" value={catForm.nombre} onChange={e=>setCatForm(f=>({...f,nombre:e.target.value.toUpperCase()}))}
                  style={{ width:'100%', border:'2px solid #E4E6EA', borderRadius:'12px', padding:'12px 14px', fontSize:'14px', outline:'none', fontFamily:'var(--font-body)', boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize:'12px', fontWeight:700, color:'#6B7280', display:'block', marginBottom:'6px' }}>Descripción (opcional)</label>
                <input placeholder="Descripción breve..." value={catForm.descripcion} onChange={e=>setCatForm(f=>({...f,descripcion:e.target.value}))}
                  style={{ width:'100%', border:'2px solid #E4E6EA', borderRadius:'12px', padding:'12px 14px', fontSize:'14px', outline:'none', fontFamily:'var(--font-body)', boxSizing:'border-box' }} />
              </div>
              {error && <p style={{ color:'#EF4444', fontSize:'13px', fontWeight:600, background:'#FEF2F2', padding:'10px 14px', borderRadius:'10px' }}>{error}</p>}
              <button onClick={saveCategory} disabled={saving} className="rpl"
                style={{ width:'100%', padding:'14px', borderRadius:'14px', border:'none', background:saving?'#E4E6EA':bc, color:saving?'#9CA3AF':'white', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'15px', cursor:saving?'not-allowed':'pointer', position:'relative' }}>
                {saving ? 'Guardando...' : editingCat ? 'Guardar' : 'Crear categoría'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
