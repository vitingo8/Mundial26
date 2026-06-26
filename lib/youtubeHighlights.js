/**
 * Busca en la playlist oficial de DAZN ES (YouTube) el resumen embebible
 * de un partido del Mundial 2026. Solo vídeos del canal DAZN; ningún otro.
 * Solo para uso en servidor.
 */
import { displayTeamName, teamNameKey, toCanonicalTeamName } from './teamNamesEs.js'

const SEARCH_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

/** Playlist DAZN ES — Copa Mundial de la FIFA 2026™ */
const DAZN_PLAYLIST_ID = 'PL8vYHFKv-YcqjDmrVZm-AghTsjCaMNNwi'
const DAZN_CHANNEL_ID = 'UCK-mxP4hLap1t3dp4bPbSBg'
const DAZN_RSS_URL = `https://www.youtube.com/feeds/videos.xml?playlist_id=${DAZN_PLAYLIST_ID}`

const PLAYLIST_CACHE_TTL_MS = 60 * 60 * 1000

/** Variantes extra de nombres que usan DAZN en los títulos (clave canónica → alternativas). */
const EXTRA_NAME_VARIANTS = {
  'korea republic': ['south korea', 'corea', 'republica de corea'],
  czechia: ['czech republic', 'chequia', 'republica checa'],
  turkiye: ['turkey', 'turquia'],
  'united states': ['usa', 'estados unidos'],
  'ivory coast': ["cote d'ivoire", 'costa de marfil'],
  'congo dr': ['dr congo', 'congo', 'rd congo'],
  netherlands: ['holland', 'paises bajos', 'holanda'],
  mexico: ['mexico'],
  'south africa': ['sudafrica', 'south africa'],
  qatar: ['qatar', 'catar'],
  'bosnia and herzegovina': ['bosnia', 'bosnia y herzegovina'],
  iran: ['iran', 'ri de iran', 'ir iran'],
}

const EXCLUDE_WORDS = [
  'live stream', 'en vivo', 'en directo', 'preview', 'previa',
  'press conference', 'rueda de prensa', 'interview', 'entrevista',
  'reaction', 'reaccion', 'watchalong', 'prediction', 'prediccion',
  'lineup', 'alineacion', 'simulacion', 'simulation', 'pes ', 'fc 26', 'fifa 26',
  'trendingmundial', 'podriamos haber', 'jaque olmo', 'paradas del mundial',
  'como la vas', 'encantado estar',
]

const HIGHLIGHT_WORDS = ['resumen', 'highlights', 'goles', 'mejores momentos', 'all goals']

let playlistCache = null
let playlistCacheAt = 0

function decodeXml(text) {
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function nameVariants(teamName) {
  const canonical = toCanonicalTeamName(teamName)
  const variants = new Set()
  if (canonical) variants.add(canonical)
  const es = displayTeamName(teamName)
  if (es) variants.add(teamNameKey(es))
  for (const v of EXTRA_NAME_VARIANTS[canonical] || []) variants.add(v)
  return [...variants].filter(Boolean)
}

function titleMatchesTeams(titleKey, homeVariants, awayVariants) {
  const hasHome = homeVariants.some(v => titleKey.includes(v))
  const hasAway = awayVariants.some(v => titleKey.includes(v))
  return hasHome && hasAway
}

function isDaznEntry(entry) {
  if (entry.channelId === DAZN_CHANNEL_ID) return true
  const key = teamNameKey(entry.channel)
  return key.includes('dazn')
}

function parsePlaylistRss(xml) {
  const entries = []
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g
  let m
  while ((m = entryRe.exec(xml)) !== null) {
    const block = m[1]
    const id = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
    const title = block.match(/<title>([^<]+)<\/title>/)?.[1]
    const channelId = block.match(/<yt:channelId>([^<]+)<\/yt:channelId>/)?.[1]
    const channel = block.match(/<name>([^<]+)<\/name>/)?.[1] || 'DAZN ES'
    if (id && title) {
      entries.push({ id, title: decodeXml(title), channelId, channel: decodeXml(channel) })
    }
  }
  return entries
}

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

function extractPlaylistVideosFromNode(obj, out = []) {
  if (!obj || typeof obj !== 'object') return out

  if (obj.lockupViewModel) {
    const lv = obj.lockupViewModel
    const title = lv.metadata?.lockupMetadataViewModel?.title?.content
      || lv.lockupMetadataViewModel?.title?.content
    const thumbUrl = lv.contentImage?.thumbnailViewModel?.image?.sources?.[0]?.url
    const id = thumbUrl?.match(/\/vi\/([^/]+)\//)?.[1]
    if (id && title) {
      out.push({ id, title, channelId: DAZN_CHANNEL_ID, channel: 'DAZN ES' })
    }
  }

  if (obj.playlistVideoRenderer) {
    const v = obj.playlistVideoRenderer
    const title = v.title?.simpleText || v.title?.runs?.map(r => r.text).join('')
    if (v.videoId && title) {
      out.push({ id: v.videoId, title, channelId: DAZN_CHANNEL_ID, channel: 'DAZN ES' })
    }
  }

  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) v.forEach(item => extractPlaylistVideosFromNode(item, out))
    else if (v && typeof v === 'object') extractPlaylistVideosFromNode(v, out)
  }
  return out
}

