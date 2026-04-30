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
      .order('estrellas', { ascending: false })
      .limit(8)
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
      if (!res.ok || !data.valid) { setError(data.error || 'Código incorrecto'); setLoading(false); return }
      if (data.isNewUser) { setStep('name') }
      else if (data.user) { localStorage.setItem('lovers_user', JSON.stringify(data.user)); router.push('/') }
      else { setError('Error al iniciar sesión. Intenta de nuevo.'); setLoading(false) }
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
      background: 'linear-gradient(170deg, #B8152A 0%, #C41E3A 50%, #9A1020 100%)',
      fontFamily: 'var(--font-body)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,1,0" />
      <style>{`
        @keyframes floatA { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes floatB { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        input::placeholder { color: rgba(255,255,255,0.35); }
        .otp-box:focus { border-color: #FFD700 !important; background: rgba(255,215,0,0.12) !important; }
        .phone-input:focus-within { border-color: rgba(255,255,255,0.4) !important; }
      `}</style>

      {/* Subtle circle decorations */}
      <div style={{ position:'absolute', width:'500px', height:'500px', borderRadius:'50%', background:'rgba(255,255,255,0.04)', top:'-200px', right:'-150px', pointerEvents:'none' }} />
      <div style={{ position:'absolute', width:'350px', height:'350px', borderRadius:'50%', background:'rgba(0,0,0,0.1)', bottom:'-120px', left:'-100px', pointerEvents:'none' }} />

      <div style={{ width:'100%', maxWidth:'380px', display:'flex', flexDirection:'column', alignItems:'center', gap:'24px', animation:'fadeUp 0.4s ease', position:'relative', zIndex:1 }}>

        {/* LOGOS */}
        <div style={{ display:'flex', alignItems:'center', gap:'20px' }}>
          <img src="/logos/logo-arepa.png"
            style={{ width:'72px', height:'72px', borderRadius:'18px', objectFit:'cover', boxShadow:'0 8px 24px rgba(0,0,0,0.3)', animation:'floatA 3s ease-in-out infinite' }}
            alt="Arepa Lovers" />
          <img src="/logos/logo-smash.png"
            style={{ width:'72px', height:'72px', borderRadius:'18px', objectFit:'cover', boxShadow:'0 8px 24px rgba(0,0,0,0.3)', animation:'floatB 3s ease-in-out 0.5s infinite' }}
            alt="Smash Lovers" />
        </div>

        {/* HEADLINE — solo en phone step */}
        {step === 'phone' && (
          <div style={{ textAlign:'center', animation:'fadeUp 0.4s ease 0.1s both' }}>
            <h1 style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'30px', color:'white', margin:'0 0 8px', lineHeight:1.1 }}>
              Pide ahora ✨
            </h1>
            <p style={{ fontSize:'15px', color:'rgba(255,255,255,0.75)', margin:0, lineHeight:1.5 }}>
              Entra con tu <strong style={{ color:'#4ADE80', fontWeight:700 }}>WhatsApp</strong> y pide en segundos
            </p>
          </div>
        )}

        {/* FORM */}
        <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:'12px', animation:'fadeUp 0.4s ease 0.15s both' }}>

          {/* PHONE */}
          {step === 'phone' && (
            <>
              <div className="phone-input" style={{ display:'flex', alignItems:'center', gap:'10px', background:'rgba(255,255,255,0.12)', borderRadius:'16px', padding:'14px 18px', border:'1.5px solid rgba(255,255,255,0.2)', transition:'border-color 0.2s' }}>
                <span style={{ fontSize:'22px' }}>🇩🇴</span>
                <span style={{ color:'rgba(255,255,255,0.5)', fontSize:'14px', fontWeight:600 }}>+1</span>
                <span style={{ width:'1px', height:'20px', background:'rgba(255,255,255,0.2)', flexShrink:0 }} />
                <input type="tel" inputMode="numeric" placeholder="809-000-0000"
                  value={phone} onChange={e => setPhone(formatPhone(e.target.value))}
                  onKeyDown={e => e.key === 'Enter' && handleSendOTP()}
                  autoFocus
                  style={{ background:'none', border:'none', outline:'none', color:'white', fontFamily:'var(--font-body)', fontSize:'17px', fontWeight:500, width:'100%' }}
                />
              </div>
              {error && <p style={{ color:'#FCA5A5', fontSize:'13px', margin:0, textAlign:'center' }}>{error}</p>}
              <button onClick={handleSendOTP} disabled={loading || phoneDigits.length < 10}
                style={{ width:'100%', padding:'17px', background: phoneDigits.length >= 10 ? 'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)' : 'rgba(255,255,255,0.15)', color:'white', border:'none', borderRadius:'16px', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'17px', cursor: phoneDigits.length < 10 ? 'not-allowed' : 'pointer', boxShadow: phoneDigits.length >= 10 ? '0 6px 24px rgba(245,158,11,0.45)' : 'none', transition:'all 0.2s', letterSpacing:'0.2px' }}>
                {loading ? 'Enviando...' : 'Enviar código →'}
              </button>
              <p style={{ textAlign:'center', color:'rgba(255,255,255,0.35)', fontSize:'12px', margin:0, display:'flex', alignItems:'center', justifyContent:'center', gap:'5px' }}>
                <span className="material-symbols-rounded" style={{ fontSize:'14px', fontVariationSettings:"'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>lock</span>
                Te enviaremos un código por WhatsApp
              </p>
            </>
          )}

          {/* OTP */}
          {step === 'otp' && (
            <>
              <div style={{ textAlign:'center', marginBottom:'4px' }}>
                <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'20px', color:'white', margin:'0 0 4px' }}>Revisa tu WhatsApp 📱</p>
                <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.5)', margin:0 }}>Código enviado a +1 {phone}</p>
              </div>
              <div style={{ display:'flex', gap:'12px', justifyContent:'center' }}>
                {otp.map((digit, i) => (
                  <input key={i} ref={el => { otpRefs.current[i] = el }}
                    type="tel" inputMode="numeric" maxLength={1} autoComplete="one-time-code"
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    onPaste={i === 0 ? handleOtpPaste : undefined}
                    className="otp-box"
                    style={{ width:'64px', height:'72px', textAlign:'center', background: digit ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.1)', border:`2px solid ${digit ? '#FFD700' : 'rgba(255,255,255,0.2)'}`, borderRadius:'16px', color:'white', fontSize:'30px', fontWeight:900, outline:'none', transition:'all 0.15s', fontFamily:'var(--font-display)' }}
                  />
                ))}
              </div>
              {error && <p style={{ color:'#FCA5A5', fontSize:'13px', margin:0, textAlign:'center' }}>{error}</p>}
              {loading && <p style={{ textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:'13px', margin:0 }}>Verificando...</p>}
              <button onClick={() => verifyOTP(otp.join(''))} disabled={loading || otp.join('').length < 4}
                style={{ width:'100%', padding:'17px', background: otp.join('').length === 4 ? 'linear-gradient(135deg, #F59E0B, #F97316)' : 'rgba(255,255,255,0.15)', color:'white', border:'none', borderRadius:'16px', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'17px', cursor:'pointer', transition:'all 0.2s', boxShadow: otp.join('').length === 4 ? '0 6px 24px rgba(245,158,11,0.45)' : 'none' }}>
                Verificar código
              </button>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <button onClick={() => { setStep('phone'); setOtp(['','','','']); setError('') }}
                  style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', fontSize:'12px', cursor:'pointer', fontFamily:'var(--font-body)' }}>
                  ← Cambiar número
                </button>
                <button onClick={handleResend} disabled={countdown > 0 || resending}
                  style={{ background:'none', border:'none', color: countdown > 0 ? 'rgba(255,255,255,0.2)' : '#F59E0B', fontSize:'12px', cursor: countdown > 0 ? 'default' : 'pointer', fontFamily:'var(--font-body)', fontWeight:600 }}>
                  {resending ? 'Enviando...' : countdown > 0 ? `Reenviar en ${countdown}s` : 'Reenviar código'}
                </button>
              </div>
            </>
          )}

          {/* NAME */}
          {step === 'name' && (
            <>
              <div style={{ textAlign:'center', marginBottom:'4px' }}>
                <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'20px', color:'white', margin:'0 0 4px' }}>¡Bienvenido! 🎉</p>
                <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.5)', margin:0 }}>¿Cómo te llamas?</p>
              </div>
              <input type="text" placeholder="Tu nombre" value={nombre}
                onChange={e => setNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRegister()}
                autoFocus
                style={{ background:'rgba(255,255,255,0.12)', border:'1.5px solid rgba(255,255,255,0.2)', borderRadius:'16px', padding:'14px 18px', color:'white', fontFamily:'var(--font-body)', fontSize:'17px', outline:'none', width:'100%', boxSizing:'border-box' as any }}
              />
              {error && <p style={{ color:'#FCA5A5', fontSize:'13px', margin:0, textAlign:'center' }}>{error}</p>}
              <button onClick={handleRegister} disabled={loading || nombre.trim().length < 2}
                style={{ width:'100%', padding:'17px', background: nombre.trim().length >= 2 ? 'linear-gradient(135deg, #F59E0B, #F97316)' : 'rgba(255,255,255,0.15)', color:'white', border:'none', borderRadius:'16px', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'17px', cursor:'pointer', transition:'all 0.2s', boxShadow: nombre.trim().length >= 2 ? '0 6px 24px rgba(245,158,11,0.45)' : 'none' }}>
                {loading ? 'Creando cuenta...' : '¡Comenzar a pedir! 🎉'}
              </button>
            </>
          )}
        </div>

        {/* TRUST BADGES */}
        {step === 'phone' && (
          <div style={{ width:'100%', display:'flex', background:'rgba(0,0,0,0.18)', borderRadius:'16px', overflow:'hidden', border:'1px solid rgba(255,255,255,0.08)', animation:'fadeUp 0.4s ease 0.2s both' }}>
            {[
              { icon:'delivery_dining', label:'Rápido', sub:'y caliente' },
              { icon:'verified', label:'Calidad', sub:'garantizada' },
              { icon:'credit_card', label:'Pago seguro', sub:'y protegido' },
            ].map((b, i) => (
              <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'14px 8px', gap:'4px', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                <span className="material-symbols-rounded" style={{ fontSize:'22px', color:'#F59E0B', fontVariationSettings:"'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>{b.icon}</span>
                <p style={{ fontSize:'11px', fontWeight:700, color:'white', margin:0, lineHeight:1.2, textAlign:'center' }}>{b.label}</p>
                <p style={{ fontSize:'10px', color:'rgba(255,255,255,0.4)', margin:0 }}>{b.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* SOCIAL PROOF */}
        {step === 'phone' && reviews.length > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:'12px', animation:'fadeUp 0.4s ease 0.25s both' }}>
            <div style={{ display:'flex' }}>
              {reviews.slice(0, 5).map((r, i) => (
                <div key={i} style={{ width:'34px', height:'34px', borderRadius:'50%', background: r.marca === 'SMASH' ? '#1D4ED8' : '#9A1020', border:'2px solid rgba(196,30,58,0.9)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:800, color:'white', marginLeft: i === 0 ? 0 : '-9px', zIndex: 5 - i, position:'relative', boxShadow:'0 2px 6px rgba(0,0,0,0.3)' }}>
                  {(r.nombre_cliente || 'C').charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
            <div>
              <div style={{ display:'flex', gap:'1px', marginBottom:'2px' }}>
                {[1,2,3,4,5].map(i => (
                  <span key={i} style={{ fontSize:'14px', filter: i <= Math.round(avgScore) ? 'none' : 'grayscale(1) opacity(0.3)' }}>⭐</span>
                ))}
              </div>
              <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.6)', margin:0 }}>
                <strong style={{ color:'white' }}>{avgScore.toFixed(1)}</strong> en reseñas
              </p>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
