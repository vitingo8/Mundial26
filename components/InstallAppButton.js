'use client'

import { useEffect, useState } from 'react'
import { Icon } from './icons'

function isIos() {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

function isInstalledPwa() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

/**
 * Android/Chrome: un toque abre el instalador nativo (beforeinstallprompt).
 * iOS/Safari: no existe API de instalación automática; solo aviso breve.
 */
export default function InstallAppButton({ className = '', variant = 'default', notify }) {
  const [installed, setInstalled] = useState(false)
  const [deferred, setDeferred] = useState(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    setInstalled(isInstalledPwa())

    const onInstallable = e => {
      e.preventDefault()
      setDeferred(e)
    }
    window.addEventListener('beforeinstallprompt', onInstallable)
    return () => window.removeEventListener('beforeinstallprompt', onInstallable)
  }, [])

  function toast(message, type = 'info') {
    if (notify) notify(message, type)
    else if (typeof window !== 'undefined') window.alert(message)
  }

  if (installed) return null

  async function handleClick() {
    if (deferred) {
      setInstalling(true)
      try {
        await deferred.prompt()
        const { outcome } = await deferred.userChoice
        if (outcome === 'accepted') {
          setDeferred(null)
          setInstalled(true)
        } else if (outcome === 'dismissed') {
          toast('Instalación cancelada', 'info')
        }
      } catch {
        toast('No se pudo abrir el instalador', 'error')
      } finally {
        setInstalling(false)
      }
      return
    }

    if (isIos()) {
      toast(
        'En iPhone no se puede instalar sola: abre en Safari, pulsa Compartir y «Añadir a pantalla de inicio».',
        'info',
      )
      return
    }

    toast('Usa Chrome y el menú ⋮ → «Instalar aplicación» si no aparece el diálogo.', 'info')
  }

  return (
    <button
      type="button"
      className={`header-action-btn header-action-btn--header install-header-btn${deferred ? ' header-action-btn--ready' : ''}${className ? ` ${className}` : ''}`}
      title={deferred ? 'Instalar aplicación' : 'Descargar app'}
      aria-label="Descargar app"
      disabled={installing}
      onClick={handleClick}
    >
      <Icon name="arrowDownOnSquare" size={variant === 'header' ? 'sm' : 'md'} />
      {variant === 'header' ? (
        <span className="header-action-btn__text">{installing ? '…' : 'App'}</span>
      ) : (
        installing ? 'Instalando…' : 'Descargar app'
      )}
    </button>
  )
}
