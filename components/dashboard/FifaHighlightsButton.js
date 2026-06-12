'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../icons'
import {
  openFifaHighlightsWindow,
  resolveTeamNamesFromApiRaw,
} from '../../lib/fifaHighlights'

const clientCache = new Map()

async function loadHighlights(homeTeam, awayTeam) {
  const key = `${homeTeam}|${awayTeam}`
  if (clientCache.has(key)) return clientCache.get(key)

  const params = new URLSearchParams({ home: homeTeam, away: awayTeam })
  const promise = fetch(`/api/fifa/highlights?${params}`)
    .then(r => r.json())
    .catch(() => ({ available: false }))
  clientCache.set(key, promise)
  return promise
}

function HighlightsPreviewSheet({ data, homeLabel, awayLabel, onClose }) {
  const hasEmbed = Boolean(data.youtubeId)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const fifaUrl = data.urlEs || data.urlEn

  function handlePlay() {
    if (hasEmbed) {
      setPlaying(true)
      return
    }
    openFifaHighlightsWindow(fifaUrl)
    onClose()
  }

  return createPortal(
    <div className="fifa-highlights-backdrop" role="presentation" onClick={onClose}>
      <div
        className="fifa-highlights-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fifa-highlights-title"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          className="fifa-highlights-sheet__close"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <Icon name="chevronLeft" size={18} aria-hidden />
        </button>
        <div className="fifa-highlights-sheet__media">
          {playing && hasEmbed ? (
            <iframe
              className="fifa-highlights-sheet__player"
              src={`https://www.youtube-nocookie.com/embed/${data.youtubeId}?autoplay=1&rel=0&playsinline=1`}
              title={`Resumen: ${homeLabel} vs ${awayLabel}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <>
              {data.thumbnail ? (
                <img
                  src={data.thumbnail}
                  alt=""
                  className="fifa-highlights-sheet__thumb"
                />
              ) : (
                <div className="fifa-highlights-sheet__thumb fifa-highlights-sheet__thumb--empty" />
              )}
              <button
                type="button"
                className="fifa-highlights-sheet__play"
                onClick={handlePlay}
                aria-label={`Reproducir resumen: ${homeLabel} vs ${awayLabel}`}
              >
                <Icon name="playCircle" size={56} aria-hidden />
              </button>
            </>
          )}
        </div>
        <div className="fifa-highlights-sheet__body">
          <p id="fifa-highlights-title" className="fifa-highlights-sheet__title">
            {data.title || `${homeLabel} vs ${awayLabel}`}
          </p>
          {hasEmbed ? (
            <p className="fifa-highlights-sheet__hint">
              {playing
                ? data.youtubeChannel
                  ? `Vídeo de ${data.youtubeChannel} (YouTube).`
                  : 'Vídeo de YouTube.'
                : 'El resumen se reproduce aquí mismo, sin salir de la app.'}
            </p>
          ) : (
            <p className="fifa-highlights-sheet__hint">
              Se abrirá el resumen oficial en FIFA.com (vídeo con goles al inicio).
            </p>
          )}
          <div className="fifa-highlights-sheet__actions">
            {!playing && (
              <button type="button" className="fifa-highlights-sheet__cta" onClick={handlePlay}>
                <Icon name="playCircle" size={18} aria-hidden />
                Ver resumen
              </button>
            )}
            <button
              type="button"
              className="fifa-highlights-sheet__link"
              onClick={() => openFifaHighlightsWindow(fifaUrl)}
            >
              <Icon name="arrowTopRightOnSquare" size={14} aria-hidden />
              Ver en FIFA.com
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function FifaHighlightsButton({
  apiRaw,
  homeTeam,
  awayTeam,
  homeLabel,
  awayLabel,
  className = '',
  compact = false,
}) {
  const [data, setData] = useState(null)
  const [checked, setChecked] = useState(false)
  const [open, setOpen] = useState(false)

  const teams = apiRaw
    ? resolveTeamNamesFromApiRaw(apiRaw)
    : { home: homeTeam || '', away: awayTeam || '' }

  useEffect(() => {
    let cancelled = false
    if (!teams.home || !teams.away) {
      setChecked(true)
      return undefined
    }

    loadHighlights(teams.home, teams.away).then(result => {
      if (cancelled) return
      if (result?.available) setData(result)
      setChecked(true)
    })

    return () => {
      cancelled = true
    }
  }, [teams.home, teams.away])

  const handleClick = useCallback(
    e => {
      e.preventDefault()
      e.stopPropagation()
      if (!data) return
      setOpen(true)
    },
    [data],
  )

  if (!checked || !data) return null

  const label = homeLabel && awayLabel ? `${homeLabel} vs ${awayLabel}` : 'Resumen FIFA'

  return (
    <>
      <button
        type="button"
        className={`fifa-highlights-btn${compact ? ' fifa-highlights-btn--compact' : ''}${className ? ` ${className}` : ''}`}
        onClick={handleClick}
        aria-label={`Ver resumen en vídeo: ${label}`}
        title="Resumen en vídeo (FIFA)"
      >
        <Icon name="playCircle" size={compact ? 14 : 16} aria-hidden />
      </button>
      {open && (
        <HighlightsPreviewSheet
          data={data}
          homeLabel={homeLabel || teams.home}
          awayLabel={awayLabel || teams.away}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
