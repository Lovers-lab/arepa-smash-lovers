import type { Metadata } from 'next'
import AdminNav from '@/components/layout/AdminNav'

export const metadata: Metadata = { title: 'Admin — Lovers Kitchen' }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col lg:flex-row">
      <AdminNav />
      <main className="flex-1 min-w-0 lg:ml-56">{children}</main>
    </div>
  )
}
