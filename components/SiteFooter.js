const CONTACT_EMAIL = 'hola@vacly.es'

export default function SiteFooter() {
  return (
    <footer className="site-footer" role="contentinfo">
      <span className="site-footer-brand">Porra Mundial 2026</span>
      <span className="site-footer-sep" aria-hidden="true">
        {' '}
        ·{' '}
      </span>
      <a href={`mailto:${CONTACT_EMAIL}`} className="site-footer-contact">
        Contacto
      </a>
    </footer>
  )
}
