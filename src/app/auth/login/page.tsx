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
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const timerRef = useRef<any>(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: digits }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error enviando el código'); return }
      setStep('otp')
      startCountdown()
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: digits }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error reenviando'); return }
      setOtp(['', '', '', '', '', ''])
      startCountdown()
      otpRefs.current[0]?.focus()
    } catch { setError('Error de conexión.') }
    finally { setResending(false) }
  }

  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1)
    const newOtp = [...otp]
    newOtp[index] = digit
    setOtp(newOtp)
    setError('')
    if (digit && index < 3) {
      otpRefs.current[index + 1]?.focus()
    }
    // Auto-verificar si todos los dígitos están completos
    if (digit && index === 3) {
      const fullCode = [...newOtp.slice(0, 5), digit].join('')
      if (fullCode.length === 4) verifyOTP(fullCode)
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
    if (e.key === 'Enter') {
      const code = otp.join('')
      if (code.length === 4) verifyOTP(code)
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (pasted.length === 4) {
      setOtp(pasted.slice(0,4).split(''))
      verifyOTP(pasted)
    }
  }

  async function verifyOTP(code: string) {
    setLoading(true); setError('')
    try {
      const digits = phone.replace(/\D/g, '')
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: digits, code }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Código incorrecto'); setLoading(false); return }
      if (data.isNewUser) {
        setStep('name')
      } else {
        localStorage.setItem('lovers_user', JSON.stringify(data.user))
        router.push('/')
      }
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

  const digits = phone.replace(/\D/g, '')

  return (
    <main style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #0D0F12 0%, #161820 60%, #1A0A10 100%)',
      padding: '24px', position: 'relative', overflow: 'hidden', fontFamily: 'var(--font-body)'
    }}>
      <div style={{ position:'absolute', width:'500px', height:'500px', background:'radial-gradient(circle, rgba(196,30,58,0.18) 0%, transparent 65%)', top:'-150px', right:'-150px', pointerEvents:'none' }} />
      <div style={{ position:'absolute', width:'350px', height:'350px', background:'radial-gradient(circle, rgba(0,82,204,0.12) 0%, transparent 65%)', bottom:'-100px', left:'-100px', pointerEvents:'none' }} />

      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:'380px' }}>

        {/* Logos */}
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'16px', marginBottom:'24px' }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'8px', animation:'float 3s ease-in-out infinite' }}>
              <img src="/logos/logo-arepa.png" style={{ width:'110px', height:'110px', borderRadius:'22px', objectFit:'cover', boxShadow:'0 12px 40px rgba(196,30,58,0.45), 0 4px 12px rgba(0,0,0,0.3)', border:'2px solid rgba(255,255,255,0.1)' }} alt="Arepa Lovers" />
              <span style={{ color:'rgba(255,255,255,0.6)', fontSize:'10px', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase' }}>Arepa Lovers</span>
            </div>
            <div style={{ width:'1px', height:'70px', background:'linear-gradient(to bottom, transparent, rgba(255,255,255,0.15), transparent)' }} />
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'8px', animation:'float 3s ease-in-out 0.6s infinite' }}>
              <img src="/logos/logo-smash.png" style={{ width:'110px', height:'110px', borderRadius:'22px', objectFit:'cover', boxShadow:'0 12px 40px rgba(0,82,204,0.45), 0 4px 12px rgba(0,0,0,0.3)', border:'2px solid rgba(255,255,255,0.1)' }} alt="Smash Lovers" />
              <span style={{ color:'rgba(255,255,255,0.6)', fontSize:'10px', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase' }}>Smash Lovers</span>
            </div>
          </div>
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

          {/* STEP: PHONE */}
          {step === 'phone' && (
            <>
              <p style={{ fontSize:'11px', fontWeight:700, color:'rgba(255,255,255,0.35)', letterSpacing:'0.8px', textTransform:'uppercase', marginBottom:'8px' }}>
                Tu número WhatsApp
              </p>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', background:'rgba(255,255,255,0.06)', border:'1.5px solid rgba(255,255,255,0.1)', borderRadius:'14px', padding:'15px 18px', marginBottom:'20px' }}>
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
              <button onClick={handleSendOTP} disabled={loading || digits.length < 10}
                style={{ width:'100%', padding:'16px', background:'linear-gradient(135deg, #C41E3A, #E63946)', color:'white', border:'none', borderRadius:'14px', fontFamily:'var(--font-display)', fontSize:'16px', fontWeight:700, cursor:'pointer', opacity: loading || digits.length < 10 ? 0.5 : 1, boxShadow:'0 4px 20px rgba(196,30,58,0.3)' }}>
                {loading ? 'Enviando código...' : 'Enviar código →'}
              </button>
              <p style={{ textAlign:'center', color:'rgba(255,255,255,0.2)', fontSize:'11px', marginTop:'16px', lineHeight:1.6 }}>
                Te enviaremos un código de verificación por WhatsApp.
              </p>
            </>
          )}

          {/* STEP: OTP */}
          {step === 'otp' && (
            <>
              <div style={{ textAlign:'center', marginBottom:'24px' }}>
                <div style={{ fontSize:'36px', marginBottom:'8px' }}>📱</div>
                <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'18px', color:'white', margin:'0 0 6px' }}>
                  Revisa tu WhatsApp
                </p>
                <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.45)', margin:0 }}>
                  Enviamos un código a <span style={{ color:'white', fontWeight:600 }}>+1 {phone}</span>
                </p>
              </div>

              {/* OTP inputs */}
              <div style={{ display:'flex', gap:'8px', justifyContent:'center', marginBottom:'20px' }}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { otpRefs.current[i] = el }}
                    type="tel" inputMode="numeric" maxLength={1} autoComplete="one-time-code"
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    onPaste={i === 0 ? handleOtpPaste : undefined}
                    style={{
                      width: '44px', height: '52px', textAlign: 'center',
                      background: digit ? 'rgba(196,30,58,0.2)' : 'rgba(255,255,255,0.06)',
                      border: `2px solid ${digit ? '#C41E3A' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '12px', color: 'white',
                      fontSize: '22px', fontWeight: 800,
                      outline: 'none', transition: 'all 0.15s',
                      fontFamily: 'var(--font-display)',
                    }}
                  />
                ))}
              </div>

              {error && <p style={{ color:'#F87171', fontSize:'13px', marginBottom:'12px', textAlign:'center' }}>{error}</p>}

              {loading && (
                <p style={{ textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:'13px', marginBottom:'12px' }}>
                  Verificando...
                </p>
              )}

              <button onClick={() => verifyOTP(otp.join(''))} disabled={loading || otp.join('').length < 4}
                style={{ width:'100%', padding:'16px', background:'linear-gradient(135deg, #C41E3A, #E63946)', color:'white', border:'none', borderRadius:'14px', fontFamily:'var(--font-display)', fontSize:'16px', fontWeight:700, cursor:'pointer', opacity: loading || otp.join('').length < 4 ? 0.5 : 1, boxShadow:'0 4px 20px rgba(196,30,58,0.3)', marginBottom:'12px' }}>
                Verificar código
              </button>

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <button onClick={() => { setStep('phone'); setOtp(['','','','']); setError('') }}
                  style={{ background:'none', border:'none', color:'rgba(255,255,255,0.3)', fontSize:'12px', cursor:'pointer', fontFamily:'var(--font-body)' }}>
                  ← Cambiar número
                </button>
                <button onClick={handleResend} disabled={countdown > 0 || resending}
                  style={{ background:'none', border:'none', color: countdown > 0 ? 'rgba(255,255,255,0.2)' : '#C41E3A', fontSize:'12px', cursor: countdown > 0 ? 'default' : 'pointer', fontFamily:'var(--font-body)', fontWeight:600 }}>
                  {resending ? 'Enviando...' : countdown > 0 ? `Reenviar en ${countdown}s` : 'Reenviar código'}
                </button>
              </div>
            </>
          )}

          {/* STEP: NAME (nuevo usuario) */}
          {step === 'name' && (
            <>
              <div style={{ marginBottom:'20px' }}>
                <div style={{ fontSize:'32px', textAlign:'center', marginBottom:'8px' }}>🎉</div>
                <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'18px', color:'white', textAlign:'center', margin:'0 0 4px' }}>
                  ¡Bienvenido!
                </p>
                <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.4)', textAlign:'center', margin:0 }}>
                  Última cosa — ¿cómo te llamas?
                </p>
              </div>
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
            </>
          )}

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
