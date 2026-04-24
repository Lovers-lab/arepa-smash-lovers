import type { Metadata, Viewport } from 'next'
import { Outfit, Plus_Jakarta_Sans } from 'next/font/google'
import '@/styles/globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'Arepa & Smash Lovers', template: '%s | Lovers Kitchen' },
  description: 'Tequeños gratis en tu primera compra. Delivery en Santo Domingo.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Lovers' },
}

export const viewport: Viewport = {
  themeColor: '#C41E3A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${outfit.variable} ${jakarta.variable}`}>
      <ServiceWorkerRegister />
      <body>{children}</body>
    </html>
  )
}
