'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

const ESTADOS = [
  { key: 'PAGADO',           label: 'Confirmado',   icon: '✅' },
  { key: 'EN_COCINA',        label: 'En cocina',     icon: '🍳' },
  { key: 'LISTO',            label: 'Listo',         icon: '✓'  },
  { key: 'ENVIO_SOLICITADO', label: 'Repartidor',    icon: '📍' },
  { key: 'EN_CAMINO',        label: 'En camino',     icon: '🛵' },
  { key: 'ENTREGADO',        label: 'Entregado',     icon: '🎉' },
]

const ESTADO_ICONS: Record<string,string> = {
  PENDIENTE:'⏳', PAGADO:'✅', EN_COCINA:'🍳', LISTO:'✓',
  ENVIO_SOLICITADO:'📍', EN_CAMINO:'🛵', ENTREGADO:'🎉', CANCELADO:'❌'
}
const ESTADO_LABELS: Record<string,string> = {
  PENDIENTE:'Esperando aprobación', PAGADO:'Confirmado', EN_COCINA:'En cocina',
  LISTO:'Listo para envío', ENVIO_SOLICITADO:'Buscando repartidor',
  EN_CAMINO:'En camino', ENTREGADO:'Entregado', CANCELADO:'Cancelado'
}

function formatRD(n: number) { return 'RD$' + (n||0).toLocaleString('es-DO') }

