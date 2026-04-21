'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AdminLoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!email || !password) { setError('Completa todos los campos'); return }
    setLoading(true); setError('')

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Credenciales incorrectas. Verifica tu email y contraseña.')
      setLoading(false)
      return
    }

    // Verify this user is an admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Error de sesión'); setLoading(false); return }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('nombre, rol, activo')
      .eq('id', user.id)
      .single()

    if (!adminUser || !adminUser.activo) {
      await supabase.auth.signOut()
      setError('No tienes acceso al panel de administración.')
      setLoading(false)
      return
    }

    router.push('/admin/dashboard')
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="text-5xl mb-3">🔐</div>
          <h1 className="text-2xl font-black text-gray-900" style={{ fontFamily: 'Syne, serif' }}>
            Admin Panel
          </h1>
          <p className="text-gray-500 text-sm mt-1">Arepa & Smash Lovers</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">Email</label>
            <input
              type="email"
              placeholder="admin@arepa-smash.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              autoFocus
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-900 transition-colors"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">Contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-900 transition-colors"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-4 rounded-xl bg-gray-900 text-white font-bold text-sm disabled:opacity-50 transition-all hover:bg-gray-800"
          >
            {loading ? 'Verificando...' : 'Entrar al panel →'}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400">
          Solo administradores autorizados.
        </p>
      </div>
    </main>
  )
}
