'use client'

/** Logo de la liga / grupo en header y admin */
export default function LeagueLogo({ src, name, size = 32, className = '', placeholder = false }) {
  if (!src) {
    if (!placeholder) return null
    const initial = (name || '?').trim()[0]?.toUpperCase() || '?'
    return (
      <div
        className={`dash-league-logo-placeholder${className ? ` ${className}` : ''}`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
        aria-hidden={!name}
      >
        {initial}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={name ? `Logo ${name}` : 'Logo de la liga'}
      className={`dash-league-logo${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
    />
  )
}
