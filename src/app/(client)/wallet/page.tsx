'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function WalletRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/profile') }, [])
  return null
}
