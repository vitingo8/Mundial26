'use client'

export default function InviteQr({ url, size = 160 }) {
  if (!url) return null
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`
  return (
    <img
      src={qrSrc}
      alt="Código QR de invitación"
      width={size}
      height={size}
      style={{ display: 'block', margin: '12px auto 0', borderRadius: 8 }}
      loading="lazy"
    />
  )
}
