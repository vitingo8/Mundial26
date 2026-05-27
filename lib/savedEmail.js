const STORAGE_KEY = 'porra_saved_email'

export function getSavedEmail() {
  if (typeof localStorage === 'undefined') return ''
  try {
    return localStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export function saveEmail(email) {
  if (typeof localStorage === 'undefined' || !email) return
  try {
    localStorage.setItem(STORAGE_KEY, email)
  } catch { /* ignore quota */ }
}
