export default function TeamCrest({ src, alt = '', size = 24 }) {
  if (!src) {
    return (
      <span
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
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        flexShrink: 0,
      }}
      loading="lazy"
    />
  )
}
