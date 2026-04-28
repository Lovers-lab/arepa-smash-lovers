'use client'
export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0,3)}-${digits.slice(3)}`
  return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`
}

type Step = 'phone' | 'otp' | 'name'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [nombre, setNombre] = useState('')
  const [otp, setOtp] = useState(['', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [reviews, setReviews] = useState<any[]>([])
  const [avgScore, setAvgScore] = useState(0)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const timerRef = useRef<any>(null)

  useEffect(() => {
    loadReviews()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  async function loadReviews() {
    const { data } = await supabase
      .from('reviews')
      .select('nombre_cliente, estrellas, comentario, marca')
      .eq('visible', true)
      .not('comentario', 'is', null)
      .order('estrellas', { ascending: false })
      .limit(10)
    if (data && data.length > 0) {
      setReviews(data)
      setAvgScore(Math.round(data.reduce((a: number, r: any) => a + r.estrellas, 0) / data.length * 10) / 10)
    }
  }

  function startCountdown() {
    setCountdown(60)
    timerRef.current = setInterval(() => {
      setCountdown(p => { if (p <= 1) { clearInterval(timerRef.current); return 0 } return p - 1 })
    }, 1000)
  }

  async function handleSendOTP() {
    const digits = phone.replace(/\D/g, '')
    if (digits.length !== 10) { setError('Ingresa un número válido'); return }
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: digits }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error enviando el código'); return }
      setStep('otp'); startCountdown()
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } catch { setError('Error de conexión.') }
    finally { setLoading(false) }
  }

  async function handleResend() {
    if (countdown > 0) return
    setResending(true); setError('')
    try {
      const digits = phone.replace(/\D/g, '')
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: digits }),
      })
      if (!res.ok) { setError('Error reenviando'); return }
      setOtp(['', '', '', '']); startCountdown()
      otpRefs.current[0]?.focus()
    } catch { setError('Error de conexión.') }
    finally { setResending(false) }
  }

  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1)
    const newOtp = [...otp]; newOtp[index] = digit; setOtp(newOtp); setError('')
    if (digit && index < 3) otpRefs.current[index + 1]?.focus()
    if (digit && index === 3) {
      const fullCode = [...newOtp.slice(0, 3), digit].join('')
      if (fullCode.length === 4) verifyOTP(fullCode)
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus()
    if (e.key === 'Enter') { const code = otp.join(''); if (code.length === 4) verifyOTP(code) }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (pasted.length === 4) { setOtp(pasted.split('')); verifyOTP(pasted) }
  }

  async function verifyOTP(code: string) {
    setLoading(true); setError('')
    try {
      const digits = phone.replace(/\D/g, '')
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: digits, code }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Código incorrecto'); setLoading(false); return }
      if (data.isNewUser) { setStep('name') }
      else { localStorage.setItem('lovers_user', JSON.stringify(data.user)); router.push('/') }
    } catch { setError('Error de conexión.') }
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
    } catch { setError('Error al registrar.') }
    finally { setLoading(false) }
  }

  const phoneDigits = phone.replace(/\D/g, '')

  return (
    <main style={{
      minHeight: '100dvh',
      background: 'linear-gradient(175deg, #B01830 0%, #C41E3A 40%, #1A0A10 100%)',
      fontFamily: 'var(--font-body)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes floatA { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-8px) rotate(-2deg)} }
        @keyframes floatB { 0%,100%{transform:translateY(0) rotate(2deg)} 50%{transform:translateY(-8px) rotate(2deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.7} }
        .otp-box:focus { border-color: #FFD700 !important; background: rgba(255,215,0,0.15) !important; transform: scale(1.05); }
        input::placeholder { color: rgba(255,255,255,0.4); }
      `}</style>

      {/* Background decorations */}
      <div style={{ position:'absolute', width:'400px', height:'400px', borderRadius:'50%', background:'rgba(255,255,255,0.03)', top:'-100px', right:'-100px', pointerEvents:'none' }} />
      <div style={{ position:'absolute', width:'300px', height:'300px', borderRadius:'50%', background:'rgba(0,0,0,0.15)', bottom:'-50px', left:'-80px', pointerEvents:'none' }} />

      <div style={{ width:'100%', maxWidth:'400px', display:'flex', flexDirection:'column', alignItems:'center', gap:'28px', animation:'fadeUp 0.5s ease' }}>

        {/* LOGOS */}
        <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
          <div style={{ animation:'floatA 3.5s ease-in-out infinite' }}>
            <img src="/logos/logo-arepa.png"
              style={{ width:'80px', height:'80px', borderRadius:'20px', objectFit:'cover', boxShadow:'0 12px 32px rgba(0,0,0,0.35), 0 0 0 2px rgba(255,255,255,0.15)' }}
              alt="Arepa Lovers" />
          </div>
          <div style={{ width:'1px', height:'48px', background:'rgba(255,255,255,0.2)' }} />
          <div style={{ animation:'floatB 3.5s ease-in-out 0.4s infinite' }}>
            <img src="/logos/logo-smash.png"
              style={{ width:'80px', height:'80px', borderRadius:'20px', objectFit:'cover', boxShadow:'0 12px 32px rgba(0,0,0,0.35), 0 0 0 2px rgba(255,255,255,0.15)' }}
              alt="Smash Lovers" />
          </div>
        </div>

        {/* HEADLINE */}
        {step === 'phone' && (
          <div style={{ textAlign:'center' }}>
            <h1 style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'28px', color:'white', margin:'0 0 6px', lineHeight:1.1 }}>
              Pide ahora ✨
            </h1>
            <p style={{ fontSize:'14px', color:'rgba(255,255,255,0.65)', margin:0 }}>
              Entra con tu <strong style={{ color:'#4ADE80' }}>WhatsApp</strong> y pide en segundos
            </p>
          </div>
        )}

        {/* FORM CARD */}
        <div style={{ width:'100%', background:'rgba(255,255,255,0.08)', backdropFilter:'blur(20px)', borderRadius:'24px', border:'1px solid rgba(255,255,255,0.12)', padding:'24px', display:'flex', flexDirection:'column', gap:'16px' }}>

          {/* PHONE STEP */}
          {step === 'phone' && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', background:'rgba(255,255,255,0.1)', borderRadius:'14px', padding:'14px 16px', border:'1.5px solid rgba(255,255,255,0.15)' }}>
                <span style={{ fontSize:'20px' }}>🇩🇴</span>
                <span style={{ color:'rgba(255,255,255,0.5)', fontSize:'14px', fontWeight:600 }}>+1</span>
                <span style={{ width:'1px', height:'18px', background:'rgba(255,255,255,0.2)' }} />
                <input type="tel" inputMode="numeric" placeholder="809-000-0000"
                  value={phone} onChange={e => setPhone(formatPhone(e.target.value))}
                  onKeyDown={e => e.key === 'Enter' && handleSendOTP()}
                  autoFocus
                  style={{ background:'none', border:'none', outline:'none', color:'white', fontFamily:'var(--font-body)', fontSize:'16px', fontWeight:500, width:'100%' }}
                />
              </div>
              {error && <p style={{ color:'#FCA5A5', fontSize:'13px', margin:0, textAlign:'center' }}>{error}</p>}
              <button onClick={handleSendOTP} disabled={loading || phoneDigits.length < 10}
                style={{ width:'100%', padding:'16px', background: phoneDigits.length >= 10 ? 'linear-gradient(135deg, #F59E0B, #F97316)' : 'rgba(255,255,255,0.15)', color:'white', border:'none', borderRadius:'14px', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'16px', cursor: phoneDigits.length < 10 ? 'not-allowed' : 'pointer', transition:'all 0.2s', boxShadow: phoneDigits.length >= 10 ? '0 4px 20px rgba(245,158,11,0.4)' : 'none' }}>
                {loading ? 'Enviando...' : 'Enviar código →'}
              </button>
              <p style={{ textAlign:'center', color:'rgba(255,255,255,0.3)', fontSize:'11px', margin:0 }}>
                🔒 Te enviaremos un código por WhatsApp
              </p>
            </>
          )}

          {/* OTP STEP */}
          {step === 'otp' && (
            <>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'32px', marginBottom:'6px' }}>📱</div>
                <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'17px', color:'white', margin:'0 0 4px' }}>Revisa tu WhatsApp</p>
                <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.45)', margin:0 }}>Código enviado a +1 {phone}</p>
              </div>
              <div style={{ display:'flex', gap:'10px', justifyContent:'center' }}>
                {otp.map((digit, i) => (
                  <input key={i} ref={el => { otpRefs.current[i] = el }}
                    type="tel" inputMode="numeric" maxLength={1} autoComplete="one-time-code"
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    onPaste={i === 0 ? handleOtpPaste : undefined}
                    className="otp-box"
                    style={{ width:'58px', height:'66px', textAlign:'center', background: digit ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.08)', border:`2px solid ${digit ? '#FFD700' : 'rgba(255,255,255,0.15)'}`, borderRadius:'14px', color:'white', fontSize:'28px', fontWeight:900, outline:'none', transition:'all 0.15s', fontFamily:'var(--font-display)', cursor:'text' }}
                  />
                ))}
              </div>
              {error && <p style={{ color:'#FCA5A5', fontSize:'13px', margin:0, textAlign:'center' }}>{error}</p>}
              {loading && <p style={{ textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:'13px', margin:0 }}>Verificando...</p>}
              <button onClick={() => verifyOTP(otp.join(''))} disabled={loading || otp.join('').length < 4}
                style={{ width:'100%', padding:'15px', background: otp.join('').length === 4 ? 'linear-gradient(135deg, #F59E0B, #F97316)' : 'rgba(255,255,255,0.15)', color:'white', border:'none', borderRadius:'14px', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'16px', cursor:'pointer', transition:'all 0.2s' }}>
                Verificar
              </button>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <button onClick={() => { setStep('phone'); setOtp(['','','','']); setError('') }}
                  style={{ background:'none', border:'none', color:'rgba(255,255,255,0.35)', fontSize:'12px', cursor:'pointer', fontFamily:'var(--font-body)' }}>
                  ← Cambiar número
                </button>
                <button onClick={handleResend} disabled={countdown > 0 || resending}
                  style={{ background:'none', border:'none', color: countdown > 0 ? 'rgba(255,255,255,0.2)' : '#F59E0B', fontSize:'12px', cursor: countdown > 0 ? 'default' : 'pointer', fontFamily:'var(--font-body)', fontWeight:600 }}>
                  {resending ? 'Enviando...' : countdown > 0 ? `Reenviar en ${countdown}s` : 'Reenviar código'}
                </button>
              </div>
            </>
          )}

          {/* NAME STEP */}
          {step === 'name' && (
            <>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'32px', marginBottom:'6px' }}>🎉</div>
                <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'17px', color:'white', margin:'0 0 4px' }}>¡Bienvenido!</p>
                <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.45)', margin:0 }}>¿Cómo te llamas?</p>
              </div>
              <input type="text" placeholder="Tu nombre" value={nombre}
                onChange={e => setNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRegister()}
                autoFocus
                style={{ background:'rgba(255,255,255,0.1)', border:'1.5px solid rgba(255,255,255,0.15)', borderRadius:'14px', padding:'14px 16px', color:'white', fontFamily:'var(--font-body)', fontSize:'16px', outline:'none', width:'100%', boxSizing:'border-box' as any }}
              />
              {error && <p style={{ color:'#FCA5A5', fontSize:'13px', margin:0, textAlign:'center' }}>{error}</p>}
              <button onClick={handleRegister} disabled={loading || nombre.trim().length < 2}
                style={{ width:'100%', padding:'16px', background: nombre.trim().length >= 2 ? 'linear-gradient(135deg, #F59E0B, #F97316)' : 'rgba(255,255,255,0.15)', color:'white', border:'none', borderRadius:'14px', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'16px', cursor:'pointer', transition:'all 0.2s' }}>
                {loading ? 'Creando cuenta...' : '¡Comenzar a pedir! 🎉'}
              </button>
            </>
          )}
        </div>

        {/* SOCIAL PROOF */}
        {reviews.length > 0 && step === 'phone' && (
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            {/* Avatars stack */}
            <div style={{ display:'flex' }}>
              {reviews.slice(0, 4).map((r, i) => (
                <div key={i} style={{ width:'32px', height:'32px', borderRadius:'50%', background: i % 2 === 0 ? '#C41E3A' : '#0052CC', border:'2px solid rgba(196,30,58,0.8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:800, color:'white', marginLeft: i === 0 ? 0 : '-8px', zIndex: 4 - i, position:'relative' }}>
                  {(r.nombre_cliente || 'C').charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
            {/* Stars + text */}
            <div>
              <div style={{ display:'flex', gap:'2px', marginBottom:'2px' }}>
                {[1,2,3,4,5].map(i => (
                  <span key={i} style={{ fontSize:'13px', filter: i <= Math.round(avgScore) ? 'none' : 'grayscale(1) opacity(0.3)' }}>⭐</span>
                ))}
              </div>
              <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.55)', margin:0, fontWeight:500 }}>
                <strong style={{ color:'white' }}>{avgScore.toFixed(1)}</strong> en reseñas · {reviews.length} clientes
              </p>
            </div>
          </div>
        )}

        {/* TRUST BADGES */}
        {step === 'phone' && (
          <>
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,1,0" />
            <div style={{ display:'flex', gap:'0', background:'rgba(0,0,0,0.2)', borderRadius:'16px', overflow:'hidden', border:'1px solid rgba(255,255,255,0.08)', width:'100%' }}>
              {[
                { icon:'delivery_dining', label:'Rápido', sub:'y caliente' },
                { icon:'verified', label:'Calidad', sub:'garantizada' },
                { icon:'lock', label:'Pago seguro', sub:'y protegido' },
              ].map((b, i) => (
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'14px 8px', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none', gap:'4px' }}>
                  <span className="material-symbols-rounded" style={{ fontSize:'22px', color:'#F59E0B', fontVariationSettings:"'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>{b.icon}</span>
                  <p style={{ fontSize:'11px', fontWeight:700, color:'white', margin:0, lineHeight:1.2 }}>{b.label}</p>
                  <p style={{ fontSize:'10px', color:'rgba(255,255,255,0.4)', margin:0 }}>{b.sub}</p>
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </main>
  )
}
