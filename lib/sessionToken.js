const STORAGE_KEY = 'porra_write_token'

/** Token HMAC-lite para validar escrituras en API (no sustituye auth fuerte) */
export async function createWriteToken(groupId, userId) {
  const payload = `${groupId}:${userId}:${Date.now()}`
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', keyMaterial, enc.encode(payload))
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  const token = btoa(`${payload}:${sigHex}`)
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ groupId, userId, token }))
  }
  return token
}

export function getStoredWriteToken(groupId, userId) {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (data.groupId === groupId && data.userId === userId) return data.token
  } catch { /* ignore */ }
  return null
}

function getSecret() {
  return process.env.NEXT_PUBLIC_PORRA_SESSION_SALT || 'porra-mundial-2026-dev-salt'
}

export async function verifyWriteToken(token, groupId, userId) {
  if (!token) return false
  try {
    const decoded = typeof atob !== 'undefined' ? atob(token) : Buffer.from(token, 'base64').toString('utf8')
    const sep = decoded.lastIndexOf(':')
    if (sep < 0) return false
    const payload = decoded.slice(0, sep)
    const sigHex = decoded.slice(sep + 1)
    const parts = payload.split(':')
    const g = parts[0]
    const u = parts[1]
    if (g !== groupId || u !== userId) return false
    const secret =
      (typeof process !== 'undefined' && process.env?.PORRA_SESSION_SECRET) ||
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_PORRA_SESSION_SALT) ||
      getSecret()
    const enc = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const expected = await crypto.subtle.sign('HMAC', keyMaterial, enc.encode(payload))
    const expectedHex = Array.from(new Uint8Array(expected)).map(b => b.toString(16).padStart(2, '0')).join('')
    return expectedHex === sigHex
  } catch {
    return false
  }
}
