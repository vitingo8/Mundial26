/**
 * Localiza la URL pública oficial del vídeo de un artículo de FIFA.com
 * en formato https://www.fifa.com/en/watch/{id}.
 *
 * No descarga el vídeo ni extrae streams (.m3u8/.mp4/.mpd): solo encuentra
 * la página oficial del reproductor.
 *
 * Estrategias, en orden:
 *  1. Escanear el HTML del artículo buscando enlaces /xx/watch/{id}.
 *  2. Parsear JSON embebido (__NEXT_DATA__ o <script type="application/json">)
 *     y recorrerlo recursivamente buscando strings con /watch/.
 *  3. API pública de contenido de FIFA (cxm-api.fifa.com): el artículo expone
 *     heroVideoEntryId, que es exactamente el id de /en/watch/{id}.
 *     (La página es una SPA con el HTML vacío, así que en la práctica esta
 *     es la vía que funciona.)
 */

const FIFA_BASE = 'https://www.fifa.com'
const CXM_API_BASE = 'https://cxm-api.fifa.com/fifaplusweb/api'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

/** /en/watch/{id} o https://www.fifa.com/en/watch/{id}; ids tipo Contentful (~22 alfanum.). */
const WATCH_URL_RE = /(?:https?:\/\/(?:www\.)?fifa\.com)?\/([a-z]{2})\/watch\/([A-Za-z0-9]{10,30})/g

/** Palabras que suben prioridad si aparecen cerca de la coincidencia. */
const CONTEXT_KEYWORDS = ['video', 'watch', 'highlights', 'contentid', 'entryid', 'media', 'herovideo']

function log(debug, ...args) {
  if (debug) console.log('[fifaWatch]', ...args)
}

function toAbsoluteWatchUrl(id, locale = 'en') {
  return `${FIFA_BASE}/${locale}/watch/${id}`
}

/** Extrae candidatos /xx/watch/{id} de un texto, con puntuación por contexto. */
function scanTextForWatchUrls(text, { fromJson = false } = {}) {
  const candidates = []
  const seen = new Set()
  let m
  WATCH_URL_RE.lastIndex = 0
  while ((m = WATCH_URL_RE.exec(text)) !== null) {
    const [, locale, id] = m
    if (seen.has(id)) continue
    seen.add(id)

    const ctx = text
      .slice(Math.max(0, m.index - 300), m.index + m[0].length + 300)
      .toLowerCase()
    const keywordHits = CONTEXT_KEYWORDS.filter(k => ctx.includes(k)).length

    candidates.push({
      id,
      locale,
      url: toAbsoluteWatchUrl(id),
      score: (fromJson ? 10 : 0) + keywordHits,
    })
  }
  return candidates
}

/** Recorre recursivamente un JSON buscando strings con /watch/. */
function scanJsonForWatchUrls(node, out = []) {
  if (typeof node === 'string') {
    if (node.includes('/watch/')) out.push(...scanTextForWatchUrls(node, { fromJson: true }))
    return out
  }
  if (Array.isArray(node)) {
    for (const item of node) scanJsonForWatchUrls(item, out)
    return out
  }
  if (node && typeof node === 'object') {
    for (const value of Object.values(node)) scanJsonForWatchUrls(value, out)
  }
  return out
}

/** Estrategia 1 y 2: HTML estático + JSON embebido. */
async function findInHtml(articleUrl, debug) {
  const res = await fetch(articleUrl, {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'follow',
  })
  if (!res.ok) {
    log(debug, `HTML no descargado (status ${res.status})`)
    return null
  }
  const html = await res.text()
  log(debug, `HTML descargado correctamente (${html.length} bytes)`)

  const candidates = scanTextForWatchUrls(html)
  log(debug, `Coincidencias en HTML estático: ${candidates.length}`)

  // JSON embebido: __NEXT_DATA__ (Next.js) o cualquier <script type="application/json">
  const jsonBlocks = []
  const nextData = html.match(
    /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
  )
  if (nextData) jsonBlocks.push(nextData[1])
  const jsonScriptRe = /<script[^>]*type="application\/(?:ld\+)?json"[^>]*>([\s\S]*?)<\/script>/g
  let sm
  while ((sm = jsonScriptRe.exec(html)) !== null) jsonBlocks.push(sm[1])

  for (const block of jsonBlocks) {
    try {
      candidates.push(...scanJsonForWatchUrls(JSON.parse(block)))
    } catch {
      // bloque no parseable; se ignora
    }
  }

  if (!candidates.length) return null

  candidates.sort((a, b) => b.score - a.score)
  log(debug, 'Candidatas:', candidates.map(c => `${c.url} (score ${c.score})`))
  return candidates[0].url
}

/** Estrategia 3: API de contenido de FIFA → heroVideoEntryId del artículo. */
async function findViaCxmApi(articleUrl, debug) {
  const parsed = new URL(articleUrl)
  if (!/(^|\.)fifa\.com$/.test(parsed.hostname)) {
    log(debug, 'La URL no es de fifa.com; se omite la API')
    return null
  }
  const path = parsed.pathname
  const locale = path.split('/')[1] || 'en'

  const pageRes = await fetch(`${CXM_API_BASE}/pages${path}`, {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!pageRes.ok) {
    log(debug, `API pages devolvió ${pageRes.status}`)
    return null
  }
  const page = await pageRes.json()

  const articleSection = (page.sections || []).find(s => s.entryType === 'article')
  if (!articleSection?.entryId) {
    log(debug, 'La página no tiene sección de tipo article')
    return null
  }

  const articleRes = await fetch(
    `${CXM_API_BASE}/sections/article/${articleSection.entryId}?locale=${locale}`,
    { headers: { 'User-Agent': USER_AGENT } },
  )
  if (!articleRes.ok) {
    log(debug, `API article devolvió ${articleRes.status}`)
    return null
  }
  const article = await articleRes.json()

  if (!article.heroVideoEntryId) {
    log(debug, 'El artículo no tiene heroVideoEntryId (sin vídeo de cabecera)')
    return null
  }
  log(debug, `heroVideoEntryId: ${article.heroVideoEntryId}`)
  return toAbsoluteWatchUrl(article.heroVideoEntryId)
}

/**
 * @param {string} articleUrl URL completa del artículo de FIFA.com
 * @param {{ debug?: boolean }} [opts]
 * @returns {Promise<string | null>} URL oficial /en/watch/{id} o null
 */
export async function findFifaWatchUrl(articleUrl, { debug = false } = {}) {
  try {
    const fromHtml = await findInHtml(articleUrl, debug)
    if (fromHtml) {
      log(debug, `URL final (HTML): ${fromHtml}`)
      return fromHtml
    }

    log(debug, 'Nada en el HTML; probando API de contenido de FIFA…')
    const fromApi = await findViaCxmApi(articleUrl, debug)
    if (fromApi) {
      log(debug, `URL final (API): ${fromApi}`)
      return fromApi
    }

    log(debug, 'No se encontró URL de vídeo')
    return null
  } catch (e) {
    log(debug, `Error: ${e.message}`)
    return null
  }
}
