'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AdminUser } from '@/types'

const supabase = createClient()

export default function AdminUsersPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', nombre: '', password: '', rol: 'SECUNDARIO' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { loadAdmins() }, [])

  async function loadAdmins() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: me } = await supabase.from('admin_users').select('*').eq('id', user.id).single()
    setCurrentUser(me)

    const { data } = await supabase.from('admin_users').select('*').order('created_at')
    setAdmins(data as AdminUser[] || [])
    setLoading(false)
  }

  async function createAdmin() {
    if (!form.email || !form.nombre || !form.password) { setError('Todos los campos son requeridos'); return }
    if (form.password.length < 8) { setError('La contraseña debe tener mínimo 8 caracteres'); return }

    setSaving(true); setError('')

    // Use service API route to create user (can't use service role from client)
    const res = await fetch('/api/admin/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()

    if (!res.ok) { setError(data.error || 'Error al crear admin'); setSaving(false); return }

    setSuccess(`Admin ${form.nombre} creado exitosamente`)
    setShowForm(false)
    setForm({ email: '', nombre: '', password: '', rol: 'SECUNDARIO' })
    await loadAdmins()
    setSaving(false)
    setTimeout(() => setSuccess(''), 4000)
  }

  async function toggleAdmin(admin: AdminUser) {
    await supabase.from('admin_users').update({ activo: !admin.activo }).eq('id', admin.id)
    setAdmins(prev => prev.map(a => a.id === admin.id ? { ...a, activo: !a.activo } : a))
  }

  if (currentUser?.rol !== 'PRINCIPAL') {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-4xl mb-2">🔒</p>
          <p className="text-gray-500">Solo el admin principal puede gestionar usuarios</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-black text-lg" style={{ fontFamily: 'Syne, serif' }}>👥 Administradores</h1>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold">
            + Nuevo admin
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700 font-semibold">
            ✅ {success}
          </div>
        )}

        {/* Permissions reference */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h2 className="font-black text-sm mb-3" style={{ fontFamily: 'Syne, serif' }}>Permisos por rol</h2>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="font-bold text-gray-700 mb-1">🔑 PRINCIPAL</p>
              <ul className="space-y-0.5 text-gray-500">
                {['Todo lo anterior', 'Stats y analytics', 'Configuración', 'Gestión de menú', 'Colores de marca', 'Crear admins', 'Influencers', 'Recordatorios'].map(p => (
                  <li key={p}>✅ {p}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-bold text-gray-700 mb-1">👤 SECUNDARIO</p>
              <ul className="space-y-0.5 text-gray-500">
                {['Ver pedidos activos', 'Aceptar/Cancelar pedidos', 'Marcar listo', 'Pedir repartidor', 'Imprimir comanda', 'Ver historial propio'].map(p => (
                  <li key={p}>✅ {p}</li>
                ))}
                {['Stats', 'Config', 'Menú', 'Admins'].map(p => (
                  <li key={p} className="line-through opacity-40">❌ {p}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Admins list */}
        {loading ? (
          <div className="text-center py-8 text-gray-400">Cargando...</div>
        ) : (
          <div className="space-y-3">
            {admins.map(admin => (
              <div key={admin.id} className={`bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between gap-3 ${!admin.activo ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-black text-gray-600">
                    {admin.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-gray-900">{admin.nombre}</p>
                      {admin.id === currentUser?.id && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Tú</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{admin.email}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${admin.rol === 'PRINCIPAL' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {admin.rol}
                    </span>
                  </div>
                </div>
                {admin.id !== currentUser?.id && (
                  <button
                    onClick={() => toggleAdmin(admin)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${admin.activo ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                  >
                    {admin.activo ? 'Desactivar' : 'Activar'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create admin modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-black" style={{ fontFamily: 'Syne, serif' }}>Nuevo administrador</h2>
              <button onClick={() => { setShowForm(false); setError('') }} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-4 space-y-3">
              {[
                { label: 'Nombre completo', key: 'nombre', type: 'text', placeholder: 'Jenny García' },
                { label: 'Email', key: 'email', type: 'email', placeholder: 'jenny@arepa-smash.com' },
                { label: 'Contraseña temporal', key: 'password', type: 'password', placeholder: 'Mín. 8 caracteres' },
              ].map(f => (
                <div key={f.key} className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">{f.label}</label>
                  <input type={f.type} placeholder={f.placeholder}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors"
                  />
                </div>
              ))}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Rol</label>
                <select value={form.rol} onChange={e => setForm(p => ({ ...p, rol: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors">
                  <option value="SECUNDARIO">Secundario (limitado)</option>
                  <option value="PRINCIPAL">Principal (acceso total)</option>
                </select>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button onClick={createAdmin} disabled={saving}
                className="w-full py-3.5 rounded-xl bg-gray-900 text-white font-bold disabled:opacity-50">
                {saving ? 'Creando...' : 'Crear administrador'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
