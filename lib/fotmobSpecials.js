import { FOTMOB_WC_LEAGUE_ID } from './fotmob.js'
import { playerPhotoUrl } from './mediaUrls.js'

export const FOTMOB_WC_SEASON_ID = '24254'

export const FOTMOB_SPECIALS_URLS = {
  scorers: 'https://www.fotmob.com/es/leagues/77/stats/season/24254/players/goals/world-cup-players',
  assists: 'https://www.fotmob.com/es/leagues/77/stats/season/24254/players/goal_assist/world-cup-players',
  rating: 'https://www.fotmob.com/es/leagues/77/stats/season/24254/players/rating',
  keepers: 'https://www.fotmob.com/es/leagues/77/stats/season/24254/players/rating?position=keeper',
}

/** Código de posición FotMob para porteros. */
export const FOTMOB_GK_POSITION = 11

const STATS_JSON_BASE = `https://data.fotmob.com/stats/${FOTMOB_WC_LEAGUE_ID}/season/${FOTMOB_WC_SEASON_ID}`

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; Mundial26/1.0)',
  Accept: 'application/json',
}

function formatValue(value, kind) {
  if (value == null || Number.isNaN(value)) return '—'
  if (kind === 'rating') return Number(value).toFixed(2)
  return String(value)
}

function normalizeStatRow(row, kind) {
  const playerId = row?.ParticiantId ?? row?.ParticipantId ?? row?.id ?? null
  const value = row?.StatValue ?? row?.value ?? null
  return {
    rank: row?.Rank ?? row?.rank ?? null,
    name: row?.ParticipantName || row?.name || '—',
    team: row?.TeamName || row?.teamName || '',
    value,
    valueLabel: formatValue(value, kind),
    playerId,
    teamId: row?.TeamId ?? row?.teamId ?? null,
    photo: playerId ? playerPhotoUrl(playerId) : null,
    secondary: null,
  }
}

function extractStatList(payload, statName) {
  const lists = payload?.TopLists
  if (!Array.isArray(lists)) return []
  const block = lists.find(item =>
    String(item?.StatName || item?.name || '').toLowerCase() === statName.toLowerCase(),
  ) || lists[0]
  return Array.isArray(block?.StatList) ? block.StatList : []
}

async function fetchStatJson(stat) {
  const res = await fetch(`${STATS_JSON_BASE}/${stat}.json`, {
    headers: FETCH_HEADERS,
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`FotMob stats ${stat} ${res.status}`)
  return res.json()
}

function buildPlayers(statList, kind, secondaryByPlayer = null, secondaryKind = null) {
  return statList
    .map(row => {
      const player = normalizeStatRow(row, kind)
      if (secondaryByPlayer && secondaryKind && player.playerId != null) {
        const secondaryValue = secondaryByPlayer.get(String(player.playerId))
        if (secondaryValue != null && secondaryValue > 0) {
          const label = secondaryKind === 'assists' ? 'Asist.' : 'Goles'
          player.secondary = { label, value: String(secondaryValue) }
        }
      }
      return player
    })
    .filter(row => row.name && row.name !== '—')
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
}

function buildKeepers(statList, count) {
  return statList
    .filter(row => Array.isArray(row?.Positions) && row.Positions.includes(FOTMOB_GK_POSITION))
    .sort((a, b) => (b?.StatValue ?? 0) - (a?.StatValue ?? 0))
    .slice(0, count)
    .map((row, index) => {
      const player = normalizeStatRow(row, 'rating')
      player.rank = index + 1
      return player
    })
    .filter(row => row.name && row.name !== '—')
}

export async function fetchFotmobSpecials({ count = 20 } = {}) {
  const [goalsPayload, assistsPayload, ratingPayload] = await Promise.all([
    fetchStatJson('goals'),
    fetchStatJson('goal_assist'),
    fetchStatJson('rating'),
  ])

  const goalsList = extractStatList(goalsPayload, 'goals')
  const assistsList = extractStatList(assistsPayload, 'goal_assist')
  const ratingList = extractStatList(ratingPayload, 'rating')

  const assistsByPlayer = new Map(
    assistsList.map(row => {
      const id = row?.ParticiantId ?? row?.ParticipantId
      return [String(id), row?.StatValue ?? 0]
    }),
  )

  const goalsByPlayer = new Map(
    goalsList.map(row => {
      const id = row?.ParticiantId ?? row?.ParticipantId
      return [String(id), row?.StatValue ?? 0]
    }),
  )

  const scorers = buildPlayers(goalsList, 'scorers', assistsByPlayer, 'assists').slice(0, count)
  const assists = buildPlayers(assistsList, 'assists', goalsByPlayer, 'goals').slice(0, count)
  const rating = buildPlayers(ratingList, 'rating').slice(0, count)
  const keepers = buildKeepers(ratingList, count)

  return {
    scorers: {
      players: scorers,
      available: scorers.length > 0,
      sourceUrl: FOTMOB_SPECIALS_URLS.scorers,
    },
    assists: {
      players: assists,
      available: assists.length > 0,
      sourceUrl: FOTMOB_SPECIALS_URLS.assists,
    },
    rating: {
      players: rating,
      available: rating.length > 0,
      sourceUrl: FOTMOB_SPECIALS_URLS.rating,
    },
    keepers: {
      players: keepers,
      available: keepers.length > 0,
      sourceUrl: FOTMOB_SPECIALS_URLS.keepers,
    },
    fetchedAt: new Date().toISOString(),
  }
}
