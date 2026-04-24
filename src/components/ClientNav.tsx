'use client'
import { useRouter } from 'next/navigation'

interface Props {
  title?: string
  showBack?: boolean
  showHome?: boolean
  brandColor?: string
}

export default function ClientNav({ title, showBack = true, showHome = true, brandColor = '#C41E3A' }: Props) {
  const router = useRouter()
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'12px 16px', background:'white', borderBottom:'1px solid #F3F4F6', position:'sticky', top:0, zIndex:50 }}>
      {showBack && (
        <button onClick={() => router.back()}
          style={{ width:'36px', height:'36px', borderRadius:'50%', border:'none', background:'#F3F4F6', cursor:'pointer', fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          ‹
        </button>
      )}
      {title && (
        <span style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'16px', flex:1 }}>{title}</span>
      )}
      {showHome && (
        <button onClick={() => router.push('/')}
          style={{ width:'36px', height:'36px', borderRadius:'50%', border:'none', background:'#F3F4F6', cursor:'pointer', fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginLeft:'auto' }}>
          🏠
        </button>
      )}
    </div>
  )
}
