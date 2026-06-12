'use client'

import { useEffect, useRef, useState } from 'react'

let ytApiPromise = null

/** Tamaño interno alto para pedir 1080p en pantallas anchas. */
const MAX_RENDER_WIDTH = 1920
const MAX_RENDER_HEIGHT = 1080
const SUGGESTED_QUALITY = 'hd1080'

/** Por debajo de este scale los controles de YouTube quedan demasiado pequeños. */
const MIN_COMFORTABLE_SCALE = 0.72

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

function computeLayout(containerWidth) {
  if (containerWidth <= 0) {
    return { mode: 'native', width: 640, height: 360, scale: 1 }
  }

  const scaledScale = containerWidth / MAX_RENDER_WIDTH
  if (scaledScale >= MIN_COMFORTABLE_SCALE) {
    return {
      mode: 'scaled',
      width: MAX_RENDER_WIDTH,
      height: MAX_RENDER_HEIGHT,
      scale: scaledScale,
    }
  }

  const width = Math.round(containerWidth)
  const height = Math.round((width * 9) / 16)
  return { mode: 'native', width, height, scale: 1 }
}

export default function YoutubeHighlightsPlayer({ videoId, title, className = '' }) {
  const wrapRef = useRef(null)
  const hostRef = useRef(null)
  const playerRef = useRef(null)
  const [layout, setLayout] = useState(() => computeLayout(0))

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined

    const updateLayout = () => {
      const next = computeLayout(el.clientWidth)
      setLayout(prev =>
        prev.mode === next.mode && prev.width === next.width && prev.height === next.height
          ? prev
          : next,
      )
    }

    updateLayout()
    const ro = new ResizeObserver(updateLayout)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false

    loadYoutubeIframeApi()
      .then(YT => {
        if (cancelled || !hostRef.current) return

        playerRef.current = new YT.Player(hostRef.current, {
          width: layout.width,
          height: layout.height,
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
              player.loadVideoById({
                videoId,
                startSeconds: 0,
                suggestedQuality: layout.mode === 'scaled' ? SUGGESTED_QUALITY : 'hd720',
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
  }, [videoId, layout.mode, layout.width, layout.height])

  const isNative = layout.mode === 'native'

  return (
    <div
      ref={wrapRef}
      className={`youtube-highlights-player${isNative ? ' youtube-highlights-player--native' : ''}${className ? ` ${className}` : ''}`}
      title={title}
      aria-label={title}
    >
      <div
        className="youtube-highlights-player__stage"
        style={
          isNative
            ? undefined
            : {
                width: layout.width,
                height: layout.height,
                transform: `scale(${layout.scale})`,
              }
        }
      >
        <div ref={hostRef} className="youtube-highlights-player__host" />
      </div>
    </div>
  )
}
