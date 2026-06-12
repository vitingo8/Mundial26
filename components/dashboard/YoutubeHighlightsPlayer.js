'use client'

import { useEffect, useRef, useState } from 'react'

let ytApiPromise = null

/** YouTube elige calidad según el tamaño del iframe; 1920×1080 fuerza stream 1080p. */
const RENDER_WIDTH = 1920
const RENDER_HEIGHT = 1080
const SUGGESTED_QUALITY = 'hd1080'

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
      queueMicrotask(finish)
    }
  })

  return ytApiPromise
}

export default function YoutubeHighlightsPlayer({ videoId, title, className = '' }) {
  const wrapRef = useRef(null)
  const hostRef = useRef(null)
  const playerRef = useRef(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined

    const updateScale = () => {
      const width = el.clientWidth
      if (width > 0) setScale(width / RENDER_WIDTH)
    }

    updateScale()
    const ro = new ResizeObserver(updateScale)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false

    loadYoutubeIframeApi()
      .then(YT => {
        if (cancelled || !hostRef.current) return

        playerRef.current = new YT.Player(hostRef.current, {
          width: RENDER_WIDTH,
          height: RENDER_HEIGHT,
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
              const player = e.target
              // suggestedQuality sigue siendo la única pista oficial al cargar el vídeo
              player.loadVideoById({
                videoId,
                startSeconds: 0,
                suggestedQuality: SUGGESTED_QUALITY,
              })
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
      ref={wrapRef}
      className={`youtube-highlights-player${className ? ` ${className}` : ''}`}
      title={title}
      aria-label={title}
    >
      <div
        className="youtube-highlights-player__stage"
        style={{
          width: RENDER_WIDTH,
          height: RENDER_HEIGHT,
          transform: `scale(${scale})`,
        }}
      >
        <div ref={hostRef} className="youtube-highlights-player__host" />
      </div>
    </div>
  )
}
