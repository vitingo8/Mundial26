/**
 * Sincroniza la playlist DAZN ES (YouTube) a lib/daznPlaylistCache.json.
 * Ejecutar en CI o localmente cuando falten resúmenes en producción.
 */
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const PLAYLIST_ID = 'PL8vYHFKv-YcqjDmrVZm-AghTsjCaMNNwi'
const DAZN_CHANNEL_ID = 'UCK-mxP4hLap1t3dp4bPbSBg'
const SEARCH_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '../lib/daznPlaylistCache.json')

function extractYtInitialData(html) {
  const marker = 'var ytInitialData = '
  const idx = html.indexOf(marker)
  if (idx < 0) return null
  let start = idx + marker.length
  let depth = 0
  for (let end = start; end < html.length; end++) {
    if (html[end] === '{') depth++
    else if (html[end] === '}') {
      depth--
      if (depth === 0) return JSON.parse(html.slice(start, end + 1))
    }
  }
  return null
}

function extractVideos(obj, out = []) {
  if (!obj || typeof obj !== 'object') return out
  if (obj.lockupViewModel) {
    const lv = obj.lockupViewModel
    const title = lv.metadata?.lockupMetadataViewModel?.title?.content
    const thumbUrl = lv.contentImage?.thumbnailViewModel?.image?.sources?.[0]?.url
    const id = thumbUrl?.match(/\/vi\/([^/]+)\//)?.[1]
    if (id && title) out.push({ id, title, channelId: DAZN_CHANNEL_ID, channel: 'DAZN ES' })
  }
  if (obj.playlistVideoRenderer) {
    const v = obj.playlistVideoRenderer
    const title = v.title?.simpleText || v.title?.runs?.map(r => r.text).join('')
    if (v.videoId && title) out.push({ id: v.videoId, title, channelId: DAZN_CHANNEL_ID, channel: 'DAZN ES' })
  }
  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) v.forEach(i => extractVideos(i, out))
    else if (v && typeof v === 'object') extractVideos(v, out)
  }
  return out
}

async function fetchViaInnertube(html) {
  const apiKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1]
  const clientVersion = html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1]
  if (!apiKey) return []
  const res = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': SEARCH_UA },
    body: JSON.stringify({
      context: {
        client: { hl: 'es', gl: 'ES', clientName: 'WEB', clientVersion: clientVersion || '2.20260625.01.00' },
      },
      browseId: `VL${PLAYLIST_ID}`,
    }),
  })
  if (!res.ok) return []
  return extractVideos(await res.json())
}

const html = await fetch(`https://www.youtube.com/playlist?list=${PLAYLIST_ID}`, {
  headers: { 'User-Agent': SEARCH_UA, 'Accept-Language': 'es-ES' },
}).then(r => r.text())

const initial = extractYtInitialData(html)
const fromHtml = initial ? extractVideos(initial) : []
const fromApi = await fetchViaInnertube(html)

const seen = new Set()
const entries = [...fromHtml, ...fromApi].filter(e => {
  if (seen.has(e.id)) return false
  seen.add(e.id)
  return true
})

if (!entries.length) {
  console.error('No se obtuvieron vídeos de la playlist DAZN')
  process.exit(1)
}

const payload = {
  playlistId: PLAYLIST_ID,
  syncedAt: new Date().toISOString(),
  entries,
}

writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`)
console.log(`Guardados ${entries.length} vídeos en ${OUT}`)
