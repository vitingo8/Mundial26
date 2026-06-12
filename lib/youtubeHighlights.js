/**
 * Busca en YouTube el resumen de un partido del Mundial 2026 y devuelve
 * el primer vídeo que se puede incrustar (el resumen oficial de FIFA.com
 * tiene DRM y no es embebible; los de broadcasters como Teledeporte/DAZN sí).
 * Solo para uso en servidor.
 */
import { displayTeamName, teamNameKey, toCanonicalTeamName } from './teamNamesEs.js'

const SEARCH_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

/** Variantes extra de nombres que usan los medios (clave canónica → alternativas). */
const EXTRA_NAME_VARIANTS = {
  'korea republic': ['south korea', 'corea'],
  czechia: ['czech republic', 'chequia', 'republica checa'],
  turkiye: ['turkey', 'turquia'],
  'united states': ['usa', 'estados unidos'],
  'ivory coast': ["cote d'ivoire", 'costa de marfil'],
  'congo dr': ['dr congo', 'congo'],
  netherlands: ['holland', 'paises bajos', 'holanda'],
}

const EXCLUDE_WORDS = [
  'live stream', 'en vivo', 'en directo', 'preview', 'previa',
  'press conference', 'rueda de prensa', 'interview', 'entrevista',
  'reaction', 'reaccion', 'watchalong', 'prediction', 'prediccion',
  'lineup', 'alineacion', 'simulacion', 'simulation', 'pes ', 'fc 26', 'fifa 26',
]

const HIGHLIGHT_WORDS = ['resumen', 'highlights', 'goles', 'mejores momentos', 'all goals']

/** Canales que nunca queremos (p. ej. Fox en servidores US). */
const BLOCKED_CHANNELS = [
  'fox sports',
  'fox deportes',
  'fox soccer',
  'fs1',
  'fox futbol',
]

/** Canales preferidos: se prueban antes que el resto. */
const PREFERRED_CHANNELS = [
  'dazn futbol',
  'dazn',
  'teledeporte',
  'rtve',
  'fifa',
  'telemundo',
  'tudn',
  'vix',
  'gol mundial',
]

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

function extractCandidates(html) {
  const out = []
  const seen = new Set()
  const re = /"videoId":"([\w-]{11})"/g
  let m
  while ((m = re.exec(html)) !== null && out.length < 30) {
    const id = m[1]
    if (seen.has(id)) continue
    seen.add(id)
    const window = html.slice(m.index, m.index + 3000)
    const titleMatch = window.match(/"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.){1,200})"/)
    if (!titleMatch) continue
    const ownerMatch = window.match(/"ownerText":\{"runs":\[\{"text":"((?:[^"\\]|\\.){1,100})"/)
    let title
    let channel
    try {
      title = JSON.parse(`"${titleMatch[1]}"`)
      channel = ownerMatch ? JSON.parse(`"${ownerMatch[1]}"`) : ''
    } catch {
      continue
    }
    out.push({ id, title, channel })
  }
  return out
}

async function searchYoutube(query) {
  const url =
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=es&gl=ES`
  const res = await fetch(url, {
    headers: {
      'User-Agent': SEARCH_UA,
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    },
  })
  if (!res.ok) return []
  return extractCandidates(await res.text())
}

function isBlockedChannel(channel) {
  const key = teamNameKey(channel)
  return BLOCKED_CHANNELS.some(b => key.includes(b))
}

function isBlockedCandidate(candidate) {
  const titleKey = teamNameKey(candidate.title)
  if (BLOCKED_CHANNELS.some(b => titleKey.includes(b))) return true
  return isBlockedChannel(candidate.channel)
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

function channelRank(channel) {
  const key = teamNameKey(channel)
  const idx = PREFERRED_CHANNELS.findIndex(c => key.includes(c))
  return idx === -1 ? PREFERRED_CHANNELS.length : idx
}

/**
 * Devuelve { videoId, title, channel } del primer resumen embebible, o null.
 */
export async function findEmbeddableHighlights(homeTeam, awayTeam) {
  const homeVariants = nameVariants(homeTeam)
  const awayVariants = nameVariants(awayTeam)
  if (!homeVariants.length || !awayVariants.length) return null

  const homeEs = displayTeamName(homeTeam)
  const awayEs = displayTeamName(awayTeam)
  const queries = [
    `DAZN ${homeEs} ${awayEs} resumen Copa Mundial FIFA 2026`,
    `Resumen ${homeEs} ${awayEs} Copa Mundial FIFA 2026`,
    `${homeTeam} ${awayTeam} highlights FIFA World Cup 2026 DAZN`,
  ]

  const candidates = []
  const seen = new Set()
  for (const q of queries) {
    for (const c of await searchYoutube(q)) {
      if (seen.has(c.id)) continue
      seen.add(c.id)
      if (isBlockedCandidate(c)) continue
      const titleKey = teamNameKey(c.title)
      if (!titleMatchesTeams(titleKey, homeVariants, awayVariants)) continue
      if (EXCLUDE_WORDS.some(w => titleKey.includes(w))) continue
      if (!HIGHLIGHT_WORDS.some(w => titleKey.includes(w))) continue
      candidates.push(c)
    }
    if (candidates.length >= 5) break
  }

  candidates.sort((a, b) => channelRank(a.channel) - channelRank(b.channel))

  for (const c of candidates.slice(0, 10)) {
    const oembed = await isEmbeddable(c.id)
    if (oembed) {
      return { videoId: c.id, title: oembed.title || c.title, channel: oembed.author_name || c.channel }
    }
  }
  return null
}
