'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const GROUPS = [
  {
    label: 'Operaciones',
    items: [
      { href: '/admin/dashboard',             label: 'Dashboard',     icon: 'dashboard' },
      { href: '/admin/orders',                label: 'Historial',     icon: 'receipt_long' },
      { href: '/admin/clientes',              label: 'Clientes',      icon: 'group' },
      { href: '/admin/reviews',               label: 'Reseñas',       icon: 'star' },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      { href: '/admin/products',              label: 'Menú',          icon: 'menu_book' },
      { href: '/admin/delivery-zones',        label: 'Zonas',         icon: 'pin_drop' },
      { href: '/admin/reminders',             label: 'Pagos',         icon: 'payments' },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { href: '/admin/marketing',             label: 'Colores',       icon: 'palette' },
      { href: '/admin/marketing/influencers', label: 'Influencers',   icon: 'star_person' },
      { href: '/admin/marketing/push',        label: 'Notif. Push',   icon: 'notifications' },
      { href: '/admin/coupons',               label: 'Cupones',       icon: 'confirmation_number' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/admin/settings',              label: 'Config',        icon: 'settings' },
      { href: '/admin/settings/banks',        label: 'Bancos',        icon: 'account_balance' },
      { href: '/admin/settings/users',        label: 'Usuarios',      icon: 'manage_accounts' },
    ],
  },
]

const MOBILE_ITEMS = [
  { href: '/admin/dashboard',  label: 'Pedidos',   icon: 'dashboard' },
  { href: '/admin/orders',     label: 'Historial', icon: 'receipt_long' },
  { href: '/admin/products',   label: 'Menú',      icon: 'menu_book' },
  { href: '/admin/clientes',   label: 'Clientes',  icon: 'group' },
  { href: '/admin/reviews',    label: 'Reseñas',   icon: 'star' },
  { href: '/admin/coupons',   label: 'Cupones',   icon: 'confirmation_number' },
  { href: '/admin/settings',   label: 'Config',    icon: 'settings' },
]

function MIcon({ name, size = 20, color }: { name: string; size?: number; color?: string }) {
  return (
    <span className="material-symbols-rounded" style={{
      fontSize: size,
      color: color || 'inherit',
      lineHeight: 1,
      userSelect: 'none',
      fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
    }}>
      {name}
    </span>
  )
}

export default function AdminNav() {
  const pathname = usePathname()

  return (
    <>
      {/* Material Symbols font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
      />

      <style>{`
        .anav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; border-radius: 10px; margin: 1px 8px;
          font-size: 13px; font-weight: 500; color: #6B7280;
          text-decoration: none; transition: all 0.15s; cursor: pointer;
          white-space: nowrap;
        }
        .anav-item:hover { background: #F3F4F6; color: #111827; }
        .anav-item.active { background: #FEF2F2; color: #C41E3A; font-weight: 700; }
        .anav-item.active .anav-icon { background: #FEE2E2; }
        .anav-icon {
          width: 34px; height: 34px; border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; background: #F9FAFB; transition: background 0.15s;
        }
        .anav-group-label {
          font-size: 10px; font-weight: 700; color: #C4C9D4;
          letter-spacing: 0.8px; text-transform: uppercase;
          padding: 16px 20px 5px; margin: 0;
        }
        .material-symbols-rounded { font-family: 'Material Symbols Rounded'; font-style: normal; display: inline-block; }
      `}</style>

      {/* ── DESKTOP SIDEBAR ── */}
      <nav style={{
        display: 'none', flexDirection: 'column',
        position: 'fixed', left: 0, top: 0, bottom: 0, width: '220px',
        background: 'white', borderRight: '1px solid #F0F2F5',
        zIndex: 40, overflowY: 'auto',
      }} className="admin-sidebar">
        <style>{`@media(min-width:1024px){.admin-sidebar{display:flex!important}}`}</style>

        {/* Logo */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '3px' }}>
              <img src="/logos/logo-arepa.png" style={{ width: '26px', height: '26px', borderRadius: '7px', objectFit: 'cover' }} alt="" />
              <img src="/logos/logo-smash.png" style={{ width: '26px', height: '26px', borderRadius: '7px', objectFit: 'cover' }} alt="" />
            </div>
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '14px', color: '#111827', margin: 0, lineHeight: 1 }}>Lovers</p>
              <p style={{ fontSize: '10px', color: '#9CA3AF', margin: '2px 0 0' }}>Panel Admin</p>
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <div style={{ flex: 1, paddingBottom: '12px' }}>
          {GROUPS.map(group => (
            <div key={group.label}>
              <p className="anav-group-label">{group.label}</p>
              {group.items.map(item => {
                const isActive = pathname === item.href
                return (
                  <Link key={item.href} href={item.href} className={`anav-item${isActive ? ' active' : ''}`}>
                    <span className="anav-icon">
                      <MIcon name={item.icon} size={18} color={isActive ? '#C41E3A' : '#9CA3AF'} />
                    </span>
                    {item.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid #F3F4F6' }}>
          <p style={{ fontSize: '10px', color: '#D1D5DB', textAlign: 'center', margin: 0 }}>
            Arepa & Smash Lovers © 2026
          </p>
        </div>
      </nav>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'white', borderTop: '1px solid #F0F2F5',
        zIndex: 40, display: 'flex',
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -1px 12px rgba(0,0,0,0.06)',
      }} className="admin-mobile-nav">
        <style>{`@media(min-width:1024px){.admin-mobile-nav{display:none!important}}`}</style>
        {MOBILE_ITEMS.map(item => {
          const isActive = pathname === item.href ||
            (item.href !== '/admin/dashboard' && pathname?.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '3px', padding: '10px 4px 8px', textDecoration: 'none',
              color: isActive ? '#C41E3A' : '#9CA3AF', transition: 'color 0.15s',
            }}>
              <span className="material-symbols-rounded" style={{
                fontSize: 24,
                fontVariationSettings: isActive
                  ? "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24"
                  : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
              }}>
                {item.icon}
              </span>
              <span style={{ fontSize: '10px', fontWeight: isActive ? 700 : 500 }}>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
