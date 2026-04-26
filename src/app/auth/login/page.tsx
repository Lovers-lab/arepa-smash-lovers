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

function StarRow({ n }: { n: number }) {
  return (
    <div style={{ display:'flex', gap:'2px' }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ fontSize:'12px', opacity: i <= n ? 1 : 0.2 }}>⭐</span>
      ))}
    </div>
  )
}

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
  const [scrollPos, setScrollPos] = useState(0)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const timerRef = useRef<any>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef<any>(null)

  useEffect(() => {
    loadReviews()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (autoScrollRef.current) clearInterval(autoScrollRef.current)
    }
  }, [])

  useEffect(() => {
    if (reviews.length === 0) return
    // Auto-scroll carrusel
    autoScrollRef.current = setInterval(() => {
      if (scrollRef.current) {
        const el = scrollRef.current
        const maxScroll = el.scrollWidth - el.clientWidth
        const next = el.scrollLeft + 220
        el.scrollTo({ left: next > maxScroll ? 0 : next, behavior: 'smooth' })
      }
    }, 3000)
    return () => clearInterval(autoScrollRef.current)
  }, [reviews])

  async function loadReviews() {
    const { data } = await supabase
      .from('reviews')
      .select('nombre_cliente, estrellas, comentario, marca, created_at')
      .eq('visible', true)
      .not('comentario', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data && data.length > 0) {
      setReviews(data)
      setAvgScore(Math.round(data.reduce((a, r) => a + r.estrellas, 0) / data.length * 10) / 10)
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
    if (digits.length !== 10) { setError('Ingresa un número válido (ej: 809-555-1234)'); return }
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
    } catch { setError('Error de conexión. Intenta de nuevo.') }
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
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error reenviando'); return }
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
    } catch { setError('Error al registrar. Intenta de nuevo.') }
    finally { setLoading(false) }
  }

  const phoneDigits = phone.replace(/\D/g, '')

  // Duplicar reviews para loop infinito
  const loopedReviews = reviews.length > 0 ? [...reviews, ...reviews] : []

  return (
    <main style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #0D0F12 0%, #161820 60%, #1A0A10 100%)',
      fontFamily: 'var(--font-body)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse-glow { 0%,100%{box-shadow:0 0 0 0 rgba(196,30,58,0)} 50%{box-shadow:0 0 0 8px rgba(196,30,58,0.15)} }
        .otp-input:focus { border-color: #C41E3A !important; background: rgba(196,30,58,0.15) !important; }
        .review-card { flex-shrink:0; width:200px; }
        @media(min-width:768px) {
          .login-layout { flex-direction:row !important; }
          .reviews-panel { display:flex !important; }
          .reviews-carousel { display:none !important; }
          .login-panel { width:420px !important; flex-shrink:0; }
        }
        @media(max-width:767px) {
          .reviews-panel { display:none !important; }
          .reviews-carousel { display:block !important; }
        }
        .reviews-side-scroll { scrollbar-width:none; }
        .reviews-side-scroll::-webkit-scrollbar { display:none; }
      `}</style>

      {/* Glow effects */}
      <div style={{ position:'fixed', width:'600px', height:'600px', background:'radial-gradient(circle, rgba(196,30,58,0.12) 0%, transparent 65%)', top:'-200px', right:'-200px', pointerEvents:'none', zIndex:0 }} />
      <div style={{ position:'fixed', width:'400px', height:'400px', background:'radial-gradient(circle, rgba(0,82,204,0.08) 0%, transparent 65%)', bottom:'-100px', left:'-100px', pointerEvents:'none', zIndex:0 }} />

      <div className="login-layout" style={{ display:'flex', flexDirection:'column', flex:1, position:'relative', zIndex:1 }}>

        {/* ── PANEL IZQUIERDO: RESEÑAS (desktop) ── */}
        <div className="reviews-panel" style={{ display:'none', flex:1, flexDirection:'column', justifyContent:'center', padding:'48px', borderRight:'1px solid rgba(255,255,255,0.06)' }}>
          {/* Score hero */}
          <div style={{ marginBottom:'40px', animation:'fadeUp 0.6s ease' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'16px' }}>
              <img src="/logos/logo-arepa.png" style={{ width:'32px', height:'32px', borderRadius:'8px' }} alt="" />
              <img src="/logos/logo-smash.png" style={{ width:'32px', height:'32px', borderRadius:'8px' }} alt="" />
              <span style={{ fontSize:'13px', color:'rgba(255,255,255,0.4)', fontWeight:500 }}>Santo Domingo, RD</span>
            </div>
            {reviews.length > 0 ? (
              <>
                <div style={{ fontFamily:'var(--font-display)', fontSize:'72px', fontWeight:900, color:'white', lineHeight:1, marginBottom:'8px' }}>
                  {avgScore.toFixed(1)}
                </div>
                <div style={{ display:'flex', gap:'4px', marginBottom:'8px' }}>
                  {[1,2,3,4,5].map(i => (
                    <span key={i} style={{ fontSize:'20px', opacity: i <= Math.round(avgScore) ? 1 : 0.2 }}>⭐</span>
                  ))}
                </div>
                <p style={{ fontSize:'14px', color:'rgba(255,255,255,0.4)', margin:0 }}>
                  Basado en {reviews.length} reseñas verificadas
                </p>
              </>
            ) : (
              <div>
                <div style={{ fontFamily:'var(--font-display)', fontSize:'48px', fontWeight:900, color:'white', lineHeight:1, marginBottom:'8px' }}>Arepa &<br/>Smash Lovers</div>
                <p style={{ fontSize:'14px', color:'rgba(255,255,255,0.4)' }}>Ghost kitchen · Delivery en Santo Domingo</p>
              </div>
            )}
          </div>

          {/* Review cards list */}
          {reviews.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px', maxHeight:'380px', overflowY:'auto', paddingRight:'8px' }} className="reviews-side-scroll">
              {reviews.slice(0, 6).map((r, i) => (
                <div key={i} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', padding:'14px 16px', animation:`fadeUp 0.5s ease ${i * 0.08}s both` }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <div style={{ width:'28px', height:'28px', borderRadius:'8px', background: r.marca==='AREPA' ? 'rgba(196,30,58,0.3)' : 'rgba(0,82,204,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:800, color:'white', flexShrink:0 }}>
                        {(r.nombre_cliente || 'C').charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize:'13px', fontWeight:600, color:'rgba(255,255,255,0.8)' }}>{r.nombre_cliente || 'Cliente'}</span>
                    </div>
                    <StarRow n={r.estrellas} />
                  </div>
                  {r.comentario && (
                    <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.45)', margin:0, lineHeight:1.55, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any, overflow:'hidden' }}>
                      "{r.comentario}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Promo badges */}
          <div style={{ marginTop:'24px', display:'flex', gap:'8px', flexWrap:'wrap' }}>
            <div style={{ background:'rgba(255,193,7,0.12)', border:'1px solid rgba(255,193,7,0.2)', borderRadius:'999px', padding:'6px 14px', fontSize:'12px', color:'#FCD34D', fontWeight:600 }}>
              🎁 Tequeños gratis · 1ra compra Arepa
            </div>
            <div style={{ background:'rgba(255,193,7,0.12)', border:'1px solid rgba(255,193,7,0.2)', borderRadius:'999px', padding:'6px 14px', fontSize:'12px', color:'#FCD34D', fontWeight:600 }}>
              🍟 Papas gratis · 1ra compra Smash
            </div>
          </div>
        </div>

        {/* ── HERO MÓVIL ── */}
        <div className="reviews-carousel" style={{ display:'none', padding:'32px 24px 0' }}>
          {/* Logos grandes — la marca es lo primero */}
          <div style={{ display:'flex', justifyContent:'center', gap:'20px', marginBottom:'28px' }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'10px', animation:'float 3s ease-in-out infinite' }}>
              <div style={{ position:'relative' }}>
                <div style={{ position:'absolute', inset:'-8px', borderRadius:'28px', background:'rgba(196,30,58,0.25)', filter:'blur(16px)' }} />
                <img src="/logos/logo-arepa.png" style={{ width:'120px', height:'120px', borderRadius:'24px', objectFit:'cover', boxShadow:'0 16px 48px rgba(196,30,58,0.5), 0 4px 16px rgba(0,0,0,0.4)', border:'2px solid rgba(255,255,255,0.12)', position:'relative', zIndex:1 }} alt="Arepa Lovers" />
              </div>
              <span style={{ color:'rgba(255,255,255,0.6)', fontSize:'11px', fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase' }}>Arepa Lovers</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'10px', animation:'float 3s ease-in-out 0.6s infinite' }}>
              <div style={{ position:'relative' }}>
                <div style={{ position:'absolute', inset:'-8px', borderRadius:'28px', background:'rgba(0,82,204,0.25)', filter:'blur(16px)' }} />
                <img src="/logos/logo-smash.png" style={{ width:'120px', height:'120px', borderRadius:'24px', objectFit:'cover', boxShadow:'0 16px 48px rgba(0,82,204,0.5), 0 4px 16px rgba(0,0,0,0.4)', border:'2px solid rgba(255,255,255,0.12)', position:'relative', zIndex:1 }} alt="Smash Lovers" />
              </div>
              <span style={{ color:'rgba(255,255,255,0.6)', fontSize:'11px', fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase' }}>Smash Lovers</span>
            </div>
          </div>

          {/* Score + promo */}
          <div style={{ textAlign:'center', marginBottom:'20px' }}>
            {reviews.length > 0 && (
              <div style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'999px', padding:'8px 16px', marginBottom:'12px' }}>
                <span style={{ fontFamily:'var(--font-display)', fontWeight:900, fontSize:'18px', color:'white' }}>{avgScore.toFixed(1)}</span>
                <span style={{ fontSize:'14px' }}>⭐</span>
                <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.4)' }}>{reviews.length} reseñas verificadas</span>
              </div>
            )}
            <br/>
            <div style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'rgba(255,193,7,0.1)', border:'1px solid rgba(255,193,7,0.2)', borderRadius:'999px', padding:'8px 16px' }}>
              <span style={{ fontSize:'14px' }}>🎁</span>
              <span style={{ fontSize:'12px', fontWeight:600, color:'#FCD34D' }}>Regalo gratis en tu primera compra</span>
            </div>
          </div>

        </div>

        {/* ── PANEL DERECHO: FORMULARIO ── */}
        <div className="login-panel" style={{ width:'100%', display:'flex', flexDirection:'column', justifyContent:'center', padding:'24px', background:'rgba(0,0,0,0.2)' }}>
          <div style={{ width:'100%', maxWidth:'360px', margin:'0 auto' }}>

            {/* Desktop: logos arriba del form */}
            <div style={{ display:'flex', justifyContent:'center', gap:'12px', marginBottom:'28px' }} className="desktop-logos">
              <style>{`@media(max-width:767px){.desktop-logos{display:none!important}}`}</style>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'6px', animation:'float 3s ease-in-out infinite' }}>
                <img src="/logos/logo-arepa.png" style={{ width:'80px', height:'80px', borderRadius:'18px', objectFit:'cover', boxShadow:'0 8px 32px rgba(196,30,58,0.4)', border:'2px solid rgba(255,255,255,0.1)' }} alt="Arepa Lovers" />
                <span style={{ color:'rgba(255,255,255,0.5)', fontSize:'9px', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase' }}>Arepa Lovers</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'6px', animation:'float 3s ease-in-out 0.6s infinite' }}>
                <img src="/logos/logo-smash.png" style={{ width:'80px', height:'80px', borderRadius:'18px', objectFit:'cover', boxShadow:'0 8px 32px rgba(0,82,204,0.4)', border:'2px solid rgba(255,255,255,0.1)' }} alt="Smash Lovers" />
                <span style={{ color:'rgba(255,255,255,0.5)', fontSize:'9px', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase' }}>Smash Lovers</span>
              </div>
            </div>

            {/* Card */}
            <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'24px', padding:'28px', backdropFilter:'blur(24px)' }}>

              {/* PHONE */}
              {step === 'phone' && (
                <div style={{ animation:'fadeUp 0.3s ease' }}>
                  <h2 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'20px', color:'white', margin:'0 0 6px', textAlign:'center' }}>
                    Pide ahora
                  </h2>
                  <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.35)', textAlign:'center', margin:'0 0 24px' }}>
                    Entra con tu WhatsApp
                  </p>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', background:'rgba(255,255,255,0.06)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:'14px', padding:'14px 18px', marginBottom:'16px', transition:'border-color 0.2s' }}>
                    <span style={{ fontSize:'20px' }}>🇩🇴</span>
                    <span style={{ color:'rgba(255,255,255,0.4)', fontSize:'15px', fontWeight:500 }}>+1</span>
                    <input type="tel" inputMode="numeric" placeholder="809-000-0000"
                      value={phone} onChange={e => setPhone(formatPhone(e.target.value))}
                      onKeyDown={e => e.key === 'Enter' && handleSendOTP()}
                      autoFocus
                      style={{ background:'none', border:'none', outline:'none', color:'white', fontFamily:'var(--font-body)', fontSize:'16px', fontWeight:500, width:'100%', letterSpacing:'0.5px' }}
                    />
                  </div>
                  {error && <p style={{ color:'#F87171', fontSize:'13px', marginBottom:'12px' }}>{error}</p>}
                  <button onClick={handleSendOTP} disabled={loading || phoneDigits.length < 10}
                    style={{ width:'100%', padding:'16px', background:'linear-gradient(135deg, #C41E3A, #E63946)', color:'white', border:'none', borderRadius:'14px', fontFamily:'var(--font-display)', fontSize:'16px', fontWeight:700, cursor: phoneDigits.length < 10 ? 'not-allowed' : 'pointer', opacity: loading || phoneDigits.length < 10 ? 0.5 : 1, boxShadow: phoneDigits.length >= 10 ? '0 4px 24px rgba(196,30,58,0.4)' : 'none', transition:'all 0.2s' }}>
                    {loading ? 'Enviando...' : 'Enviar código →'}
                  </button>
                  <p style={{ textAlign:'center', color:'rgba(255,255,255,0.18)', fontSize:'11px', marginTop:'16px', lineHeight:1.6 }}>
                    Te enviaremos un código por WhatsApp
                  </p>
                </div>
              )}

              {/* OTP */}
              {step === 'otp' && (
                <div style={{ animation:'fadeUp 0.3s ease' }}>
                  <div style={{ textAlign:'center', marginBottom:'24px' }}>
                    <div style={{ fontSize:'36px', marginBottom:'8px' }}>📱</div>
                    <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'18px', color:'white', margin:'0 0 6px' }}>Revisa tu WhatsApp</p>
                    <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.4)', margin:0 }}>
                      Código enviado a <strong style={{ color:'rgba(255,255,255,0.7)' }}>+1 {phone}</strong>
                    </p>
                  </div>
                  <div style={{ display:'flex', gap:'10px', justifyContent:'center', marginBottom:'20px' }}>
                    {otp.map((digit, i) => (
                      <input key={i} ref={el => { otpRefs.current[i] = el }}
                        type="tel" inputMode="numeric" maxLength={1} autoComplete="one-time-code"
                        value={digit}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        onPaste={i === 0 ? handleOtpPaste : undefined}
                        className="otp-input"
                        style={{ width:'56px', height:'64px', textAlign:'center', background: digit ? 'rgba(196,30,58,0.2)' : 'rgba(255,255,255,0.06)', border:`2px solid ${digit ? '#C41E3A' : 'rgba(255,255,255,0.1)'}`, borderRadius:'14px', color:'white', fontSize:'26px', fontWeight:900, outline:'none', transition:'all 0.15s', fontFamily:'var(--font-display)' }}
                      />
                    ))}
                  </div>
                  {error && <p style={{ color:'#F87171', fontSize:'13px', marginBottom:'12px', textAlign:'center' }}>{error}</p>}
                  {loading && <p style={{ textAlign:'center', color:'rgba(255,255,255,0.35)', fontSize:'13px', marginBottom:'12px' }}>Verificando...</p>}
                  <button onClick={() => verifyOTP(otp.join(''))} disabled={loading || otp.join('').length < 4}
                    style={{ width:'100%', padding:'16px', background:'linear-gradient(135deg, #C41E3A, #E63946)', color:'white', border:'none', borderRadius:'14px', fontFamily:'var(--font-display)', fontSize:'16px', fontWeight:700, cursor:'pointer', opacity: loading || otp.join('').length < 4 ? 0.5 : 1, boxShadow:'0 4px 24px rgba(196,30,58,0.35)', marginBottom:'14px' }}>
                    Verificar
                  </button>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <button onClick={() => { setStep('phone'); setOtp(['','','','']); setError('') }}
                      style={{ background:'none', border:'none', color:'rgba(255,255,255,0.3)', fontSize:'12px', cursor:'pointer', fontFamily:'var(--font-body)' }}>
                      ← Cambiar número
                    </button>
                    <button onClick={handleResend} disabled={countdown > 0 || resending}
                      style={{ background:'none', border:'none', color: countdown > 0 ? 'rgba(255,255,255,0.2)' : '#C41E3A', fontSize:'12px', cursor: countdown > 0 ? 'default' : 'pointer', fontFamily:'var(--font-body)', fontWeight:600 }}>
                      {resending ? 'Enviando...' : countdown > 0 ? `Reenviar en ${countdown}s` : 'Reenviar código'}
                    </button>
                  </div>
                </div>
              )}

              {/* NAME */}
              {step === 'name' && (
                <div style={{ animation:'fadeUp 0.3s ease' }}>
                  <div style={{ textAlign:'center', marginBottom:'20px' }}>
                    <div style={{ fontSize:'36px', marginBottom:'8px' }}>🎉</div>
                    <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'20px', color:'white', margin:'0 0 4px' }}>¡Bienvenido!</p>
                    <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.4)', margin:0 }}>¿Cómo te llamas?</p>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', background:'rgba(255,255,255,0.06)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:'14px', padding:'14px 18px', marginBottom:'16px' }}>
                    <input type="text" placeholder="Tu nombre" value={nombre}
                      onChange={e => setNombre(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleRegister()}
                      autoFocus
                      style={{ background:'none', border:'none', outline:'none', color:'white', fontFamily:'var(--font-body)', fontSize:'16px', fontWeight:500, width:'100%' }}
                    />
                  </div>
                  {error && <p style={{ color:'#F87171', fontSize:'13px', marginBottom:'12px' }}>{error}</p>}
                  <button onClick={handleRegister} disabled={loading || nombre.trim().length < 2}
                    style={{ width:'100%', padding:'16px', background:'linear-gradient(135deg, #C41E3A, #E63946)', color:'white', border:'none', borderRadius:'14px', fontFamily:'var(--font-display)', fontSize:'16px', fontWeight:700, cursor:'pointer', opacity: loading || nombre.trim().length < 2 ? 0.5 : 1, boxShadow:'0 4px 24px rgba(196,30,58,0.35)' }}>
                    {loading ? 'Creando cuenta...' : '¡Comenzar a pedir! 🎉'}
                  </button>
                </div>
              )}
            </div>

            <p style={{ textAlign:'center', color:'rgba(255,255,255,0.15)', fontSize:'11px', marginTop:'16px', lineHeight:1.6 }}>
              📍 Delivery en Santo Domingo · Solo usamos tu WhatsApp para notificarte
            </p>
          </div>
        </div>

        {/* ── CARRUSEL RESEÑAS MÓVIL (debajo del form) ── */}
        {reviews.length > 0 && (
          <div className="reviews-carousel" style={{ display:'none', paddingBottom:'32px' }}>
            <p style={{ textAlign:'center', fontSize:'11px', fontWeight:700, color:'rgba(255,255,255,0.25)', letterSpacing:'0.8px', textTransform:'uppercase', margin:'0 0 12px' }}>Lo que dicen nuestros clientes</p>
            <div ref={scrollRef} style={{ display:'flex', gap:'10px', overflowX:'auto', paddingBottom:'8px', scrollbarWidth:'none', scrollBehavior:'smooth', paddingLeft:'24px', paddingRight:'24px' }} className="reviews-side-scroll">
              {loopedReviews.map((r, i) => (
                <div key={i} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'14px', padding:'14px', flexShrink:0, width:'180px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                    <div style={{ width:'26px', height:'26px', borderRadius:'7px', background: r.marca==='AREPA' ? 'rgba(196,30,58,0.3)' : 'rgba(0,82,204,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:800, color:'white', flexShrink:0 }}>
                      {(r.nombre_cliente || 'C').charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontSize:'12px', fontWeight:600, color:'rgba(255,255,255,0.7)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.nombre_cliente || 'Cliente'}</span>
                  </div>
                  <StarRow n={r.estrellas} />
                  {r.comentario && (
                    <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)', margin:'8px 0 0', lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical' as any, overflow:'hidden' }}>
                      "{r.comentario}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
