'use client'

import { useEffect, useState } from 'react'
import { Icon } from './icons'
import InviteQr from './InviteQr'

export default function InviteButton({ group, userId, isAdmin = false, notify }) {
  const [open, setOpen] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const shareUrl = `${origin}?join=${group.id}`
  const personalUrl = userId ? `${origin}?join=${group.id}&user=${userId}` : shareUrl

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function copyLink(text, msg = 'Enlace copiado') {
    navigator.clipboard.writeText(text).then(() => notify?.(msg))
  }

  async function shareInvite() {
    const text = `¡Únete a la porra "${group.name}" del Mundial 2026!\n${shareUrl}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Porra Mundial 2026', text, url: shareUrl })
        return
      } catch (e) {
        if (e.name === 'AbortError') return
      }
    }
    copyLink(text)
  }

  return (
    <>
      <button
        type="button"
        className="header-action-btn header-action-btn--header invite-header-btn"
        title="Invitar"
        aria-label="Invitar"
        onClick={() => setOpen(true)}
      >
        <Icon name="link" size="sm" />
        <span className="header-action-btn__text">Invitar</span>
      </button>

      {open && (
        <div
          className="install-app-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-sheet-title"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="install-app-sheet invite-sheet">
            <button
              type="button"
              className="install-app-close"
              aria-label="Cerrar"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
            <h2 id="invite-sheet-title" className="install-app-title">Invitar al grupo</h2>

            <div className="invite-sheet-body">
              <div className="dash-card dash-card--accent" style={{ marginBottom: 12 }}>
                <div className="dash-card-title">Enlace del grupo</div>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
                  Código <strong>#{group.id}</strong> — comparte el enlace para que se unan.
                </p>
                <div className="dash-share-url">{shareUrl}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, justifyContent: 'center' }}>
                  <button type="button" className="dash-btn-primary" onClick={shareInvite}>Compartir</button>
                  <button type="button" className="dash-btn-ghost" onClick={() => copyLink(shareUrl)}>Copiar</button>
                </div>
                <InviteQr url={shareUrl} />
              </div>

              {isAdmin && userId && (
                <div className="dash-card">
                  <div className="dash-card-title">Tu enlace personal</div>
                  <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
                    Para recuperar la sesión en otro dispositivo.
                  </p>
                  <div className="dash-share-url">{personalUrl}</div>
                  <button
                    type="button"
                    className="dash-btn-ghost"
                    style={{ marginTop: 12 }}
                    onClick={() => copyLink(personalUrl, 'Enlace personal copiado')}
                  >
                    Copiar enlace personal
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
