import { enrichApiMatches } from './fifaMatchNumbers.js'
import { displayTeamName } from './teamNamesEs.js'
import { userFacingError } from './userFacingError.js'

export const WC_CODE = 'WC'
const API_BASE = 'https://api.football-data.org/v4'

const STAGE_TO_ROUND = {
  LAST_32: 'r32',
  LAST_16: 'r16',
  QUARTER_FINALS: 'qf',
  SEMI_FINALS: 'sf',
  THIRD_PLACE: '3rd',
  FINAL: 'final',
}

const ROUND_LABELS = {
  r32: 'Ronda de 32',
  r16: 'Octavos de Final',
  qf: 'Cuartos de Final',
  sf: 'Semifinales',
  '3rd': '3er y 4to Puesto',
  final: 'Final',
}

const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'LIVE'])
const UPCOMING_STATUSES = new Set(['SCHEDULED', 'TIMED'])

export function formatMatchDateTime(utcDate, locale = 'es-ES') {
  if (!utcDate) return '—'
  return new Date(utcDate).toLocaleString(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  })
}

export function formatGroupLabel(group) {
  if (!group) return ''
  return group.replace('GROUP_', 'Grupo ')
}

export function formatStageLabel(stage) {
  const map = {
    GROUP_STAGE: 'Fase de grupos',
    LAST_32: 'Ronda de 32',
    LAST_16: 'Octavos',
    QUARTER_FINALS: 'Cuartos',
    SEMI_FINALS: 'Semifinal',
    THIRD_PLACE: '3er puesto',
    FINAL: 'Final',
  }
  return map[stage] || stage
}

/** @deprecated Usa el componente MatchStatus de components/icons.js en la UI */
export function matchStatusLabel(status, highlight, upcoming) {
  if (highlight || LIVE_STATUSES.has(status)) return 'EN JUEGO'
  if (upcoming || UPCOMING_STATUSES.has(status)) return ''
  if (status === 'FINISHED') return 'Finalizado'
  if (status === 'POSTPONED') return 'Aplazado'
  return status
}

export function transformGroupMatches(apiMatches) {
  return (apiMatches || [])
    .filter(m => m.stage === 'GROUP_STAGE')
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
    .map(m =>
      enrichMatch({
        id: String(m.id),
        stage: 'GROUP_STAGE',
        group: (m.group || '').replace('GROUP_', ''),
        home: displayTeamName(m.homeTeam?.shortName || m.homeTeam?.name),
        away: displayTeamName(m.awayTeam?.shortName || m.awayTeam?.name),
        homeCrest: m.homeTeam?.crest,
        awayCrest: m.awayTeam?.crest,
        utcDate: m.utcDate,
        venue: m.venue,
        status: m.status,
        matchday: m.matchday,
        pageUrl: m.pageUrl,
      }),
    )
}

export function transformKnockoutMatches(apiMatches) {
  const enriched = enrichApiMatches(apiMatches)
  return enriched
    .filter(m => m.stage && m.stage !== 'GROUP_STAGE')
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
    .map(m => ({
      id: String(m.id),
      roundId: STAGE_TO_ROUND[m.stage] || m.stage,
      roundLabel: ROUND_LABELS[STAGE_TO_ROUND[m.stage]] || formatStageLabel(m.stage),
      home: displayTeamName(m.homeTeam?.shortName || m.homeTeam?.name),
      away: displayTeamName(m.awayTeam?.shortName || m.awayTeam?.name),
      homeTeam: displayTeamName(m.homeTeam?.name),
      awayTeam: displayTeamName(m.awayTeam?.name),
      homeCrest: m.homeTeam?.crest,
      awayCrest: m.awayTeam?.crest,
      utcDate: m.utcDate,
      venue: m.venue,
      status: m.status,
      stage: m.stage,
      pageUrl: m.pageUrl,
      matchNumber: m.matchNumber,
      fifaMatchLabel: m.fifaMatchLabel,
      homeSource: m.homeSource,
      awaySource: m.awaySource,
      homeSlotLabel: m.homeSlotLabel,
      awaySlotLabel: m.awaySlotLabel,
      knockoutMatchupLabel: m.knockoutMatchupLabel,
      _fp: m._fp,
    }))
}

export function buildGroupsDataFromMatches(groupMatches) {
  const groups = {}
  groupMatches.forEach(m => {
    if (!m.group) return
    if (!groups[m.group]) groups[m.group] = new Set()
    groups[m.group].add(m.home)
    groups[m.group].add(m.away)
  })
  return Object.fromEntries(
    Object.entries(groups).map(([k, v]) => [k, [...v].sort()])
  )
}

/** Client: fetch via Next.js proxy (datos en vivo) */
function sanitizeClientError(message, fallback = 'No se pudo cargar. Inténtalo de nuevo.') {
  return userFacingError(message, fallback)
}

export async function fetchWcResource(resource, params = {}) {
  const qs = new URLSearchParams({ resource, ...params })
  const res = await fetch(`/api/football?${qs}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(sanitizeClientError(data.error, 'No se pudo cargar. Inténtalo de nuevo.'))
  }
  return data
}

export async function fetchWcMatchesClient(options = {}) {
  const params = { resource: 'matches' }
  if (options.force) params.force = '1'
  const data = await fetchWcResource('matches', options.force ? { force: '1' } : {})
  return data.matches || []
}

export async function fetchWcTeamsClient() {
  return []
}

export async function fetchWcMatchClient(matchId, options = {}) {
  return fetchWcResource('match', {
    id: String(matchId),
    ...(options.force ? { force: '1' } : {}),
  })
}

const DEFAULT_FETCH_TIMEOUT_MS = 8000
const DEFAULT_FETCH_RETRIES = 1

/** Server: direct call to football-data.org (timeout + reintento ante red lenta) */
export async function footballDataFetch(path, searchParams = {}, options = {}) {
  const token = process.env.FOOTBALL_DATA_API_KEY
  if (!token) {
    throw new Error('FOOTBALL_DATA_API_KEY no configurada')
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS
  const retries = options.retries ?? DEFAULT_FETCH_RETRIES
  const url = new URL(`${API_BASE}${path}`)
  Object.entries(searchParams).forEach(([k, v]) => {
    if (v != null && v !== '') url.searchParams.set(k, v)
  })

  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url.toString(), {
        headers: { 'X-Auth-Token': token },
        cache: 'no-store',
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (!res.ok) {
        const err = await res.text().catch(() => res.statusText)
        throw new Error(err || `football-data ${res.status}`)
      }
      return await res.json()
    } catch (e) {
      clearTimeout(timer)
      lastError = e
      const retryable =
        e?.name === 'AbortError' ||
        e?.code === 'ETIMEDOUT' ||
        /timeout|aborted|fetch failed/i.test(String(e?.message || e))
      if (retryable && attempt < retries) continue
      if (e?.name === 'AbortError') {
        throw new Error(`football-data.org timeout (${timeoutMs}ms)`)
      }
      throw e
    }
  }
  throw lastError
}
