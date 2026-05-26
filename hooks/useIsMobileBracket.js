'use client'

import { useEffect, useState } from 'react'

const MQ = '(max-width: 899px)'

export function useIsMobileBracket() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(MQ).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(MQ)
    const sync = () => setMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return mobile
}
