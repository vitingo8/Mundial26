'use client'
import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function UnirsePage() {
  const params = useParams()
  const router = useRouter()
  const code = params?.code

  useEffect(() => {
    if (code) router.replace(`/?join=${encodeURIComponent(String(code).toLowerCase())}`)
    else router.replace('/')
  }, [code, router])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      Redirigiendo…
    </div>
  )
}
