'use client'

import { useEffect, useState } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Order, OrderStatus, Marca } from '@/types'

const supabase = createAdminClient()
function formatRD(n: number) { return `RD$${n.toLocaleString('es-DO')}` }

const STATUS_LABELS: Partial<Record<OrderStatus, string>> = {
  ENTREGADO: '✅ Entregado', CANCELADO: '❌ Cancelado', EN_CAMINO: '🛵 En camino',
  PAGADO: '💳 Pagado', EN_COCINA: '🍳 En cocina', LISTO: '✓ Listo', PENDIENTE: '⏳ Pendiente'
}

export default function AdminHistorialPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20

  // Filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('TODOS')
  const [marcaFilter, setMarcaFilter] = useState<string>('TODAS')
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [page, statusFilter, marcaFilter, dateFrom, dateTo])

  async function load() {
    setLoading(true)
    let query = supabase
      .from('orders')
      .select('*, user:users(nombre, whatsapp)', { count: 'exact' })
      .order('fecha_orden', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (statusFilter !== 'TODOS') query = query.eq('estado', statusFilter)
    if (marcaFilter !== 'TODAS') query = query.eq('marca', marcaFilter)
    if (dateFrom) query = query.gte('fecha_orden', dateFrom)
    if (dateTo) query = query.lte('fecha_orden', dateTo + 'T23:59:59')
    if (search) query = query.ilike('users.nombre', `%${search}%`)

    const { data, count } = await query
    setOrders(data as Order[] || [])
    setTotal(count || 0)
    setLoading(false)
  }

  const totalIngresos = orders.filter(o => o.estado === 'ENTREGADO').reduce((acc, o) => acc + o.total_pagado, 0)

  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <h1 className="font-black text-lg" style={{ fontFamily: 'Syne, serif' }}>📋 Historial de Pedidos</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4 space-y-4">
        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Desde</label>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0) }}
              className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-900 transition-colors" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Hasta</label>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0) }}
              className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-900 transition-colors" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Estado</label>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
              className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-900 transition-colors">
              <option value="TODOS">Todos</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Marca</label>
            <select value={marcaFilter} onChange={e => { setMarcaFilter(e.target.value); setPage(0) }}
              className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-900 transition-colors">
              <option value="TODAS">Todas</option>
              <option value="AREPA">🫓 Arepa Lovers</option>
              <option value="SMASH">🍔 Smash Lovers</option>
            </select>
          </div>
          <button onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter('TODOS'); setMarcaFilter('TODAS'); setPage(0) }}
            className="px-4 py-2 bg-gray-100 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-200 transition-colors">
            Limpiar
          </button>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="font-black text-xl">{total}</p>
            <p className="text-xs text-gray-400">Pedidos</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="font-black text-xl">{orders.filter(o => o.estado === 'ENTREGADO').length}</p>
            <p className="text-xs text-gray-400">Entregados</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="font-black text-xl text-green-600">{formatRD(totalIngresos)}</p>
            <p className="text-xs text-gray-400">Ingresos</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Cargando...</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No hay pedidos con esos filtros</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['#', 'Cliente', 'Marca', 'Monto', 'Estado', 'Pago', 'Fecha'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.map(order => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-black">#{order.numero_pedido}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{(order.user as any)?.nombre || '—'}</p>
                        <p className="text-xs text-gray-400">{(order.user as any)?.whatsapp}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${order.marca === 'AREPA' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                          {order.marca === 'AREPA' ? '🫓' : '🍔'} {order.marca}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold">{formatRD(order.total_pagado)}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold">{STATUS_LABELS[order.estado] || order.estado}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{order.metodo_pago}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(order.fecha_orden).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}
                        {' '}
                        {new Date(order.fecha_orden).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm font-semibold disabled:opacity-40">← Anterior</button>
                <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total}
                  className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm font-semibold disabled:opacity-40">Siguiente →</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
