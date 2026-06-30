import { buildFotmobLiveCommentary, buildFotmobLtcFeed, buildPlayerLookup, mergeFotmobRawEvents } from './matchDetail.js'
import { normalizeFotmobHeadToHead } from './matchHeadToHead.js'
import { translateLiveCommentaryFeed } from './translateToSpanish.js'
import { playerPhotoUrl, teamCrestUrl } from './mediaUrls.js'
import { resolveHeatmapPubUrl, transformPlayerStatsMap } from './playerMatchStats.js'
import { advancesFromPenaltyShootoutEvent } from './knockoutAdvances.js'

export { playerPhotoUrl as fotmobPlayerPhotoUrl, teamCrestUrl } from './mediaUrls.js'

export const FOTMOB_WC_LEAGUE_ID = 77
const FOTMOB_BASE = 'https://www.fotmob.com'
const DEFAULT_TIMEOUT_MS = 8000
const USER_AGENT = 'Mozilla/5.0 (compatible; Mundial26/1.0)'

const ROUND_TO_STAGE = {
  '1/16': 'LAST_32',
  '1/8': 'LAST_16',
  '1/4': 'QUARTER_FINALS',
  '1/2': 'SEMI_FINALS',
  bronze: 'THIRD_PLACE',
  final: 'FINAL',
}

/** @type {Map<string, string>} matchId → pageUrl slug */
const pageUrlByMatchId = new Map()

function parseScoreStr(scoreStr) {
  if (!scoreStr) return { home: null, away: null }
  const m = String(scoreStr).match(/(\d+)\s*[-–]\s*(\d+)/)
  if (!m) return { home: null, away: null }
  return { home: Number(m[1]), away: Number(m[2]) }
}

function parseLiveMinute(liveTime) {
  if (!liveTime) return null
  const short = String(liveTime.short || '').replace(/[^\d]/g, '')
  if (short) return Number(short)
  const long = liveTime.long
  if (typeof long === 'string' && long.includes(':')) {
    const [mins] = long.split(':')
    const n = Number(mins)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export function normalizeFotmobStatus(status = {}) {
  if (status.cancelled) return 'POSTPONED'
  if (status.finished) return 'FINISHED'
  if (status.ongoing && status.started) {
    const h = status.halfs || {}
    if (h.firstHalfEnded && !h.secondHalfStarted) return 'PAUSED'
    return 'IN_PLAY'
  }
  if (status.started && !status.finished) return 'IN_PLAY'
  return 'TIMED'
}

function inferWinner(home, away, finished) {
  if (!finished || home == null || away == null) return null
  if (home > away) return 'HOME_TEAM'
  if (away > home) return 'AWAY_TEAM'
  return 'DRAW'
}

function resolveStage(fm) {
  if (fm.group) return 'GROUP_STAGE'
  return ROUND_TO_STAGE[fm.round] || 'GROUP_STAGE'
}

function resolveGroup(fm) {
  if (!fm.group) return undefined
  return `GROUP_${String(fm.group).toUpperCase()}`
}

export async function fotmobFetch(path, searchParams = {}, options = {}) {
  const url = new URL(path.startsWith('http') ? path : `${FOTMOB_BASE}${path}`)
  Object.entries(searchParams).forEach(([k, v]) => {
    if (v != null && v !== '') url.searchParams.set(k, v)
  })

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json, text/html;q=0.9',
      },
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) {
      throw new Error(`FotMob ${res.status} ${path}`)
    }
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('json')) return res.json()
    return res.text()
  } catch (e) {
    clearTimeout(timer)
    if (e?.name === 'AbortError') throw new Error(`FotMob timeout (${timeoutMs}ms)`)
    throw e
  }
}

export async function fetchFotmobFixtures() {
  const data = await fotmobFetch('/api/data/leagues', {
    id: String(FOTMOB_WC_LEAGUE_ID),
    tab: 'fixtures',
  })
  const all = data?.fixtures?.allMatches
  if (!Array.isArray(all) || !all.length) {
    throw new Error('FotMob no devolvió el calendario del Mundial')
  }
  for (const m of all) {
    if (m.id && m.pageUrl) pageUrlByMatchId.set(String(m.id), m.pageUrl)
  }
  return {
    matches: all,
    hasOngoingMatch: !!data?.fixtures?.hasOngoingMatch,
  }
}

export function formatFotmobDateYmd(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const y = parts.find(p => p.type === 'year')?.value
  const mo = parts.find(p => p.type === 'month')?.value
  const d = parts.find(p => p.type === 'day')?.value
  return `${y}${mo}${d}`
}

