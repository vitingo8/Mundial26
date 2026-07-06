import { formatMatchKickoff } from './matchSchedule.js'
import { formatStatsTeamName } from './teamNamesEs.js'
import { teamCrestUrl } from './mediaUrls.js'

const h2hDateLongFmt = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/** Fecha larga para filas H2H: «14 de octubre de 2025». */
export function formatH2hDateLong(utcDate) {
  if (!utcDate) return '—'
  return h2hDateLongFmt.format(new Date(utcDate))
}

export function formatH2hCompetitionLabel(name) {
  if (!name) return ''
  const n = String(name).trim()
  if (/friend/i.test(n)) return 'Amistoso'
  if (/world cup|mundial/i.test(n)) return 'Copa del Mundo'
  if (/confederations/i.test(n)) return 'Copa Confederaciones'
  return n
}

export function isTournamentH2hCompetition(name) {
  return /world cup|mundial|copa del mundo|confederations|confederaciones/i.test(String(name || ''))
}

export function isWorldCupH2hCompetition(name) {
  return /world cup|mundial|copa del mundo/i.test(String(name || ''))
}

function formatH2hScoreLabel(scoreStr, parsed) {
  if (parsed?.home != null && parsed?.away != null) {
    return `${parsed.home} - ${parsed.away}`
  }
  const m = String(scoreStr || '').match(/(\d+)\s*[-–]\s*(\d+)/)
  if (m) return `${m[1]} - ${m[2]}`
  return scoreStr || '—'
}

/** Partido aún no en juego (sin marcador en vivo). */
export function isMatchNotStarted(status) {
  if (!status) return true
  return status !== 'FINISHED' && status !== 'IN_PLAY' && status !== 'PAUSED' && status !== 'LIVE'
}

export function isFotmobCatalogMatchId(id) {
  return /^\d+$/.test(String(id ?? ''))
}

function parseScoreStr(str) {
  const m = String(str || '').match(/(\d+)\s*[-–]\s*(\d+)/)
  if (!m) return { home: null, away: null }
  return { home: Number(m[1]), away: Number(m[2]) }
}

/**
 * Normaliza el bloque h2h de FotMob (content.h2h).
 * summary: [victorias local actual, empates, victorias visitante actual]
 */
export function normalizeFotmobHeadToHead(raw, { homeId, awayId, homeName, awayName } = {}) {
  if (!raw) return null

  const summaryArr = Array.isArray(raw.summary) ? raw.summary : []
  const homeWins = summaryArr[0] ?? 0
  const draws = summaryArr[1] ?? 0
  const awayWins = summaryArr[2] ?? 0

  const matches = (raw.matches || [])
    .map((m, idx) => {
      const scoreStr = m.status?.scoreStr || null
      const parsed = parseScoreStr(scoreStr)
      const hName = m.home?.name || 'Local'
      const aName = m.away?.name || 'Visitante'
      const utcDate = m.time?.utcTime || m.status?.utcTime || null
      return {
        id: m.matchUrl || `h2h-${idx}`,
        utcDate,
        dateLabel: utcDate ? formatH2hDateLong(utcDate) : '—',
        kickoffLabel: utcDate ? formatMatchKickoff(utcDate) : '',
        competition: formatH2hCompetitionLabel(m.league?.name || ''),
        competitionRaw: m.league?.name || '',
        home: {
          id: m.home?.id ?? null,
          name: formatStatsTeamName(hName),
          crest: teamCrestUrl(m.home?.id) || null,
        },
        away: {
          id: m.away?.id ?? null,
          name: formatStatsTeamName(aName),
          crest: teamCrestUrl(m.away?.id) || null,
        },
        score: parsed,
        scoreLabel: formatH2hScoreLabel(scoreStr, parsed),
        finished: Boolean(m.status?.finished || m.finished),
      }
    })
    .filter(m => m.home.name && m.away.name)
    .sort((a, b) => {
      if (!a.utcDate) return 1
      if (!b.utcDate) return -1
      return new Date(b.utcDate) - new Date(a.utcDate)
    })

  return {
    homeWins,
    draws,
    awayWins,
    total: matches.length,
    matches,
    homeName: homeName ? formatStatsTeamName(homeName) : '',
    awayName: awayName ? formatStatsTeamName(awayName) : '',
    homeId: homeId ?? null,
    awayId: awayId ?? null,
  }
}
