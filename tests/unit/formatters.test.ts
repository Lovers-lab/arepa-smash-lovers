import {
  formatRD,
  timeAgo,
  formatOrderNumber,
  calculateLoyaltyEarned,
  calculateShipping,
  calculate2x1Discount,
  truncate,
} from '@/lib/utils/formatters'

describe('formatRD', () => {
  it('formats whole amounts', () => {
    expect(formatRD(500)).toBe('RD$500')
    expect(formatRD(1000)).toBe('RD$1,000')
    expect(formatRD(12500)).toBe('RD$12,500')
  })

  it('formats zero', () => {
    expect(formatRD(0)).toBe('RD$0')
  })
})

describe('formatOrderNumber', () => {
  it('pads with leading zeros', () => {
    expect(formatOrderNumber(1)).toBe('#0001')
    expect(formatOrderNumber(521)).toBe('#0521')
    expect(formatOrderNumber(1200)).toBe('#1200')
  })
})

describe('calculateLoyaltyEarned', () => {
  it('calculates RD$10 = 1 punto', () => {
    expect(calculateLoyaltyEarned(500)).toBe(50)
    expect(calculateLoyaltyEarned(295)).toBe(29)
    expect(calculateLoyaltyEarned(1000)).toBe(100)
  })

  it('floors partial amounts', () => {
    expect(calculateLoyaltyEarned(105)).toBe(10)
    expect(calculateLoyaltyEarned(9)).toBe(0)
  })
})

describe('calculateShipping', () => {
  it('returns 0 when over umbral', () => {
    expect(calculateShipping(1000)).toBe(0)
    expect(calculateShipping(1500)).toBe(0)
    expect(calculateShipping(1000, 1000, 50)).toBe(0)
  })

  it('charges shipping when under umbral', () => {
    expect(calculateShipping(999)).toBe(50)
    expect(calculateShipping(500)).toBe(50)
    expect(calculateShipping(0)).toBe(50)
  })

  it('uses custom umbral and costo', () => {
    expect(calculateShipping(800, 1000, 75)).toBe(75)
    expect(calculateShipping(1000, 800, 75)).toBe(0)
  })
})

describe('calculate2x1Discount', () => {
  it('discounts cheapest of two main dishes', () => {
    const items = [
      { precio: 300, isMainDish: true },
      { precio: 250, isMainDish: true },
    ]
    expect(calculate2x1Discount(items)).toBe(250)
  })

  it('handles multiple items — discounts second most expensive', () => {
    const items = [
      { precio: 400, isMainDish: true },
      { precio: 250, isMainDish: true },
      { precio: 350, isMainDish: true },
      { precio: 100, isMainDish: false },
    ]
    // Sorted desc: 400, 350, 250 → discount 350
    expect(calculate2x1Discount(items)).toBe(350)
  })

  it('returns 0 with fewer than 2 main dishes', () => {
    expect(calculate2x1Discount([{ precio: 300, isMainDish: true }])).toBe(0)
    expect(calculate2x1Discount([])).toBe(0)
    expect(calculate2x1Discount([{ precio: 300, isMainDish: false }, { precio: 200, isMainDish: false }])).toBe(0)
  })
})

describe('truncate', () => {
  it('truncates long strings', () => {
    expect(truncate('Hello world', 5)).toBe('Hello...')
  })

  it('does not truncate short strings', () => {
    expect(truncate('Hi', 10)).toBe('Hi')
    expect(truncate('Hello', 5)).toBe('Hello')
  })
})
