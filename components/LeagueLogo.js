'use client'

/** Logo de la liga / grupo en header y admin */
export default function LeagueLogo({ src, name, size = 32, className = '' }) {
  if (!src) return null

  return (
    <img
      src={src}
      alt={name ? `Logo ${name}` : 'Logo de la liga'}
      className={`dash-league-logo${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
    />
  )
}
