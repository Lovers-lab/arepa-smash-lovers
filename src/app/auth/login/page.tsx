'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0,3)}-${digits.slice(3)}`
  return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [phone, setPhone] = useState('')
  const [nombre, setNombre] = useState('')
  const [step, setStep] = useState<'phone'|'name'>('phone')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handlePhone() {
    const digits = phone.replace(/\D/g, '')
    if (digits.length !== 10) { setError('Ingresa un número válido (ej: 809-555-1234)'); return }
    setError(''); setLoading(true)
    try {
      const { data, error: dbError } = await supabase.from('users').select('id,nombre,whatsapp').eq('whatsapp', digits).single()
      if (dbError && dbError.code !== 'PGRST116') throw dbError
      if (data) {
        localStorage.setItem('lovers_user', JSON.stringify({ id: data.id, nombre: data.nombre, whatsapp: data.whatsapp }))
        router.push('/')
      } else {
        setStep('name')
      }
    } catch { setError('Error de conexión. Intenta de nuevo.') }
    finally { setLoading(false) }
  }

  async function handleRegister() {
    if (nombre.trim().length < 2) { setError('Escribe tu nombre'); return }
    setError(''); setLoading(true)
    try {
      const digits = phone.replace(/\D/g, '')
      const { data, error: dbError } = await supabase.from('users').insert({
        whatsapp: digits, nombre: nombre.trim(), activo: true,
        cliente_vip: false, total_gastado: 0, total_compras: 0, dentro_zona: false
      }).select('id,nombre,whatsapp').single()
      if (dbError) throw dbError
      localStorage.setItem('lovers_user', JSON.stringify({ id: data.id, nombre: data.nombre, whatsapp: data.whatsapp }))
      router.push('/')
    } catch { setError('Error al registrar. Intenta de nuevo.') }
    finally { setLoading(false) }
  }

  return (
    <main style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #0D0F12 0%, #161820 60%, #1A0A10 100%)',
      padding: '24px', position: 'relative', overflow: 'hidden', fontFamily: 'var(--font-body)'
    }}>
      {/* Glow effects */}
      <div style={{ position:'absolute', width:'500px', height:'500px', background:'radial-gradient(circle, rgba(196,30,58,0.18) 0%, transparent 65%)', top:'-150px', right:'-150px', pointerEvents:'none' }} />
      <div style={{ position:'absolute', width:'350px', height:'350px', background:'radial-gradient(circle, rgba(0,82,204,0.12) 0%, transparent 65%)', bottom:'-100px', left:'-100px', pointerEvents:'none' }} />

      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:'380px' }}>

        {/* Logos */}
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'16px', marginBottom:'24px' }}>
            {/* Arepa Logo */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'8px', animation:'float 3s ease-in-out infinite' }}>
              <img src="/logos/logo-arepa.png" style={{ width:'110px', height:'110px', borderRadius:'22px', objectFit:'cover', boxShadow:'0 12px 40px rgba(196,30,58,0.45), 0 4px 12px rgba(0,0,0,0.3)', border:'2px solid rgba(255,255,255,0.1)' }} alt="Arepa Lovers" />
              <span style={{ color:'rgba(255,255,255,0.6)', fontSize:'10px', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase' }}>Arepa Lovers</span>
            </div>
            {/* Divider */}
            <div style={{ width:'1px', height:'70px', background:'linear-gradient(to bottom, transparent, rgba(255,255,255,0.15), transparent)' }} />
            {/* Smash Logo */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'8px', animation:'float 3s ease-in-out 0.6s infinite' }}>
              <img src="/logos/logo-smash.png" style={{ width:'110px', height:'110px', borderRadius:'22px', objectFit:'cover', boxShadow:'0 12px 40px rgba(0,82,204,0.45), 0 4px 12px rgba(0,0,0,0.3)', border:'2px solid rgba(255,255,255,0.1)' }} alt="Smash Lovers" />
              <span style={{ color:'rgba(255,255,255,0.6)', fontSize:'10px', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase' }}>Smash Lovers</span>
            </div>
          </div>

          {/* Promo pill */}
          <div style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'999px', padding:'10px 18px', marginBottom:'12px' }}>
            <span style={{ fontSize:'16px' }}>🎁</span>
            <span style={{ fontFamily:'var(--font-display)', fontSize:'13px', fontWeight:700, color:'white', lineHeight:1.3 }}>
              <span style={{ color:'#FCD34D' }}>Tequeños gratis</span> · primera compra Arepa<br/>
              <span style={{ color:'#FCD34D' }}>Papas gratis</span> · primera compra Smash
            </span>
          </div>
          <div style={{ color:'rgba(255,255,255,0.35)', fontSize:'12px', fontWeight:500 }}>📍 Santo Domingo, Distrito Nacional</div>
        </div>

        {/* Card */}
        <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'24px', padding:'28px', backdropFilter:'blur(20px)' }}>

          {step === 'phone' ? (
            <>
              <label style={{ fontSize:'11px', fontWeight:700, color:'rgba(255,255,255,0.35)', letterSpacing:'0.8px', textTransform:'uppercase', marginBottom:'8px', display:'block' }}>
                Tu número WhatsApp
              </label>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', background:'rgba(255,255,255,0.06)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:'14px', padding:'15px 18px', marginBottom:'20px' }}>
                <span style={{ fontSize:'20px' }}>🇩🇴</span>
                <span style={{ color:'rgba(255,255,255,0.4)', fontSize:'15px', fontWeight:500 }}>+1</span>
                <input type="tel" inputMode="numeric" placeholder="809-000-0000"
                  value={phone} onChange={e => setPhone(formatPhone(e.target.value))}
                  onKeyDown={e => e.key === 'Enter' && handlePhone()}
                  autoFocus
                  style={{ background:'none', border:'none', outline:'none', color:'white', fontFamily:'var(--font-body)', fontSize:'16px', fontWeight:500, width:'100%', letterSpacing:'0.5px' }}
                />
              </div>
              {error && <p style={{ color:'#F87171', fontSize:'13px', marginBottom:'12px' }}>{error}</p>}
              <button onClick={handlePhone} disabled={loading || phone.replace(/\D/g,'').length < 10}
                style={{ width:'100%', padding:'16px', background:'linear-gradient(135deg, #C41E3A, #E63946)', color:'white', border:'none', borderRadius:'14px', fontFamily:'var(--font-display)', fontSize:'16px', fontWeight:700, cursor:'pointer', opacity: loading || phone.replace(/\D/g,'').length < 10 ? 0.5 : 1, boxShadow:'0 4px 20px rgba(196,30,58,0.3)' }}>
                {loading ? 'Verificando...' : 'Continuar →'}
              </button>
            </>
          ) : (
            <>
              <div style={{ marginBottom:'16px' }}>
                <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.4)' }}>Tu número</p>
                <p style={{ color:'white', fontWeight:700, fontSize:'15px' }}>+1 {phone}</p>
              </div>
              <label style={{ fontSize:'11px', fontWeight:700, color:'rgba(255,255,255,0.35)', letterSpacing:'0.8px', textTransform:'uppercase', marginBottom:'8px', display:'block' }}>
                ¿Cómo te llamas?
              </label>
              <div style={{ display:'flex', alignItems:'center', background:'rgba(255,255,255,0.06)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:'14px', padding:'15px 18px', marginBottom:'20px' }}>
                <input type="text" placeholder="Tu nombre" value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRegister()}
                  autoFocus
                  style={{ background:'none', border:'none', outline:'none', color:'white', fontFamily:'var(--font-body)', fontSize:'16px', fontWeight:500, width:'100%' }}
                />
              </div>
              {error && <p style={{ color:'#F87171', fontSize:'13px', marginBottom:'12px' }}>{error}</p>}
              <button onClick={handleRegister} disabled={loading || nombre.trim().length < 2}
                style={{ width:'100%', padding:'16px', background:'linear-gradient(135deg, #C41E3A, #E63946)', color:'white', border:'none', borderRadius:'14px', fontFamily:'var(--font-display)', fontSize:'16px', fontWeight:700, cursor:'pointer', opacity: loading || nombre.trim().length < 2 ? 0.5 : 1, boxShadow:'0 4px 20px rgba(196,30,58,0.3)' }}>
                {loading ? 'Creando cuenta...' : '¡Comenzar a pedir! 🎉'}
              </button>
              <button onClick={() => { setStep('phone'); setError('') }} style={{ width:'100%', background:'none', border:'none', color:'rgba(255,255,255,0.3)', fontSize:'13px', marginTop:'12px', cursor:'pointer', fontFamily:'var(--font-body)' }}>
                ← Cambiar número
              </button>
            </>
          )}

          <p style={{ textAlign:'center', color:'rgba(255,255,255,0.2)', fontSize:'11px', marginTop:'16px', lineHeight:1.6 }}>
            Solo usamos tu WhatsApp para notificarte sobre tus pedidos.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </main>
  )
}