/** Partidos del día con marcadores más frescos (en vivo). */
export async function fetchFotmobDayMatches(dateYmd) {
  const data = await fotmobFetch('/api/data/matches', { date: dateYmd })
  const out = []
  for (const league of data?.leagues || []) {
    if (league.primaryId !== FOTMOB_WC_LEAGUE_ID && league.parentLeagueId !== FOTMOB_WC_LEAGUE_ID) {
      continue
    }
    for (const m of league.matches || []) out.push(m)
  }
  return out
}

export async function fetchFotmobMatchScore(matchId) {
  const data = await fotmobFetch('/api/data/match-score', { matchId: String(matchId) })
  return data?.match || null
}

function extractNextDataPageProps(html) {
  const marker = '<script id="__NEXT_DATA__" type="application/json">'
  const start = html.indexOf(marker)
  if (start === -1) throw new Error('FotMob: sin __NEXT_DATA__')
  const jsonStart = start + marker.length
  const jsonEnd = html.indexOf('</script>', jsonStart)
  const parsed = JSON.parse(html.slice(jsonStart, jsonEnd))
  return parsed?.props?.pageProps
}

/** @type {Map<string, string> | null} */
let fotmobEmojiById = null

function pickLtcLang(langsStr) {
  const langs = String(langsStr || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  if (!langs.length) return 'es'
  if (langs.includes('es')) return 'es'
  const nonGen = langs.find(l => !l.endsWith('_gen'))
  return nonGen || langs[0]
}

async function loadFotmobEmojis() {
  if (fotmobEmojiById) return fotmobEmojiById
  try {
    const res = await fetch('https://data.fotmob.com/webcl/pulse/emojis.json', {
      headers: { 'User-Agent': USER_AGENT },
      cache: 'force-cache',
    })
    if (!res.ok) throw new Error('emoji fetch failed')
    const data = await res.json()
    fotmobEmojiById = new Map((data.emojis || []).map(e => [String(e.id), e.value]))
  } catch {
    fotmobEmojiById = new Map()
  }
  return fotmobEmojiById
}

async function fetchFotmobLtc(pageProps, matchId) {
  const liveticker = pageProps?.content?.liveticker
  if (!liveticker?.teams?.length) return null

  const teams = JSON.stringify(liveticker.teams)
  const fallbackLang = pickLtcLang(liveticker.langs)
  const langs = ['es', fallbackLang].filter((lang, index, arr) => lang && arr.indexOf(lang) === index)

  for (const lang of langs) {
    try {
      const ltcUrl = `http://data.fotmob.com/webcl/ltc/gsm/${matchId}_${lang}.json.gz`
      const ltc = await fotmobFetch('/api/data/ltc', { ltcUrl, teams })
      if (ltc?.events?.length) return { ltc, lang }
    } catch {
      // probar siguiente idioma
    }
  }

  return null
}

async function fetchFotmobPulseBundle(matchId) {
  const emojiById = await loadFotmobEmojis()
  try {
    const res = await fetch(`https://pub.fotmob.com/prod/pulse/api/match/${matchId}`, {
      headers: { 'User-Agent': USER_AGENT },
      cache: 'no-store',
    })
    if (!res.ok) return { reactions: [], emojiById }
    const data = await res.json()
    return { ...data, emojiById }
  } catch {
    return { reactions: [], emojiById }
  }
}

async function enrichDetailWithLtc(detail, pageProps, matchId) {
  try {
    const ltcBundle = await fetchFotmobLtc(pageProps, matchId)
    if (!ltcBundle?.ltc?.events?.length) return detail
    const { ltc } = ltcBundle
    const pulseData = await fetchFotmobPulseBundle(matchId)
    const playerLookup = buildPlayerLookup(detail.homeTeam, detail.awayTeam)
    let liveCommentary = buildFotmobLtcFeed(ltc, pulseData, 'es', { playerLookup })
    return {
      ...detail,
      liveCommentary,
    }
  } catch {
    return detail
  }
}

async function withSpanishCommentary(detail) {
  if (!detail?.liveCommentary?.length) return detail
  return {
    ...detail,
    liveCommentary: await translateLiveCommentaryFeed(detail.liveCommentary),
  }
}

export async function fetchFotmobMatchDetail(matchId, pageUrl) {
  try {
    const api = await fotmobFetch('/api/data/matchDetails', { matchId: String(matchId) })
    if (api?.general?.matchId) {
      const detail = transformFotmobDetailPage(api, matchId)
      return withSpanishCommentary(await enrichDetailWithLtc(detail, api, matchId))
    }
  } catch {
    // fallback a página HTML
  }

  const slug = pageUrl || pageUrlByMatchId.get(String(matchId))
  if (!slug) {
    const scoreOnly = await fetchFotmobMatchScore(matchId)
    if (!scoreOnly) throw new Error('Partido no encontrado en FotMob')
    return withSpanishCommentary(transformFotmobListMatch(scoreOnly))
  }

  const html = await fotmobFetch(slug.startsWith('http') ? slug : `${FOTMOB_BASE}${slug}`)
  const pageProps = extractNextDataPageProps(html)
  if (!pageProps) throw new Error('FotMob: respuesta de partido vacía')
  const detail = transformFotmobDetailPage(pageProps, matchId)
  return withSpanishCommentary(await enrichDetailWithLtc(detail, pageProps, matchId))
}

function teamBlockFromNames(homeName, awayName, homeId, awayId, homeScore, awayScore, crests = {}) {
  return {
    homeTeam: {
      id: homeId,
      name: homeName,
      shortName: homeName,
      crest: crests.homeCrest ?? teamCrestUrl(homeId) ?? null,
    },
    awayTeam: {
      id: awayId,
      name: awayName,
      shortName: awayName,
      crest: crests.awayCrest ?? teamCrestUrl(awayId) ?? null,
    },
    score: {
      fullTime: { home: homeScore, away: awayScore },
      halfTime: { home: null, away: null },
      winner: inferWinner(homeScore, awayScore, homeScore != null && awayScore != null),
    },
  }
}

/** Partido normalizado desde fixture de calendario o match-score. */
export function transformFotmobListMatch(fm) {
  const id = String(fm.id)
  if (fm.pageUrl) pageUrlByMatchId.set(id, fm.pageUrl)

  const homeName = fm.home?.name || fm.home?.longName || 'Local'
  const awayName = fm.away?.name || fm.away?.longName || 'Visitante'
  const homeId = fm.home?.id
  const awayId = fm.away?.id
  const statusObj = fm.status || {}
  const status = normalizeFotmobStatus(statusObj)

  let homeScore = fm.home?.score
  let awayScore = fm.away?.score
  if (homeScore == null || awayScore == null) {
    const parsed = parseScoreStr(statusObj.scoreStr)
    homeScore = parsed.home
    awayScore = parsed.away
  }

  const stage = resolveStage(fm)
  const finished = status === 'FINISHED'

  return {
    id,
    stage,
    group: resolveGroup(fm),
    home: homeName,
    away: awayName,
    utcDate: statusObj.utcTime || fm.utcDate,
    venue: fm.venue || null,
    status,
    matchday: fm.group ? Number(fm.round) || undefined : undefined,
    minute: parseLiveMinute(statusObj.liveTime),
    liveTime: statusObj.liveTime || null,
    pageUrl: fm.pageUrl || pageUrlByMatchId.get(id),
    ...teamBlockFromNames(homeName, awayName, homeId, awayId, homeScore, awayScore, {
      homeCrest: fm.home?.imageUrl || null,
      awayCrest: fm.away?.imageUrl || null,
    }),
    score: {
      fullTime: { home: homeScore, away: awayScore },
      halfTime: { home: null, away: null },
      winner: inferWinner(homeScore, awayScore, finished),
    },
    _source: 'fotmob',
  }
}

export function transformFotmobFixtures(allMatches) {
  return (allMatches || []).map(transformFotmobListMatch)
}

/** Mezcla marcadores en vivo del endpoint diario sobre fixtures crudos. */
export function mergeLiveDayScores(fixtures, dayMatches) {
  if (!dayMatches?.length) return fixtures
  const liveById = new Map(dayMatches.map(m => [String(m.id), m]))
  return fixtures.map(f => {
    const live = liveById.get(String(f.id))
    if (!live) return f
    return {
      ...f,
      home: { ...(f.home || {}), ...(live.home || {}) },
      away: { ...(f.away || {}), ...(live.away || {}) },
      status: {
        ...(f.status || {}),
        ...(live.status || {}),
        liveTime: live.status?.liveTime ?? f.status?.liveTime,
        halfs: live.status?.halfs ?? f.status?.halfs,
      },
    }
  })
}

function mapFotmobEvent(ev, homeName, awayName) {
  const minute = ev.time ?? ev.timeStr
  const teamName = ev.isHome ? homeName : awayName
  if (ev.type === 'Goal') {
    return {
      minute,
      injuryTime: ev.overloadTime || null,
      type: ev.ownGoal ? 'OWN' : ev.isPenaltyShootoutEvent ? 'PENALTY' : 'REGULAR',
      scorer: {
        id: ev.player?.id ?? ev.playerId ?? null,
        name: ev.player?.name || ev.nameStr,
      },
      assist: ev.assistInput || ev.assistStr
        ? {
            id: ev.assistPlayerId ?? null,
            name: ev.assistInput || ev.assistStr.replace(/^assist by\s+/i, ''),
          }
        : undefined,
      team: { name: teamName },
      score: ev.newScore ? { home: ev.newScore[0], away: ev.newScore[1] } : undefined,
    }
  }
  if (ev.type === 'Card') {
    const card = String(ev.card || ev.cardType || 'YELLOW').toUpperCase().includes('RED') ? 'RED' : 'YELLOW'
    return {
      kind: 'card',
      minute,
      card,
      player: {
        id: ev.player?.id ?? ev.playerId ?? null,
        name: ev.player?.name || ev.nameStr,
      },
      team: { name: teamName },
    }
  }
  if (ev.type === 'Substitution' || ev.type === 'subst') {
    const rawOut = ev.playerOut || ev.swap?.[0]
    const rawIn = ev.playerIn || ev.swap?.[1]
    const outName = rawOut?.name || ev.outName
    const inName = rawIn?.name || ev.inName
    const outId = rawOut?.id ?? rawOut?.playerId
    const inId = rawIn?.id ?? rawIn?.playerId
    return {
      kind: 'sub',
      minute,
      playerOut: outName || outId
        ? {
            id: outId,
            name: outName,
            photoUrl: outId ? playerPhotoUrl(outId) : null,
          }
        : null,
      playerIn: inName || inId
        ? {
            id: inId,
            name: inName,
            photoUrl: inId ? playerPhotoUrl(inId) : null,
          }
        : null,
      team: { name: teamName },
    }
  }
  return null
}

function flattenFotmobStats(content) {
  const periods = content?.stats?.Periods
  const all = periods?.All?.stats || periods?.all?.stats
  if (!Array.isArray(all)) return { home: {}, away: {}, rows: [] }

  const rows = []
  const home = {}
  const away = {}

  function walk(groups) {
    for (const g of groups || []) {
      if (!g) continue
      if (Array.isArray(g.stats) && g.stats[0]?.stats && g.stats[0]?.title) {
        walk(g.stats)
        continue
      }
      if (Array.isArray(g.stats) && (typeof g.stats[0] === 'number' || typeof g.stats[0] === 'string')) {
        const key = g.key || g.title
        const label = g.title || key
        home[key] = g.stats[0]
        away[key] = g.stats[1]
        rows.push({ key, label, home: g.stats[0], away: g.stats[1], type: g.type })
        continue
      }
      if (Array.isArray(g.stats)) walk(g.stats.filter(Boolean))
      else if (g.stats) walk([g.stats].flat().filter(Boolean))
    }
  }
  walk(all)
  return { home, away, rows }
}

function mapLineupPlayers(players = []) {
  return players.map(p => ({
    id: p.id,
    name: p.name,
    firstName: p.firstName,
    lastName: p.lastName,
    shirtNumber: p.shirtNumber != null ? Number(p.shirtNumber) : undefined,
    position: positionLabel(p.positionId, p.usualPlayingPositionId),
    rating: p.performance?.rating,
    events: (p.performance?.events || []).map(e => e.type),
    isCaptain: !!p.isCaptain,
    age: p.age,
    marketValue: p.marketValue,
    club: p.primaryTeamName,
    primaryTeamId: p.primaryTeamId,
    countryCode: p.countryCode,
    countryName: p.countryName,
    positionId: p.positionId,
    usualPlayingPositionId: p.usualPlayingPositionId,
    layout: p.horizontalLayout
      ? { x: p.horizontalLayout.x, y: p.horizontalLayout.y }
      : null,
    photoUrl: playerPhotoUrl(p.id),
  }))
}

function positionLabel(positionId, usualPlayingPositionId) {
  const map = {
    11: 'Goalkeeper',
    32: 'Left-Back',
    33: 'Centre-Back',
    34: 'Midfielder',
    35: 'Forward',
    36: 'Right-Back',
    37: 'Defensive Midfield',
    38: 'Attacking Midfield',
    39: 'Left Winger',
    40: 'Right Winger',
    62: 'Midfielder',
    64: 'Midfielder',
    66: 'Attacking Midfield',
    68: 'Attacking Midfield',
    84: 'Attacking Midfield',
    86: 'Right Winger',
    105: 'Right Winger',
  }
  if (map[positionId]) return map[positionId]
  const usual = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward']
  if (usualPlayingPositionId != null && usual[usualPlayingPositionId]) {
    return usual[usualPlayingPositionId]
  }
  return 'Player'
}

function mapLineupTeam(team, sideName) {
  if (!team) return { name: sideName, statistics: {} }
  return {
    id: team.id,
    name: team.name || sideName,
    shortName: team.name || sideName,
    crest: team.imageUrl ?? null,
    formation: team.formation,
    lineup: mapLineupPlayers(team.starters),
    bench: mapLineupPlayers(team.subs || team.substitutes),
    statistics: {},
    rating: team.rating,
  }
}

function extractGroupFromLeagueName(name) {
  const m = String(name || '').match(/Grp\.?\s*([A-L])/i)
  return m ? m[1].toUpperCase() : undefined
}

function collectGoalEventsFromHeader(headerEvents, homeName, awayName) {
  const goals = []
  if (!headerEvents) return goals
  const buckets = [
    ...(Object.values(headerEvents.homeTeamGoals || {})),
    ...(Object.values(headerEvents.awayTeamGoals || {})),
  ]
  for (const list of buckets) {
    for (const ev of list || []) {
      const mapped = mapFotmobEvent({ ...ev, type: 'Goal' }, homeName, awayName)
      if (mapped && !mapped.kind) goals.push(mapped)
    }
  }
  return goals
}

/** Detalle completo desde pageProps de la página del partido. */
export function transformFotmobDetailPage(pageProps, matchId) {
  const general = pageProps.general || {}
  const header = pageProps.header || {}
  const content = pageProps.content || {}
  const statusObj = header.status || {}
  const status = normalizeFotmobStatus(statusObj)
  const teams = header.teams || []
  const homeHdr = teams[0] || {}
  const awayHdr = teams[1] || {}

  const homeScore = homeHdr.score ?? parseScoreStr(statusObj.scoreStr).home
  const awayScore = awayHdr.score ?? parseScoreStr(statusObj.scoreStr).away
  const homeName = homeHdr.name || general.homeTeam?.name
  const awayName = awayHdr.name || general.awayTeam?.name

  const groupLetter = extractGroupFromLeagueName(general.leagueName)
  const stage = groupLetter ? 'GROUP_STAGE' : ROUND_TO_STAGE[general.matchRound] || 'GROUP_STAGE'
  const group = groupLetter ? `GROUP_${groupLetter}` : undefined

  const goals = []
  const bookings = []
  const substitutions = []

  const eventBundle = content.matchFacts?.events || content.events || {}
  const mainEvents = eventBundle.events || []
  const rawEvents = mergeFotmobRawEvents(eventBundle)

  for (const ev of mainEvents) {
    if (ev.isPenaltyShootoutEvent || ev.type === 'MissedPenalty') continue
    const mapped = mapFotmobEvent(ev, homeName, awayName)
    if (!mapped) continue
    if (mapped.kind === 'card') {
      bookings.push(mapped)
    } else if (mapped.kind === 'sub') {
      substitutions.push(mapped)
    } else {
      goals.push(mapped)
    }
  }

  if (!goals.length) {
    goals.push(...collectGoalEventsFromHeader(header.events, homeName, awayName))
  }

  const liveCommentary = buildFotmobLiveCommentary(rawEvents, homeName, awayName)

  const statFlat = flattenFotmobStats(content)
  const homeTeam = mapLineupTeam(content.lineup?.homeTeam, homeName)
  const awayTeam = mapLineupTeam(content.lineup?.awayTeam, awayName)
  homeTeam.statistics = statFlat.home
  awayTeam.statistics = statFlat.away
  homeTeam.fifaRank = homeHdr.fifaRank ?? null
  awayTeam.fifaRank = awayHdr.fifaRank ?? null
  if (homeHdr.imageUrl) homeTeam.crest = homeHdr.imageUrl
  if (awayHdr.imageUrl) awayTeam.crest = awayHdr.imageUrl

  const refereeText = content.matchFacts?.infoBox?.Referee?.text
    || content.matchFacts?.infoBox?.referee?.text
  const venueText = content.matchFacts?.infoBox?.Stadium?.text
    || content.matchFacts?.infoBox?.stadium?.text
    || content.matchFacts?.infoBox?.Venue?.text

  const finished = status === 'FINISHED'
  const xgHome = statFlat.home.expected_goals ?? statFlat.rows.find(r => r.key === 'expected_goals')?.home
  const xgAway = statFlat.away.expected_goals ?? statFlat.rows.find(r => r.key === 'expected_goals')?.away

  const roundNum = general.leagueRoundName || general.matchRound
  const roundLabel = roundNum ? `Jornada ${roundNum}` : null
  const playerStatsById = transformPlayerStatsMap(content.playerStats)
  const heatmapPubUrl = resolveHeatmapPubUrl(content, matchId)

  let penaltyShootoutWinner = null
  for (const ev of rawEvents) {
    penaltyShootoutWinner = advancesFromPenaltyShootoutEvent(ev)
    if (penaltyShootoutWinner) break
  }

  const ftHalf = rawEvents.find(
    e => e.type === 'Half' && (e.halfStrShort === 'FT' || e.halfStrKey === 'fulltime_short'),
  )
  const regulationTime =
    ftHalf?.homeScore != null && ftHalf?.awayScore != null
      ? { home: ftHalf.homeScore, away: ftHalf.awayScore }
      : null

  return {
    id: String(matchId || general.matchId),
    stage,
    group,
    roundLabel,
    teamColors: general.teamColors?.lightMode || null,
    utcDate: statusObj.utcTime || general.matchTimeUTCDate,
    venue: venueText || null,
    status,
    minute: parseLiveMinute(statusObj.liveTime),
    liveTime: statusObj.liveTime || null,
    pageUrl: pageUrlByMatchId.get(String(matchId)),
    homeTeam,
    awayTeam,
    score: {
      fullTime: { home: homeScore, away: awayScore },
      halfTime: { home: null, away: null },
      winner: inferWinner(homeScore, awayScore, finished),
      ...(regulationTime ? { regulationTime } : {}),
      ...(penaltyShootoutWinner ? { penaltyShootoutWinner } : {}),
    },
    goals,
    bookings,
    substitutions,
    liveCommentary,
    referees: refereeText ? [{ id: refereeText, name: refereeText, type: 'REFEREE' }] : [],
    statsComparison: statFlat.rows,
    xg: {
      home: xgHome != null ? Number(xgHome) : null,
      away: xgAway != null ? Number(xgAway) : null,
    },
    weather: content.weather || null,
    lineupFilters: content.lineup?.availableFilters || null,
    rawEvents,
    penaltyShootoutEvents: eventBundle.penaltyShootoutEvents || [],
    playerStatsById,
    heatmapPubUrl,
    headToHead: normalizeFotmobHeadToHead(content.h2h || pageProps.h2h, {
      homeId: homeHdr.id,
      awayId: awayHdr.id,
      homeName,
      awayName,
    }),
    _source: 'fotmob',
  }
}

/** Sobrescribe marcador/minuto/estado con el snapshot ligero (match-score). */
export function applyLiveOverlay(detail, live) {
  if (!detail || !live) return detail
  const hasScore = live.score?.fullTime?.home != null && live.score?.fullTime?.away != null
  return {
    ...detail,
    status: live.status ?? detail.status,
    minute: live.minute ?? detail.minute,
    liveTime: live.liveTime ?? detail.liveTime,
    score: hasScore ? live.score : detail.score,
    homeTeam: {
      ...detail.homeTeam,
      name: detail.homeTeam?.name || live.homeTeam?.name,
      shortName: detail.homeTeam?.shortName || live.homeTeam?.shortName,
      crest: detail.homeTeam?.crest || live.homeTeam?.crest,
    },
    awayTeam: {
      ...detail.awayTeam,
      name: detail.awayTeam?.name || live.awayTeam?.name,
      shortName: detail.awayTeam?.shortName || live.awayTeam?.shortName,
      crest: detail.awayTeam?.crest || live.awayTeam?.crest,
    },
  }
}

export function getPageUrlForMatch(matchId) {
  return pageUrlByMatchId.get(String(matchId))
}

export function seedPageUrlIndex(matches) {
  for (const m of matches || []) {
    if (m.id && m.pageUrl) pageUrlByMatchId.set(String(m.id), m.pageUrl)
  }
}
