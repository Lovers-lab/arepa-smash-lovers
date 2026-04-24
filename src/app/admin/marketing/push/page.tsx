'use client'
import { useState } from 'react'

export default function PushPage() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('/')
  const [marca, setMarca] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function send() {
    if (!title.trim() || !body.trim()) { setResult('Escribe título y mensaje'); return }
    setSending(true); setResult(null)
    const res = await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, url, marca: marca || undefined })
    })
    const data = await res.json()
    setResult(`Enviado a ${data.sent} cliente${data.sent !== 1 ? 's' : ''}`)
    setSending(false)
  }

  const bc = '#C41E3A'

  return (
    <div style={{ minHeight:'100dvh', background:'#F7F8FA', fontFamily:'var(--font-body)' }}>
      <header style={{ background:'white', borderBottom:'1px solid #E4E6EA', padding:'16px 20px', position:'sticky', top:0, zIndex:20 }}>
        <h1 style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'20px', margin:0 }}>🔔 Notificaciones Push</h1>
      </header>
      <div style={{ maxWidth:'520px', margin:'24px auto', padding:'0 16px', display:'flex', flexDirection:'column', gap:'16px' }}>

        <div style={{ background:'white', borderRadius:'20px', padding:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
          <div>
            <label style={{ fontSize:'12px', fontWeight:700, color:'#6B7280', display:'block', marginBottom:'6px' }}>Título *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: 🫓 Oferta especial hoy"
              style={{ width:'100%', border:'2px solid #E4E6EA', borderRadius:'12px', padding:'12px 14px', fontSize:'14px', outline:'none', fontFamily:'var(--font-body)', boxSizing:'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize:'12px', fontWeight:700, color:'#6B7280', display:'block', marginBottom:'6px' }}>Mensaje *</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Ej: 25% OFF en todas las cachapas hoy hasta las 9pm" rows={3}
              style={{ width:'100%', border:'2px solid #E4E6EA', borderRadius:'12px', padding:'12px 14px', fontSize:'14px', outline:'none', resize:'none', fontFamily:'var(--font-body)', boxSizing:'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize:'12px', fontWeight:700, color:'#6B7280', display:'block', marginBottom:'6px' }}>Enlace al tocar (opcional)</label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="/"
              style={{ width:'100%', border:'2px solid #E4E6EA', borderRadius:'12px', padding:'12px 14px', fontSize:'14px', outline:'none', fontFamily:'var(--font-body)', boxSizing:'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize:'12px', fontWeight:700, color:'#6B7280', display:'block', marginBottom:'6px' }}>Enviar a</label>
            <select value={marca} onChange={e => setMarca(e.target.value)}
              style={{ width:'100%', border:'2px solid #E4E6EA', borderRadius:'12px', padding:'12px 14px', fontSize:'14px', outline:'none', background:'white', fontFamily:'var(--font-body)', boxSizing:'border-box' }}>
              <option value="">Todos los clientes</option>
              <option value="AREPA">Solo Arepa Lovers</option>
              <option value="SMASH">Solo Smash Lovers</option>
            </select>
          </div>

          {result && (
            <div style={{ background: result.includes('Error') ? '#FEF2F2' : '#DCFCE7', color: result.includes('Error') ? '#DC2626' : '#15803D', padding:'12px 14px', borderRadius:'12px', fontSize:'13px', fontWeight:700 }}>
              {result}
            </div>
          )}

          <button onClick={send} disabled={sending}
            style={{ width:'100%', padding:'16px', borderRadius:'14px', border:'none', background:sending?'#E4E6EA':bc, color:sending?'#9CA3AF':'white', fontFamily:'var(--font-display)', fontWeight:800, fontSize:'16px', cursor:sending?'not-allowed':'pointer' }}>
            {sending ? 'Enviando...' : '🔔 Enviar notificación'}
          </button>
        </div>

        <div style={{ background:'white', borderRadius:'20px', padding:'16px 20px' }}>
          <p style={{ fontSize:'12px', color:'#9CA3AF', margin:0, lineHeight:1.6 }}>
            💡 Los clientes recibirán la notificación aunque tengan la app cerrada, siempre que hayan dado permiso. En iPhone solo funciona si instalaron la app desde Safari.
          </p>
        </div>
      </div>
    </div>
  )
}
