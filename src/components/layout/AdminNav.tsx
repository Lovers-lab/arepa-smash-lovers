'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/admin/dashboard',              icon: '📊', label: 'Dashboard' },
  { href: '/admin/orders',                 icon: '📋', label: 'Historial' },
  { href: '/admin/products',               icon: '📦', label: 'Menú' },
  { href: '/admin/marketing',              icon: '🎨', label: 'Colores' },
  { href: '/admin/marketing/influencers',  icon: '🎤', label: 'Influencers' },
  { href: '/admin/marketing/push',          icon: '🔔', label: 'Push' },
  { href: '/admin/delivery-zones',         icon: '📍', label: 'Zonas' },
  { href: '/admin/reminders',              icon: '📅', label: 'Pagos' },
  { href: '/admin/settings',               icon: '⚙️', label: 'Config' },
  { href: '/admin/settings/banks',          icon: '🏦', label: 'Bancos' },
  { href: '/admin/settings/users',         icon: '👥', label: 'Usuarios' },
]

export default function AdminNav() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-56 bg-white border-r border-gray-200 z-40">
        <div className="p-4 border-b border-gray-100">
          <p className="font-black text-base" style={{ fontFamily: 'Syne, serif' }}>🫓🍔 Admin</p>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {NAV_ITEMS.map(item => (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors hover:bg-gray-50 ${pathname === item.href ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}>
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 flex overflow-x-auto">
        {NAV_ITEMS.map(item => (
          <Link key={item.href} href={item.href}
            className={`flex flex-col items-center gap-0.5 px-3 py-2 text-xs font-semibold shrink-0 transition-colors ${pathname === item.href ? 'text-gray-900' : 'text-gray-400'}`}>
            <span className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
// Fri Apr 24 08:29:22 AST 2026
