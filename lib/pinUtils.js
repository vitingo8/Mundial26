/** Hash PIN opcional (SHA-256 en cliente; no es auth fuerte, solo re-entrada ligera) */
export async function hashPin(pin) {
  if (!pin || !String(pin).trim()) return null
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(String(pin).trim()))
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export function normalizeName(name) {
  return (name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}
