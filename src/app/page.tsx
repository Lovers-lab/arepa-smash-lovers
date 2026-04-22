'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Marca = 'AREPA' | 'SMASH'

export default function HomePage() {
  const router = useRouter()
  const [user, setUser] = useState<{ nombre: string; whatsapp: string } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Check if client is logged in via localStorage
    const stored = localStorage.getItem('lovers_user')
    if (!stored) {
      router.replace('/auth/login')
      return
    }
    setUser(JSON.parse(stored))
  }, [router])

  function selectMarca(marca: Marca) {
    const currentMarca = localStorage.getItem('lovers_marca') as Marca | null
    if (currentMarca && currentMarca !== marca) {
      const ok = confirm(
        `¿Cambiar a ${marca === 'AREPA' ? 'Arepa Lovers 🫓' : 'Smash Lovers 🍔'}? Se limpiará el carrito.`
      )
      if (!ok) return
      localStorage.removeItem('lovers_cart')
    }
    localStorage.setItem('lovers_marca', marca)
    setLoading(true)
    router.push('/menu')
  }

  if (!user) return null

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm space-y-8">
        {/* Welcome */}
        <div className="text-center space-y-1">
          <p className="text-sm text-gray-500 font-medium">Bienvenido,</p>
          <h1 className="text-3xl font-black" style={{ fontFamily: 'Syne, serif' }}>
            {user.nombre} 👋
          </h1>
          <p className="text-gray-500 text-sm">¿Qué quieres comer hoy?</p>
        </div>

        {/* Brand Selector */}
        <div className="space-y-4">
          {/* Arepa Lovers */}
          <button
            onClick={() => selectMarca('AREPA')}
            disabled={loading}
            className="w-full group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #C41E3A 0%, #E63946 100%)' }}
          >
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            <div className="relative space-y-1">
              <div className="text-4xl">🫓</div>
              <div>
                <h2 className="text-2xl font-black text-white" style={{ fontFamily: 'Syne, serif' }}>
                  Arepa Lovers
                </h2>
                <p className="text-red-200 text-sm font-medium">Comida venezolana auténtica</p>
              </div>
            </div>
          </button>

          {/* Smash Lovers */}
          <button
            onClick={() => selectMarca('SMASH')}
            disabled={loading}
            className="w-full group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #0052CC 0%, #0066FF 100%)' }}
          >
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            <div className="relative space-y-1">
              <div className="text-4xl">🍔</div>
              <div>
                <h2 className="text-2xl font-black text-white" style={{ fontFamily: 'Syne, serif' }}>
                  Smash Lovers
                </h2>
                <p className="text-blue-200 text-sm font-medium">Smash burgers de autor</p>
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="text-center">
          <button
            onClick={() => {
              localStorage.clear()
              router.push('/auth/login')
            }}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </main>
  )
}
