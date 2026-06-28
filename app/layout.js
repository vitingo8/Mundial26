import './globals.css'
import '../styles/responsive.css'
import '../styles/dashboard.css'
import { Analytics } from '@vercel/analytics/next'
import PwaRegister from '../components/PwaRegister'
import SiteFooter from '../components/SiteFooter'
import LiveFloatingButtons from '../components/LiveFloatingButtons'
import { WcMatchesProvider } from '../hooks/useWcMatches'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Porra Mundial 2026',
  description: 'La porra definitiva del Mundial 2026 · USA · CAN · MEX',
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

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#49a942',
}

const CRITICAL_MOBILE_CSS = `
@media (max-width:767px){
  .bottom-nav,.dash-main-nav.bottom-nav{display:flex!important}
  .tab-bar-desktop,.dash-tabs.tab-bar-desktop{display:none!important}
}
@media (min-width:768px){
  .bottom-nav,.dash-main-nav.bottom-nav{display:none!important}
  .tab-bar-desktop,.dash-tabs.tab-bar-desktop{display:flex!important}
}
`

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <style dangerouslySetInnerHTML={{ __html: CRITICAL_MOBILE_CSS }} />
      </head>
      <body>
        <WcMatchesProvider>
          <PwaRegister />
          {children}
          <LiveFloatingButtons />
          <SiteFooter />
          {process.env.VERCEL === '1' && <Analytics />}
        </WcMatchesProvider>
      </body>
    </html>
  )
}
