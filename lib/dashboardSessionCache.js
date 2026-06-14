const CACHE_KEY = 'porra_dashboard_cache'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function saveDashboardCache(group, user) {
  if (typeof sessionStorage === 'undefined' || !group?.id || !user?.id) return
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      groupId: group.id,
      userId: user.id,
      group,
      user,
      ts: Date.now(),
    }))
  } catch {
    /* quota / private mode */
  }
}

export function readDashboardCache(groupId, userId) {
  if (typeof sessionStorage === 'undefined' || !groupId || !userId) return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed.groupId !== groupId || parsed.userId !== userId) return null
    if (Date.now() - (parsed.ts || 0) > CACHE_TTL_MS) return null
    if (!parsed.group || !parsed.user) return null
    return { group: parsed.group, user: parsed.user }
  } catch {
    return null
  }
}

export function readStoredSession() {
  if (typeof window === 'undefined') return null
  if (sessionStorage.getItem('porra_at_home')) return null
  try {
    const raw = localStorage.getItem('porra_session')
    if (!raw) return null
    const { groupId, userId } = JSON.parse(raw)
    if (!groupId || !userId) return null
    return { groupId, userId }
  } catch {
    return null
  }
}

export function resolveInitialScreen() {
  if (typeof window === 'undefined') return 'home'
  const params = new URLSearchParams(window.location.search)
  const hash = window.location.hash.replace('#', '')
  const joinCode = params.get('join') || (hash.startsWith('join-') ? hash.replace('join-', '') : '')
  if (joinCode) return 'join'
  if (params.get('screen') === 'create') return 'create'
  const session = readStoredSession()
  if (session && readDashboardCache(session.groupId, session.userId)) return 'dashboard'
  return 'home'
}

export function readInitialDashboardState() {
  const session = readStoredSession()
  if (!session) return { group: null, user: null }
  const cached = readDashboardCache(session.groupId, session.userId)
  if (!cached) return { group: null, user: null }
  return { group: cached.group, user: cached.user }
}
