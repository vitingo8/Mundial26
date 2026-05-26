'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CrearPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/?screen=create')
  }, [router])
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      Redirigiendo…
    </div>
  )
}
