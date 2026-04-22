'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Marca = 'AREPA' | 'SMASH'

export default function HomePage() {
  const router = useRouter()
  const [user, setUser] = useState<{ nombre: string } | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('lovers_user')
    if (!stored) { router.replace('/auth/login'); return }
    setUser(JSON.parse(stored))
  }, [router])

  function selectMarca(marca: Marca) {
    const current = localStorage.getItem('lovers_marca') as Marca | null
    if (current && current !== marca) {
      const ok = confirm(`¿Cambiar a ${marca === 'AREPA' ? 'Arepa Lovers' : 'Smash Lovers'}? Se limpiará el carrito.`)
      if (!ok) return
      localStorage.removeItem('lovers_cart')
    }
    localStorage.setItem('lovers_marca', marca)
    router.push('/menu')
  }

  if (!user) return null

  return (
    <main style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F7F8FA', padding:'24px', fontFamily:'var(--font-body)' }}>
      <div style={{ width:'100%', maxWidth:'420px' }}>

        {/* Welcome */}
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <p style={{ fontSize:'13px', color:'#9CA3AF', fontWeight:500 }}>Bienvenido,</p>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'40px', fontWeight:800, color:'#0D0F12', margin:'4px 0 8px', letterSpacing:'-0.5px' }}>
            {user.nombre} 👋
          </h2>
          <p style={{ color:'#6B7280', fontSize:'15px' }}>¿Qué quieres comer hoy?</p>
        </div>

        {/* Arepa card */}
        <div onClick={() => selectMarca('AREPA')} style={{
          borderRadius:'28px', overflow:'hidden', cursor:'pointer', marginBottom:'14px',
          background:'linear-gradient(135deg, #C41E3A 0%, #E63946 100%)',
          boxShadow:'0 8px 32px rgba(196,30,58,0.35)',
          transition:'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s',
          position:'relative',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.02) translateY(-2px)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1) translateY(0)' }}
        >
          <div style={{ position:'absolute', width:'160px', height:'160px', borderRadius:'50%', background:'rgba(255,255,255,0.06)', top:'-40px', right:'-40px', pointerEvents:'none' }} />
          <div style={{ padding:'28px', display:'flex', alignItems:'center', gap:'18px' }}>
            <img src="/logos/logo-arepa.png" style={{ width:'72px', height:'72px', borderRadius:'20px', objectFit:'cover', flexShrink:0, boxShadow:'0 4px 16px rgba(0,0,0,0.2)' }} alt="Arepa Lovers" />
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:'var(--font-display)', fontSize:'26px', fontWeight:800, color:'white', letterSpacing:'-0.3px' }}>Arepa Lovers</div>
              <div style={{ color:'rgba(255,255,255,0.65)', fontSize:'13px', marginTop:'3px', fontWeight:500 }}>Comida venezolana auténtica</div>
              <div style={{ background:'rgba(255,255,255,0.15)', color:'white', fontSize:'11px', fontWeight:700, padding:'4px 10px', borderRadius:'999px', marginTop:'8px', display:'inline-block' }}>⭐ 4.8 · 1,199 pedidos</div>
            </div>
            <span style={{ color:'rgba(255,255,255,0.5)', fontSize:'28px' }}>›</span>
          </div>
        </div>

        {/* Smash card */}
        <div onClick={() => selectMarca('SMASH')} style={{
          borderRadius:'28px', overflow:'hidden', cursor:'pointer', marginBottom:'14px',
          background:'linear-gradient(135deg, #0052CC 0%, #0066FF 100%)',
          boxShadow:'0 8px 32px rgba(0,82,204,0.35)',
          transition:'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s',
          position:'relative',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.02) translateY(-2px)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1) translateY(0)' }}
        >
          <div style={{ position:'absolute', width:'160px', height:'160px', borderRadius:'50%', background:'rgba(255,255,255,0.06)', top:'-40px', right:'-40px', pointerEvents:'none' }} />
          <div style={{ padding:'28px', display:'flex', alignItems:'center', gap:'18px' }}>
            <img src="/logos/logo-smash.png" style={{ width:'72px', height:'72px', borderRadius:'20px', objectFit:'cover', flexShrink:0, boxShadow:'0 4px 16px rgba(0,0,0,0.2)' }} alt="Smash Lovers" />
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:'var(--font-display)', fontSize:'26px', fontWeight:800, color:'white', letterSpacing:'-0.3px' }}>Smash Lovers</div>
              <div style={{ color:'rgba(255,255,255,0.65)', fontSize:'13px', marginTop:'3px', fontWeight:500 }}>Smash burgers de autor</div>
              <div style={{ background:'rgba(255,255,255,0.15)', color:'white', fontSize:'11px', fontWeight:700, padding:'4px 10px', borderRadius:'999px', marginTop:'8px', display:'inline-block' }}>🆕 Nuevo · Lanzamiento</div>
            </div>
            <span style={{ color:'rgba(255,255,255,0.5)', fontSize:'28px' }}>›</span>
          </div>
        </div>

        <p style={{ textAlign:'center', fontSize:'12px', color:'#9CA3AF', marginTop:'16px' }}>
          💰 Gana Puntos Lovers con cada pedido · RD$10 = 1 punto
        </p>

        <button onClick={() => { localStorage.clear(); router.push('/auth/login') }}
          style={{ display:'block', margin:'16px auto 0', background:'none', border:'none', color:'#D1D5DB', fontSize:'12px', cursor:'pointer', fontFamily:'var(--font-body)' }}>
          Cerrar sesión
        </button>
      </div>
    </main>
  )
}
