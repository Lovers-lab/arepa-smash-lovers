import {
  validateDRPhone,
  validateEmail,
  validateCardNumber,
  validateCardExpiry,
  formatDRPhone,
  formatCardNumber,
  formatCardExpiry,
} from '@/lib/utils/validators'

describe('validateDRPhone', () => {
  it('accepts valid 809 numbers', () => {
    expect(validateDRPhone('8095551234')).toBe(true)
    expect(validateDRPhone('809-555-1234')).toBe(true)
  })

  it('accepts 829 and 849 area codes', () => {
    expect(validateDRPhone('8295551234')).toBe(true)
    expect(validateDRPhone('8495551234')).toBe(true)
  })

  it('rejects short numbers', () => {
    expect(validateDRPhone('809555')).toBe(false)
  })

  it('rejects numbers with wrong length', () => {
    expect(validateDRPhone('80955512345')).toBe(false)
  })
})

describe('validateEmail', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('juan@gmail.com')).toBe(true)
    expect(validateEmail('admin@arepa-smash.com')).toBe(true)
  })

  it('rejects invalid emails', () => {
    expect(validateEmail('notanemail')).toBe(false)
    expect(validateEmail('@missing.com')).toBe(false)
    expect(validateEmail('missing@')).toBe(false)
  })
})

describe('validateCardNumber (Luhn)', () => {
  it('accepts valid Visa test number', () => {
    expect(validateCardNumber('4111111111111111')).toBe(true)
  })

  it('accepts valid Mastercard test number', () => {
    expect(validateCardNumber('5500005555555559')).toBe(true)
  })

  it('rejects invalid card numbers', () => {
    expect(validateCardNumber('1234567890123456')).toBe(false)
    expect(validateCardNumber('123')).toBe(false)
  })
})

describe('validateCardExpiry', () => {
  it('accepts future dates', () => {
    const futureYear = new Date().getFullYear() + 2
    expect(validateCardExpiry(`01/${String(futureYear).slice(-2)}`)).toBe(true)
  })

  it('rejects past dates', () => {
    expect(validateCardExpiry('01/20')).toBe(false)
  })

  it('rejects invalid months', () => {
    expect(validateCardExpiry('13/99')).toBe(false)
    expect(validateCardExpiry('00/99')).toBe(false)
  })
})

describe('formatDRPhone', () => {
  it('formats 10 digits correctly', () => {
    expect(formatDRPhone('8095551234')).toBe('809-555-1234')
  })

  it('handles partial input', () => {
    expect(formatDRPhone('809')).toBe('809')
    expect(formatDRPhone('809555')).toBe('809-555')
  })
})

describe('formatCardNumber', () => {
  it('adds spaces every 4 digits', () => {
    expect(formatCardNumber('4111111111111111')).toBe('4111 1111 1111 1111')
  })
})

describe('formatCardExpiry', () => {
  it('adds slash after month', () => {
    expect(formatCardExpiry('0128')).toBe('01/28')
  })
})
