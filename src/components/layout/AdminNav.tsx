'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const GROUPS = [
  {
    label: 'Operaciones',
    items: [
      { href: '/admin/dashboard',   label: 'Dashboard',    icon: '▦' },
      { href: '/admin/orders',      label: 'Historial',    icon: '↗' },
      { href: '/admin/clientes',    label: 'Clientes',     icon: '○' },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      { href: '/admin/products',    label: 'Menú',         icon: '◈' },
      { href: '/admin/delivery-zones', label: 'Zonas',     icon: '◎' },
      { href: '/admin/reminders',   label: 'Pagos',        icon: '◇' },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { href: '/admin/marketing',           label: 'Colores',      icon: '◐' },
      { href: '/admin/marketing/influencers', label: 'Influencers', icon: '◉' },
      { href: '/admin/marketing/push',      label: 'Notif. Push',  icon: '◈' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/admin/settings',        label: 'Config',   icon: '◫' },
      { href: '/admin/settings/banks',  label: 'Bancos',   icon: '◪' },
      { href: '/admin/settings/users',  label: 'Usuarios', icon: '◯' },
    ],
  },
]

// Para el nav móvil — solo los más usados
const MOBILE_ITEMS = [
  { href: '/admin/dashboard',  label: 'Pedidos',  svg: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/admin/orders',     label: 'Historial',svg: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { href: '/admin/products',   label: 'Menú',     svg: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { href: '/admin/clientes',   label: 'Clientes', svg: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { href: '/admin/settings',   label: 'Config',   svg: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

export default function AdminNav() {
  const pathname = usePathname()

  return (
    <>
      <style>{`
        .anav-item { display:flex; align-items:center; gap:10px; padding:8px 16px; border-radius:8px; margin:1px 8px; font-size:13px; font-weight:500; color:#6B7280; text-decoration:none; transition:all 0.15s; cursor:pointer; }
        .anav-item:hover { background:#F3F4F6; color:#111827; }
        .anav-item.active { background:#FEF2F2; color:#C41E3A; font-weight:700; }
        .anav-icon { width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:13px; flex-shrink:0; background:#F9FAFB; }
        .anav-item.active .anav-icon { background:#FEE2E2; }
        .anav-group-label { font-size:10px; font-weight:700; color:#9CA3AF; letter-spacing:0.8px; text-transform:uppercase; padding:16px 24px 6px; }
      `}</style>

      {/* DESKTOP SIDEBAR */}
      <nav style={{
        display:'none',
        flexDirection:'column',
        position:'fixed', left:0, top:0, bottom:0, width:'220px',
        background:'white', borderRight:'1px solid #F0F0F0',
        zIndex:40, overflowY:'auto',
      }} className="admin-sidebar">
        <style>{`@media(min-width:1024px){.admin-sidebar{display:flex!important}}`}</style>

        {/* Logo */}
        <div style={{ padding:'20px 20px 12px', borderBottom:'1px solid #F3F4F6' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ display:'flex', gap:'3px' }}>
              <img src="/logos/logo-arepa.png" style={{ width:'26px', height:'26px', borderRadius:'6px' }} alt="" />
              <img src="/logos/logo-smash.png" style={{ width:'26px', height:'26px', borderRadius:'6px' }} alt="" />
            </div>
            <div>
              <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'13px', color:'#111827', margin:0, lineHeight:1 }}>Lovers</p>
              <p style={{ fontSize:'10px', color:'#9CA3AF', margin:0 }}>Panel Admin</p>
            </div>
          </div>
        </div>

        {/* Groups */}
        <div style={{ flex:1, paddingBottom:'16px' }}>
          {GROUPS.map(group => (
            <div key={group.label}>
              <p className="anav-group-label">{group.label}</p>
              {group.items.map(item => {
                const isActive = pathname === item.href
                return (
                  <Link key={item.href} href={item.href} className={`anav-item${isActive ? ' active' : ''}`}>
                    <span className="anav-icon" style={{ fontFamily:'monospace', fontWeight:700, color: isActive ? '#C41E3A' : '#9CA3AF' }}>{item.icon}</span>
                    {item.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding:'12px 16px', borderTop:'1px solid #F3F4F6' }}>
          <p style={{ fontSize:'11px', color:'#D1D5DB', textAlign:'center' }}>Arepa & Smash Lovers © 2026</p>
        </div>
      </nav>

      {/* MOBILE BOTTOM NAV */}
      <nav style={{
        position:'fixed', bottom:0, left:0, right:0,
        background:'white', borderTop:'1px solid #F0F0F0',
        zIndex:40, display:'flex', paddingBottom:'env(safe-area-inset-bottom)',
      }} className="admin-mobile-nav">
        <style>{`@media(min-width:1024px){.admin-mobile-nav{display:none!important}}`}</style>
        {MOBILE_ITEMS.map(item => {
          const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && pathname?.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href} style={{
              flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              gap:'2px', padding:'10px 4px 8px', textDecoration:'none',
              color: isActive ? '#C41E3A' : '#9CA3AF', transition:'color 0.15s',
            }}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={isActive ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d={item.svg} />
              </svg>
              <span style={{ fontSize:'10px', fontWeight: isActive ? 700 : 500 }}>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
