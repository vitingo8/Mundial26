'use client'

import { useEffect, useRef } from 'react'

let ytApiPromise = null

function loadYoutubeIframeApi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'))
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (ytApiPromise) return ytApiPromise

  ytApiPromise = new Promise((resolve, reject) => {
    const finish = () => {
      if (window.YT?.Player) resolve(window.YT)
      else reject(new Error('YouTube IFrame API no disponible'))
    }

    const prevReady = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prevReady?.()
      finish()
    }

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      tag.async = true
      document.head.appendChild(tag)
    } else {
      // La API puede estar cargando ya
      queueMicrotask(finish)
    }
  })

  return ytApiPromise
}

const QUALITY_1080 = 'hd1080'

/** Pide 1080p; si no existe, la mejor calidad HD disponible. */
function request1080p(player) {
  if (!player?.setPlaybackQuality) return
  try {
    const levels = player.getAvailableQualityLevels?.() || []
    if (levels.includes(QUALITY_1080)) {
      player.setPlaybackQuality(QUALITY_1080)
    } else if (levels.includes('highres')) {
      player.setPlaybackQuality('highres')
    } else if (levels.includes('hd720')) {
      player.setPlaybackQuality('hd720')
    }
  } catch {
    // YouTube puede ignorar la petición según red o dispositivo
  }
}

export default function YoutubeHighlightsPlayer({ videoId, title, className = '' }) {
  const hostRef = useRef(null)
  const playerRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    loadYoutubeIframeApi()
      .then(YT => {
        if (cancelled || !hostRef.current) return

        playerRef.current = new YT.Player(hostRef.current, {
          videoId,
          width: '100%',
          height: '100%',
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            autoplay: 1,
            rel: 0,
            playsinline: 1,
            modestbranding: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: e => {
              request1080p(e.target)
              e.target.playVideo?.()
            },
            onStateChange: e => {
              if (e.data === YT.PlayerState.PLAYING) {
                request1080p(e.target)
              }
            },
          },
        })
      })
      .catch(() => {})

    return () => {
      cancelled = true
      try {
        playerRef.current?.destroy?.()
      } catch {
        // ignore
      }
      playerRef.current = null
    }
  }, [videoId])

  return (
    <div
      ref={hostRef}
      className={className}
      title={title}
      aria-label={title}
    />
  )
}
