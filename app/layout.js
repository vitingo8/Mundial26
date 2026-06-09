import './globals.css'
import '../styles/responsive.css'
import '../styles/dashboard.css'
import { Analytics } from '@vercel/analytics/next'
import PwaRegister from '../components/PwaRegister'
import SiteFooter from '../components/SiteFooter'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Porra Mundial 2026',
  description: 'La porra definitiva del Mundial 2026 · USA · CAN · MEX',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
  themeColor: '#49a942',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Porra 2026',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/logo-wc26.png', type: 'image/png', sizes: '192x192' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
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
      <body>
        <PwaRegister />
        {children}
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  )
}
