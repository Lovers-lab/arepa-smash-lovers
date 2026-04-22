'use client'

// BankSelector component — shown in checkout when client chooses Transferencia
// Fetches all active bank accounts and lets client copy the number

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface BankAccount {
  id: string
  banco_nombre: string
  banco_tipo: string
  banco_cuenta: string
  banco_titular: string
  banco_ruc?: string
  instrucciones?: string
}

interface BankSelectorProps {
  marca: string
  totalAPagar: number
  brandColor: string
  onBankSelected: (bank: BankAccount) => void
  selectedBankId?: string
}

const supabase = createClient()

const BANK_COLORS: Record<string, string> = {
  'Banco León': '#E8B800',
  'BHD León': '#E8B800',
  'Banco Popular': '#C41E3A',
  'Banreservas': '#1A5276',
  'Scotiabank': '#C0392B',
  'Promerica': '#1E8449',
}

export default function BankSelector({ marca, totalAPagar, brandColor, onBankSelected, selectedBankId }: BankSelectorProps) {
  const [banks, setBanks] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    loadBanks()
  }, [marca])

  async function loadBanks() {
    const { data } = await supabase
      .from('bank_accounts')
      .select('*')
      .in('marca', [marca, 'AMBAS'])
      .eq('activo', true)
      .order('orden')
    setBanks(data as BankAccount[] || [])
    setLoading(false)
  }

  function copyNumber(bank: BankAccount) {
    navigator.clipboard.writeText(bank.banco_cuenta)
    setCopied(bank.id)
    setTimeout(() => setCopied(null), 2500)
    onBankSelected(bank)
  }

  if (loading) return <p style={{ textAlign: 'center', color: '#9CA3AF', padding: '20px', fontSize: '14px' }}>Cargando bancos...</p>

  if (banks.length === 0) return (
    <div style={{ textAlign: 'center', padding: '20px', color: '#9CA3AF', fontSize: '13px' }}>
      No hay cuentas bancarias configuradas
    </div>
  )

  return (
    <div>
      <p style={{ fontSize: '13px', fontWeight: 700, color: '#6B7280', marginBottom: '12px' }}>
        Elige tu banco y copia el número:
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: banks.length > 1 ? '1fr 1fr' : '1fr', gap: '10px', marginBottom: '16px' }}>
        {banks.map(bank => {
          const isSelected = selectedBankId === bank.id
          const isCopied = copied === bank.id
          const bankColor = BANK_COLORS[bank.banco_nombre] || brandColor

          return (
            <div key={bank.id} style={{
              background: isSelected ? `${brandColor}08` : '#F7F8FA',
              border: `2px solid ${isSelected ? brandColor : '#E4E6EA'}`,
              borderRadius: '16px',
              padding: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}>
              {/* Bank name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: bankColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>
                  🏦
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '13px', lineHeight: 1.2 }}>{bank.banco_nombre}</div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{bank.banco_tipo}</div>
                </div>
              </div>

              {/* Account number */}
              <div style={{ background: 'white', borderRadius: '10px', padding: '10px', border: '1px solid #E4E6EA', marginBottom: '8px' }}>
                <div style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 800, letterSpacing: '0.5px', color: '#0D0F12' }}>
                  {bank.banco_cuenta}
                </div>
                <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>{bank.banco_titular}</div>
              </div>

              {/* Copy button */}
              <button onClick={() => copyNumber(bank)}
                style={{
                  width: '100%', padding: '10px',
                  background: isCopied ? '#DCFCE7' : brandColor,
                  color: isCopied ? '#15803D' : 'white',
                  border: 'none', borderRadius: '10px',
                  fontSize: '13px', fontWeight: 800,
                  cursor: 'pointer', transition: 'all 0.2s',
                  fontFamily: 'var(--font-body)',
                }}>
                {isCopied ? '✓ ¡Número copiado!' : '📋 Copiar número'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Amount to transfer */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(196,30,58,0.06), rgba(230,57,70,0.03))',
        border: `1.5px solid ${brandColor}25`,
        borderRadius: '14px',
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        <div>
          <div style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 600 }}>Monto EXACTO a transferir</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 800, color: brandColor }}>
            RD${totalAPagar.toLocaleString('es-DO')}
          </div>
        </div>
        <button onClick={() => { navigator.clipboard.writeText(String(totalAPagar)) }}
          style={{ padding: '8px 14px', background: 'white', border: `1.5px solid ${brandColor}30`, borderRadius: '10px', fontSize: '12px', fontWeight: 700, color: brandColor, cursor: 'pointer' }}>
          Copiar monto
        </button>
      </div>

      {/* Instructions if any bank has them */}
      {banks.find(b => b.id === selectedBankId)?.instrucciones && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px', padding: '12px 14px', fontSize: '13px', color: '#92400E' }}>
          📌 {banks.find(b => b.id === selectedBankId)?.instrucciones}
        </div>
      )}
    </div>
  )
}