async function fetchDaznPlaylistFromWeb() {
  const url = `https://www.youtube.com/playlist?list=${DAZN_PLAYLIST_ID}`
  const res = await fetch(url, {
    headers: { 'User-Agent': SEARCH_UA, 'Accept-Language': 'es-ES,es;q=0.9' },
  })
  if (!res.ok) return []
  const data = extractYtInitialData(await res.text())
  if (!data) return []
  return extractPlaylistVideosFromNode(data).filter(isDaznEntry)
}

function dedupeEntries(entries) {
  const seen = new Set()
  return entries.filter(e => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })
}

async function fetchDaznPlaylistRss() {
  const res = await fetch(DAZN_RSS_URL, {
    headers: { 'User-Agent': SEARCH_UA, 'Accept-Language': 'es-ES,es;q=0.9' },
  })
  if (!res.ok) return []
  return parsePlaylistRss(await res.text()).filter(isDaznEntry)
}

async function getDaznPlaylistEntries() {
  if (playlistCache && Date.now() - playlistCacheAt < PLAYLIST_CACHE_TTL_MS) {
    return playlistCache
  }
  try {
    const [webEntries, rssEntries] = await Promise.all([
      fetchDaznPlaylistFromWeb().catch(() => []),
      fetchDaznPlaylistRss().catch(() => []),
    ])
    const entries = dedupeEntries([...webEntries, ...rssEntries])
    if (entries.length) {
      playlistCache = entries
      playlistCacheAt = Date.now()
    }
    return entries.length ? entries : (playlistCache || [])
  } catch {
    return playlistCache || []
  }
}

/** 200 en oEmbed ⇒ el vídeo permite embeds; 401/403 ⇒ bloqueado. */
async function isEmbeddable(videoId) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
      { headers: { 'User-Agent': SEARCH_UA } },
    )
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function isHighlightCandidate(entry, homeVariants, awayVariants) {
  const titleKey = teamNameKey(entry.title)
  if (!titleMatchesTeams(titleKey, homeVariants, awayVariants)) return false
  if (EXCLUDE_WORDS.some(w => titleKey.includes(w))) return false
  if (!HIGHLIGHT_WORDS.some(w => titleKey.includes(w))) return false
  return true
}

function buildHighlightResult(entry, oembed = null) {
  return {
    videoId: entry.id,
    title: oembed?.title || entry.title,
    channel: oembed?.author_name || entry.channel,
  }
}

/**
 * Devuelve { videoId, title, channel } del resumen DAZN embebible, o null.
 */
export async function findEmbeddableHighlights(homeTeam, awayTeam) {
  const homeVariants = nameVariants(homeTeam)
  const awayVariants = nameVariants(awayTeam)
  if (!homeVariants.length || !awayVariants.length) return null

  const entries = await getDaznPlaylistEntries()
  const candidates = entries.filter(e => isHighlightCandidate(e, homeVariants, awayVariants))
  if (!candidates.length) return null

  for (const c of candidates) {
    const oembed = await isEmbeddable(c.id)
    if (oembed) return buildHighlightResult(c, oembed)
  }

  // DAZN bloquea oEmbed (401) en sus resúmenes, pero el iframe sigue funcionando.
  return buildHighlightResult(candidates[0])
}
