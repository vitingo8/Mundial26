const CACHE_MAX = 3000
const BATCH_SIZE = 12
const CONCURRENCY = 4
const FETCH_TIMEOUT_MS = 8000

/** @type {Map<string, string>} */
const translationCache = new Map()

function cacheGet(text) {
  return translationCache.get(text)
}

function cacheSet(original, translated) {
  if (translationCache.size >= CACHE_MAX) {
    const first = translationCache.keys().next().value
    translationCache.delete(first)
  }
  translationCache.set(original, translated)
}

function chunkArray(items, size) {
  const chunks = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function translateBatchOfficial(texts, apiKey) {
  const url = new URL('https://translation.googleapis.com/language/translate/v2')
  url.searchParams.set('key', apiKey)

  const res = await fetchWithTimeout(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: texts,
      target: 'es',
      format: 'text',
    }),
  })
  if (!res.ok) throw new Error(`Google Translate API ${res.status}`)

  const payload = await res.json()
  const rows = payload?.data?.translations || []
  return texts.map((original, index) => {
    const row = rows[index]
    if (!row) return original
    if (row.detectedSourceLanguage === 'es') return original
    return row.translatedText || original
  })
}

async function translateBatchFree(texts) {
  const url = new URL('https://translate.googleapis.com/translate_a/single')
  url.searchParams.set('client', 'gtx')
  url.searchParams.set('sl', 'auto')
  url.searchParams.set('tl', 'es')
  url.searchParams.set('dt', 't')
  for (const text of texts) url.searchParams.append('q', text)

  const res = await fetchWithTimeout(url.toString(), {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PorraMundial/1.0)' },
  })
  if (!res.ok) throw new Error(`Google Translate ${res.status}`)

  const data = await res.json()
  const detected = data?.[2]

  if (Array.isArray(data?.[0]?.[0]) && typeof data[0][0][0] === 'string' && texts.length === 1) {
    if (detected === 'es') return texts
    return [(data[0] || []).map(part => part[0]).join('') || texts[0]]
  }

  if (Array.isArray(data?.[0]) && data[0].length === texts.length) {
    if (detected === 'es') return texts
    return data[0].map((segments, index) => {
      if (!Array.isArray(segments)) return texts[index]
      return segments.map(part => part[0]).join('') || texts[index]
    })
  }

  return Promise.all(texts.map(text => translateTextToSpanish(text)))
}

async function translateBatch(texts) {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY
  if (apiKey) return translateBatchOfficial(texts, apiKey)
  return translateBatchFree(texts)
}

export async function translateTextToSpanish(text) {
  const original = String(text ?? '')
  const trimmed = original.trim()
  if (!trimmed) return original

  const cached = cacheGet(trimmed)
  if (cached !== undefined) return cached

  try {
    const [translated] = await translateBatch([trimmed])
    const result = translated || trimmed
    cacheSet(trimmed, result)
    return result
  } catch {
    cacheSet(trimmed, trimmed)
    return trimmed
  }
}

export async function translateTextsToSpanish(texts) {
  const unique = [...new Set(
    (texts || [])
      .map(text => String(text ?? '').trim())
      .filter(Boolean),
  )]

  const result = new Map()
  if (!unique.length) return result

  const pending = unique.filter(text => {
    const cached = cacheGet(text)
    if (cached !== undefined) {
      result.set(text, cached)
      return false
    }
    return true
  })

  const batches = chunkArray(pending, BATCH_SIZE)
  let batchIndex = 0

  async function worker() {
    while (batchIndex < batches.length) {
      const batch = batches[batchIndex]
      batchIndex += 1
      try {
        const translated = await translateBatch(batch)
        batch.forEach((text, index) => {
          const value = translated[index] || text
          cacheSet(text, value)
          result.set(text, value)
        })
      } catch {
        batch.forEach(text => {
          cacheSet(text, text)
          result.set(text, text)
        })
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length || 1) }, worker))

  for (const text of unique) {
    if (!result.has(text)) result.set(text, text)
  }

  return result
}

function mapTranslated(value, translations) {
  if (value == null || value === '') return value
  const key = String(value).trim()
  if (!key) return value
  return translations.get(key) ?? value
}

/** Traduce textos visibles del feed de Directo al español. */
export async function translateLiveCommentaryFeed(feed) {
  if (!Array.isArray(feed) || feed.length === 0) return feed

  const texts = []
  for (const item of feed) {
    if (item.text) texts.push(item.text)
    if (item.title) texts.push(item.title)
    if (item.question) texts.push(item.question)
    for (const option of item.options || []) {
      if (option?.label) texts.push(option.label)
    }
  }

  const translations = await translateTextsToSpanish(texts)

  return feed.map(item => {
    const next = { ...item }
    if (next.text) next.text = mapTranslated(next.text, translations)
    if (next.title) next.title = mapTranslated(next.title, translations)
    if (next.question) next.question = mapTranslated(next.question, translations)
    if (next.options?.length) {
      next.options = next.options.map(option => ({
        ...option,
        label: mapTranslated(option.label, translations),
      }))
    }
    return next
  })
}
