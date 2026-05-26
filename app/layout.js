import './globals.css'
import '../styles/responsive.css'
import '../styles/dashboard.css'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Porra Mundial 2026',
  description: 'La porra definitiva del Mundial 2026 · USA · CAN · MEX',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
  themeColor: '#49a942',
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
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>{children}</body>
    </html>
  )
}
