'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../icons'
import YoutubeHighlightsPlayer from './YoutubeHighlightsPlayer'
import {
  openFifaHighlightsWindow,
  resolveTeamNamesFromApiRaw,
} from '../../lib/fifaHighlights'

const clientCache = new Map()
const CLIENT_CACHE_VERSION = 'v2'

async function loadHighlights(homeTeam, awayTeam) {
  const key = `${CLIENT_CACHE_VERSION}|${homeTeam}|${awayTeam}`
  if (clientCache.has(key)) return clientCache.get(key)

  const params = new URLSearchParams({ home: homeTeam, away: awayTeam })
  const promise = fetch(`/api/fifa/highlights?${params}`)
    .then(r => r.json())
    .catch(() => ({ available: false }))
  clientCache.set(key, promise)
  return promise
}

function HighlightsPreviewSheet({ data, homeLabel, awayLabel, onClose, startPlaying = false }) {
  const hasEmbed = Boolean(data.youtubeId)
  const [playing, setPlaying] = useState(startPlaying && hasEmbed)

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

  const fifaUrl = data.watchUrl || data.urlEs || data.urlEn

  function handlePlay() {
    if (hasEmbed) {
      setPlaying(true)
      return
    }
    openFifaHighlightsWindow(fifaUrl)
    onClose()
  }

  const youtubeTitle = `Resumen: ${homeLabel} vs ${awayLabel}`

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
          {playing && data.youtubeId ? (
            <YoutubeHighlightsPlayer
              videoId={data.youtubeId}
              title={youtubeTitle}
              className="fifa-highlights-sheet__player"
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
          <div className="fifa-highlights-sheet__footer">
            <div className="fifa-highlights-sheet__meta">
              <p id="fifa-highlights-title" className="fifa-highlights-sheet__title">
                {data.title || `${homeLabel} vs ${awayLabel}`}
              </p>
              {hasEmbed ? (
                <p className="fifa-highlights-sheet__hint">
                  {playing && data.youtubeChannel
                    ? `Vídeo de ${data.youtubeChannel} (YouTube).`
                    : playing
                      ? 'Vídeo de YouTube.'
                      : 'El resumen se reproduce aquí mismo, sin salir de la app.'}
                </p>
              ) : (
                <p className="fifa-highlights-sheet__hint">
                  Se abrirá el resumen oficial en FIFA.com.
                </p>
              )}
            </div>
            <button
              type="button"
              className="fifa-highlights-sheet__link"
              onClick={() => openFifaHighlightsWindow(fifaUrl)}
            >
              <Icon name="arrowTopRightOnSquare" size={14} aria-hidden />
              {data.watchUrl ? 'Ver en FIFA.com' : 'Ver artículo en FIFA.com'}
            </button>
          </div>
          {!playing && hasEmbed && (
            <button type="button" className="fifa-highlights-sheet__cta" onClick={handlePlay}>
              <Icon name="playCircle" size={18} aria-hidden />
              Ver resumen
            </button>
          )}
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
      if (!data.youtubeId && (data.watchUrl || data.urlEs || data.urlEn)) {
        openFifaHighlightsWindow(data.watchUrl || data.urlEs || data.urlEn)
        return
      }
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
          startPlaying
        />
      )}
    </>
  )
}
