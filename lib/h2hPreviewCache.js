/** Caché en cliente: headToHead por matchId (null = sin historial). */
const cache = new Map()
const inflight = new Map()

export function peekMatchH2h(matchId) {
  if (matchId == null) return undefined
  if (!cache.has(String(matchId))) return undefined
  return cache.get(String(matchId))
}

export function storeMatchH2h(matchId, headToHead) {
  if (matchId == null) return
  const h2h = headToHead?.matches?.length ? headToHead : null
  cache.set(String(matchId), h2h)
  return h2h
}

/**
 * @param {() => Promise<{ headToHead?: object } | null>} fetchDetail
 * @returns {Promise<object|null>} headToHead o null si no hay enfrentamientos
 */
export async function loadMatchH2hPreview(matchId, fetchDetail) {
  if (matchId == null) return null
  const key = String(matchId)
  if (cache.has(key)) return cache.get(key)
  if (inflight.has(key)) return inflight.get(key)

  const p = fetchDetail()
    .then(data => storeMatchH2h(key, data?.headToHead))
    .catch(() => {
      cache.set(key, null)
      return null
    })
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, p)
  return p
}
