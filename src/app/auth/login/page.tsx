'use client'nexport const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function formatRD(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [nombre, setNombre] = useState('')
  const [step, setStep] = useState<'phone' | 'name'>('phone')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  async function handlePhoneSubmit() {
    const digits = phone.replace(/\D/g, '')
    if (digits.length !== 10) {
      setError('Ingresa un número válido de 10 dígitos (ej: 809-555-1234)')
      return
    }
    setError('')
    setLoading(true)

    try {
      const { data, error: dbError } = await supabase
        .from('users')
        .select('id, nombre, whatsapp, activo')
        .eq('whatsapp', digits)
        .single()

      if (dbError && dbError.code !== 'PGRST116') throw dbError

      if (data) {
        // Existing user — log in directly
        localStorage.setItem('lovers_user', JSON.stringify({ id: data.id, nombre: data.nombre, whatsapp: data.whatsapp }))
        const lastMarca = localStorage.getItem('lovers_marca')
        router.push(lastMarca ? '/menu' : '/')
      } else {
        // New user — ask for name
        setStep('name')
      }
    } catch (e) {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister() {
    if (!nombre.trim() || nombre.trim().length < 2) {
      setError('Ingresa tu nombre (mínimo 2 caracteres)')
      return
    }
    setError('')
    setLoading(true)

    const digits = phone.replace(/\D/g, '')

    try {
      const { data, error: dbError } = await supabase
        .from('users')
        .insert({
          whatsapp: digits,
          nombre: nombre.trim(),
          activo: true,
          cliente_vip: false,
          total_gastado: 0,
          total_compras: 0,
          dentro_zona: false,
        })
        .select('id, nombre, whatsapp')
        .single()

      if (dbError) throw dbError

      // Check if this user has a pending welcome offer via referral/landing
      await fetch('/api/welcome-offers/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.id }),
      })

      localStorage.setItem('lovers_user', JSON.stringify({ id: data.id, nombre: data.nombre, whatsapp: data.whatsapp }))
      router.push('/')
    } catch (e) {
      setError('Error al registrar. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6" style={{ background: '#F8F9FA' }}>
      <div className="w-full max-w-sm space-y-8">

        {/* Logo area */}
        <div className="text-center space-y-3">
          <div className="flex justify-center gap-3">
            <span className="text-5xl">🫓</span>
            <span className="text-5xl">🍔</span>
          </div>
          <div>
            <h1 className="text-2xl font-black" style={{ fontFamily: 'Syne, serif' }}>
              Lovers Kitchen
            </h1>
            <p className="text-gray-500 text-sm">
              {step === 'phone' ? 'Ingresa tu número WhatsApp' : '¿Cómo te llamas?'}
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">

          {step === 'phone' ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  Número WhatsApp
                </label>
                <div className="flex items-center gap-2 border-2 border-gray-200 rounded-xl px-4 py-3 focus-within:border-gray-900 transition-colors">
                  <span className="text-gray-400 font-mono text-sm">🇩🇴 +1</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="809-000-0000"
                    value={phone}
                    onChange={(e) => setPhone(formatRD(e.target.value))}
                    onKeyDown={(e) => e.key === 'Enter' && handlePhoneSubmit()}
                    maxLength={12}
                    className="flex-1 outline-none text-gray-900 font-medium placeholder-gray-400 bg-transparent"
                    autoFocus
                  />
                </div>
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                onClick={handlePhoneSubmit}
                disabled={loading || phone.replace(/\D/g, '').length < 10}
                className="w-full py-4 rounded-xl font-bold text-white transition-all duration-200 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #1A1A1A, #333)' }}
              >
                {loading ? 'Verificando...' : 'Continuar →'}
              </button>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-sm text-gray-500">Tu número:</p>
                <p className="font-bold text-gray-900">+1 {phone}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Tu nombre</label>
                <input
                  type="text"
                  placeholder="Ej: María González"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-gray-900 transition-colors font-medium"
                  autoFocus
                />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                onClick={handleRegister}
                disabled={loading || nombre.trim().length < 2}
                className="w-full py-4 rounded-xl font-bold text-white transition-all duration-200 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #1A1A1A, #333)' }}
              >
                {loading ? 'Creando cuenta...' : '¡Comenzar a pedir! 🎉'}
              </button>

              <button onClick={() => { setStep('phone'); setError('') }} className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors">
                ← Cambiar número
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400">
          Al continuar aceptas nuestros términos de uso. Solo usamos tu WhatsApp para notificarte sobre tus pedidos.
        </p>
      </div>
    </main>
  )
}