export default function OrderBanner() {
  const router = useRouter()
  const pathname = usePathname()
  const [activeOrder, setActiveOrder] = useState<any>(null)
  const [orderDetail, setOrderDetail] = useState<any>(null)
  const [expanded, setExpanded] = useState(false)
  const intervalRef = useRef<any>(null)

  // Ocultar en checkout y en la página del pedido activo
  const isHidden = pathname?.startsWith('/checkout') || pathname?.startsWith('/auth') ||
    pathname?.startsWith('/admin') || (activeOrder && pathname === '/orders/' + activeOrder.id)

  useEffect(() => {
    checkActiveOrder()
    // Escuchar cambios de localStorage desde otras páginas
    window.addEventListener('storage', checkActiveOrder)
    window.addEventListener('lovers_order_updated', checkActiveOrder)
    return () => {
      window.removeEventListener('storage', checkActiveOrder)
      window.removeEventListener('lovers_order_updated', checkActiveOrder)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  function checkActiveOrder() {
    try {
      const stored = localStorage.getItem('lovers_active_order')
      if (!stored) { setActiveOrder(null); setOrderDetail(null); return }
      const order = JSON.parse(stored)
      if (order.estado === 'ENTREGADO' || order.estado === 'CANCELADO') {
        localStorage.removeItem('lovers_active_order')
        setActiveOrder(null); setOrderDetail(null); return
      }
      setActiveOrder(order)
      startPolling(order.id)
    } catch { setActiveOrder(null) }
  }

  function startPolling(orderId: string) {
    if (intervalRef.current) clearInterval(intervalRef.current)
    fetchOrder(orderId)
    intervalRef.current = setInterval(() => fetchOrder(orderId), 10000)
  }

  async function fetchOrder(orderId: string) {
    const { data } = await supabase.from('orders')
      .select('id, numero_pedido, estado, marca, total_pagado, items:order_items(cantidad, product:products(nombre))')
      .eq('id', orderId).single()
    if (!data) return
    setOrderDetail(data)
    // Actualizar localStorage con nuevo estado
    const stored = localStorage.getItem('lovers_active_order')
    if (stored) {
      const current = JSON.parse(stored)
      const updated = { ...current, estado: data.estado }
      localStorage.setItem('lovers_active_order', JSON.stringify(updated))
      setActiveOrder(updated)
    }
    // Auto-limpiar si terminó
    if (data.estado === 'ENTREGADO' || data.estado === 'CANCELADO') {
      setTimeout(() => {
        localStorage.removeItem('lovers_active_order')
        setActiveOrder(null); setOrderDetail(null)
        if (intervalRef.current) clearInterval(intervalRef.current)
      }, 5000)
    }
  }

  if (!activeOrder || isHidden) return null

  const brandColor = activeOrder.marca === 'SMASH' ? '#0052CC' : '#C41E3A'
  const estado = activeOrder.estado || 'PENDIENTE'
  const statusIdx = ESTADOS.findIndex(e => e.key === estado)
  const isPending = estado === 'PENDIENTE'

  return (
    <>
      <style>{`
        @keyframes pill-pulse { 0%,100%{box-shadow:0 4px 20px ${brandColor}50} 50%{box-shadow:0 4px 28px ${brandColor}80} }
        @keyframes slide-up { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes bounce-sm { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
      `}</style>

      {/* PILL FLOTANTE */}
      {!expanded && (
        <button onClick={() => setExpanded(true)}
          style={{ position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)', zIndex:999, border:'none', cursor:'pointer', background:brandColor, borderRadius:'999px', padding:'10px 18px', display:'flex', alignItems:'center', gap:'10px', boxShadow:'0 4px 20px ' + brandColor + '60', animation:'pill-pulse 2s ease-in-out infinite', maxWidth:'320px', width:'calc(100% - 32px)' }}>
          <span style={{ fontSize:'18px', animation:'bounce-sm 1.5s ease-in-out infinite' }}>
            {ESTADO_ICONS[estado] || '🛵'}
          </span>
          <div style={{ flex:1, textAlign:'left' }}>
            <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'13px', color:'white', margin:0 }}>
              Pedido #{activeOrder.numero}
            </p>
            <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.8)', margin:0 }}>
              {ESTADO_LABELS[estado]} · Toca para ver
            </p>
          </div>
          <span style={{ fontSize:'16px', color:'rgba(255,255,255,0.7)' }}>›</span>
        </button>
      )}

      {/* SHEET EXPANDIDO */}
      {expanded && (
        <>
          {/* Overlay */}
          <div onClick={() => setExpanded(false)}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:998, backdropFilter:'blur(2px)' }} />

          {/* Sheet */}
          <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:999, background:'white', borderRadius:'24px 24px 0 0', padding:'0 0 32px', maxHeight:'85dvh', overflowY:'auto', animation:'slide-up 0.3s ease', fontFamily:'var(--font-body)' }}>

            {/* Handle */}
            <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 4px' }}>
              <div style={{ width:'40px', height:'4px', borderRadius:'2px', background:'#E4E6EA' }} />
            </div>

            {/* Header del sheet */}
            <div style={{ padding:'12px 20px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid #F3F4F6' }}>
              <div>
                <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'18px', margin:'0 0 2px', color:'#0D0F12' }}>
                  Pedido #{activeOrder.numero}
                </p>
                <p style={{ fontSize:'12px', color:'#9CA3AF', margin:0 }}>
                  {activeOrder.marca === 'AREPA' ? '🫓 Arepa Lovers' : '🍔 Smash Lovers'}
                </p>
              </div>
              <button onClick={() => setExpanded(false)}
                style={{ width:'32px', height:'32px', borderRadius:'50%', border:'none', background:'#F3F4F6', cursor:'pointer', fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>

            <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:'14px' }}>

              {/* Estado actual */}
              {isPending ? (
                <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:'16px', padding:'20px', textAlign:'center' }}>
                  <div style={{ fontSize:'40px', marginBottom:'8px' }}>⏳</div>
                  <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'18px', color:'#92400E', margin:'0 0 6px' }}>Esperando aprobación</p>
                  <p style={{ fontSize:'13px', color:'#B45309', margin:0 }}>Verificando tu comprobante. Te avisamos por WhatsApp.</p>
                </div>
              ) : (
                <div style={{ background:'white', border:'1px solid #F3F4F6', borderRadius:'16px', padding:'18px' }}>
                  <div style={{ textAlign:'center', marginBottom:'16px' }}>
                    <div style={{ fontSize:'40px', marginBottom:'6px' }}>{ESTADO_ICONS[estado]}</div>
                    <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'18px', color:brandColor, margin:'0 0 4px' }}>{ESTADO_LABELS[estado]}</p>
                  </div>
                  {/* Barra de progreso */}
                  <div style={{ position:'relative', display:'flex', justifyContent:'space-between', alignItems:'flex-start', paddingTop:'4px' }}>
                    <div style={{ position:'absolute', top:'19px', left:'5%', right:'5%', height:'2px', background:'#F0F2F5', zIndex:0 }} />
                    <div style={{ position:'absolute', top:'19px', left:'5%', height:'2px', background:brandColor, zIndex:0, transition:'width 0.5s', width: statusIdx >= 0 ? `${(statusIdx/(ESTADOS.length-1))*90}%` : '0%' }} />
                    {ESTADOS.map((e, idx) => (
                      <div key={e.key} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', flex:1, position:'relative', zIndex:1 }}>
                        <div style={{ width:'26px', height:'26px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', background:idx<=statusIdx?brandColor:'white', color:idx<=statusIdx?'white':'#9CA3AF', border:`2px solid ${idx<=statusIdx?brandColor:'#E4E6EA'}` }}>
                          {idx < statusIdx ? '✓' : e.icon}
                        </div>
                        <span style={{ fontSize:'8px', fontWeight:600, color:idx<=statusIdx?brandColor:'#9CA3AF', textAlign:'center', maxWidth:'36px', lineHeight:1.2 }}>{e.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Items del pedido */}
              {orderDetail?.items && orderDetail.items.length > 0 && (
                <div style={{ background:'#F7F8FA', borderRadius:'14px', padding:'14px 16px' }}>
                  <p style={{ fontWeight:700, fontSize:'13px', color:'#6B7280', margin:'0 0 10px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Tu pedido</p>
                  {orderDetail.items.map((item: any, i: number) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', color:'#374151', padding:'3px 0' }}>
                      <span>{item.cantidad}× {item.product?.nombre}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Botones */}
              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={() => { setExpanded(false); router.push('/orders/' + activeOrder.id) }}
                  style={{ flex:1, padding:'14px', borderRadius:'14px', border:'none', background:brandColor, color:'white', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'14px', cursor:'pointer' }}>
                  Ver detalle completo →
                </button>
                <button onClick={() => setExpanded(false)}
                  style={{ padding:'14px 16px', borderRadius:'14px', border:'1px solid #E4E6EA', background:'white', color:'#6B7280', fontWeight:600, fontSize:'13px', cursor:'pointer' }}>
                  Cerrar
                </button>
              </div>

            </div>
          </div>
        </>
      )}
    </>
  )
}
