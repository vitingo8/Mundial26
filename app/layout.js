import './globals.css'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Porra Mundial 2026',
  description: 'La porra definitiva del Mundial 2026 · USA · CAN · MEX',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  themeColor: '#0a0a14',
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Porra Mundial 2026',
    description: '¡Únete a la porra del Mundial 2026!',
    type: 'website',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>{children}</body>
    </html>
  )
}
