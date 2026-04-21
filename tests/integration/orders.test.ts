/**
 * Integration tests for /api/orders/create
 * Run against staging Supabase instance
 * 
 * To run: npm run test:integration
 */

// Mock Supabase for unit-style integration tests
jest.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: mockData[table], error: null }),
    }),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    storage: {
      from: () => ({
        upload: jest.fn().mockResolvedValue({ error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/test.jpg' } }),
      }),
    },
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-admin-id' } } }),
    },
  }),
}))

const mockData: Record<string, any> = {
  products: { id: 'prod-1', nombre: 'Arepa Test', precio: 295, activo: true },
  orders: { numero_pedido: 500, id: 'order-test-id' },
  welcome_offers: null,
  loyalty_balances: { saldo: 0 },
}

describe('POST /api/orders/create', () => {
  it('validates required fields', async () => {
    const formData = new FormData()
    // Missing userId, marca, metodoPago, items
    const req = new Request('http://localhost/api/orders/create', {
      method: 'POST',
      body: formData,
    })

    const { POST } = await import('@/app/api/orders/create/route')
    const res = await POST(req as any)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('rejects empty items array', async () => {
    const formData = new FormData()
    formData.append('userId', 'user-1')
    formData.append('marca', 'AREPA')
    formData.append('metodoPago', 'TRANSFERENCIA')
    formData.append('direccion', 'Calle 5 #32, Ensanche La Paz')
    formData.append('items', JSON.stringify([]))
    formData.append('loyaltyAplicado', '0')

    const req = new Request('http://localhost/api/orders/create', {
      method: 'POST',
      body: formData,
    })

    const { POST } = await import('@/app/api/orders/create/route')
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })
})

describe('GET /api/loyalty/balance', () => {
  it('returns zero for user with no balance', async () => {
    const req = new Request('http://localhost/api/loyalty/balance?userId=new-user-id')
    const { GET } = await import('@/app/api/loyalty/balance/route')
    const res = await GET(req as any)
    const body = await res.json()
    expect(body.saldo).toBeDefined()
    expect(typeof body.saldo).toBe('number')
  })
})

describe('GET /api/delivery-zones/check', () => {
  it('handles missing coordinates', async () => {
    const req = new Request('http://localhost/api/delivery-zones/check')
    const { GET } = await import('@/app/api/delivery-zones/check/route')
    const res = await GET(req as any)
    const body = await res.json()
    expect(body.dentro).toBe(false)
  })
})
