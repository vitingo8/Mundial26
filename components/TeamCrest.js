'use client'

import { useEffect, useState } from 'react'

function CrestPlaceholder({ size }) {
  return (
    <span
      className="team-crest-placeholder"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--border)',
        display: 'inline-block',
        flexShrink: 0,
      }}
      aria-hidden
    />
  )
}

export default function TeamCrest({ src, alt = '', size = 24 }) {
  const cleanSrc = typeof src === 'string' ? src.trim() : src
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [cleanSrc])

  if (!cleanSrc || failed) {
    return <CrestPlaceholder size={size} />
  }

  return (
    <img
      src={cleanSrc}
      alt={alt}
      width={size}
      height={size}
      className="team-crest-img"
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        flexShrink: 0,
      }}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}
