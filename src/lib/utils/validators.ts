// ============================================================
// Validators — shared across client and server
// ============================================================

export function validateDRPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 10 && /^(809|829|849|809)/.test(digits)
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validateCardNumber(numero: string): boolean {
  const digits = numero.replace(/\s/g, '')
  if (digits.length < 15 || digits.length > 16) return false
  // Luhn algorithm
  let sum = 0
  let isEven = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10)
    if (isEven) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    isEven = !isEven
  }
  return sum % 10 === 0
}

export function validateCardExpiry(expiry: string): boolean {
  const [mm, yy] = expiry.split('/')
  if (!mm || !yy) return false
  const month = parseInt(mm, 10)
  const year = parseInt(yy, 10)
  if (month < 1 || month > 12) return false
  const now = new Date()
  const exp = new Date(2000 + year, month - 1, 1)
  return exp >= now
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Mínimo 8 caracteres'
  if (!/[A-Z]/.test(password)) return 'Debe incluir al menos una mayúscula'
  if (!/[0-9]/.test(password)) return 'Debe incluir al menos un número'
  return null
}

export function sanitizeText(input: string, maxLen = 500): string {
  return input.trim().slice(0, maxLen)
}

export function formatCardNumber(value: string): string {
  return value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ')
}

export function formatCardExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length >= 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return digits
}

export function formatDRPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
}
