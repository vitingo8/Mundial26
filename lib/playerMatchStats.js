import { fotmobPlayerPhotoUrl, teamCrestUrl } from './fotmob.js'

const POSITION_NAME_SHORT = {
  Goalkeeper: 'POR',
  Defender: 'DEF',
  Midfielder: 'MC',
  Forward: 'DEL',
  'Centre-Back': 'DFC',
  'Left-Back': 'LI',
  'Right-Back': 'LD',
  'Defensive Midfield': 'MCD',
  'Central Midfield': 'MC',
  'Attacking Midfield': 'MCO',
  'Left Winger': 'EI',
  'Right Winger': 'ED',
  'Centre-Forward': 'DC',
}

function shortPositionName(pos) {
  if (!pos) return null
  return POSITION_NAME_SHORT[pos] || pos.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()
}

const STAT_LABELS_ES = {
  'FotMob rating': 'Nota FotMob',
  Goals: 'Goles',
  Assists: 'Asistencias',
  'Expected assists (xA)': 'Asistencias esperadas (xA)',
  'xG + xA': 'xG + xA',
  'Accurate passes': 'Pases acertados',
  'Chances created': 'Ocasiones creadas',
  Saves: 'Paradas',
  'Goals conceded': 'Goles encajados',
  'xGOT faced': 'xGOT recibidos',
  'Goals prevented': 'Goles evitados',
  Touches: 'Toques',
  'Minutes played': 'Minutos jugados',
  'Defensive actions': 'Acciones defensivas',
  'Expected goals (xG)': 'Goles esperados (xG)',
  'Expected goals on target (xGOT)': 'Goles esperados a puerta (xGOT)',
  'Total shots': 'Tiros totales',
  'Shots on target': 'Tiros a puerta',
  'Shots off target': 'Tiros fuera',
  'Blocked shots': 'Tiros bloqueados',
  'Shot accuracy': 'Precisión de tiro',
  'Successful dribbles': 'Regates completados',
  'Touches in opposition box': 'Toques en área rival',
  'Passes into final third': 'Pases al último tercio',
  'Accurate crosses': 'Centros acertados',
  'Accurate long balls': 'Balones largos acertados',
  'Interceptions': 'Intercepciones',
  'Tackles': 'Entradas',
  'Clearances': 'Despejes',
  'Recoveries': 'Recuperaciones',
  'Aerial duels won': 'Duelos aéreos ganados',
  'Duels won': 'Duelos ganados',
  'Duels lost': 'Duelos perdidos',
  'Fouls committed': 'Faltas cometidas',
  'Was fouled': 'Faltas recibidas',
}

const GROUP_TITLES_ES = {
  'Top stats': 'Estadísticas principales',
  Attack: 'Ataque',
  Defense: 'Defensa',
  Duels: 'Duelos',
  Goalkeeping: 'Portería',
}

const FUN_FACT_ES = {
  fun_fact_most_key_passes_created: 'Creó más ocasiones (%s)',
  fun_fact_joint_most_key_passes_created: 'Creó las ocasiones más claras (empatado) (%s)',
  fun_fact_most_dribbles: 'Completó más regates (%s)',
  fun_fact_joint_most_dribbles: 'Completó más regates (empatado) (%s)',
  fun_fact_most_shots: 'Realizó más tiros (%s)',
  fun_fact_joint_most_shots: 'Realizó más tiros (empatado) (%s)',
  fun_fact_most_touches: 'Tuvo más toques (%s)',
  fun_fact_joint_most_touches: 'Tuvo más toques (empatado) (%s)',
  fun_fact_most_passes: 'Completó más pases (%s)',
  fun_fact_red_card: 'Recibió una tarjeta roja',
  fun_fact_yellow_card: 'Recibió una tarjeta amarilla',
  fun_fact_made_mistake_led_to_goal_plurals: 'Cometió un error que derivó en gol',
  fun_fact_joint_most_defensive_contributions: 'Máximo en acciones defensivas (empatado) (%s)',
  fun_fact_most_defensive_contributions: 'Máximo en acciones defensivas (%s)',
  fun_fact_scored_first_goal: 'Marcó el primer gol del partido',
  fun_fact_assist: 'Dio una asistencia',
}

const POSITION_ID_SHORT = {
  11: 'POR',
  32: 'LI',
  33: 'DFC',
  34: 'MC',
  35: 'DC',
  36: 'LD',
  37: 'MCD',
  38: 'MCO',
  39: 'EI',
  40: 'ED',
  59: 'CAI',
  60: 'CAD',
  61: 'MC',
  62: 'MP',
  63: 'SAI',
  64: 'SAD',
}

const USUAL_POSITION_SHORT = ['POR', 'DEF', 'MC', 'DEL']

function translateStatLabel(label) {
  return STAT_LABELS_ES[label] || label
}

function translateGroupTitle(title) {
  return GROUP_TITLES_ES[title] || title
}

function formatFunFact(fact) {
  if (!fact) return null
  const val = fact.value != null ? String(fact.value) : null
  const tpl = FUN_FACT_ES[fact.translationKey]
  if (tpl) {
    return val != null && tpl.includes('%s') ? tpl.replace('%s', val) : tpl
  }
  if (fact.fallbackText) {
    return fact.fallbackText.replace(/%1\$s/g, val ?? '')
  }
  return null
}

export function extractPlayerHighlights(entry) {
  return (entry?.funFacts || [])
    .map(formatFunFact)
    .filter(Boolean)
}

function extractStatRows(statsObj, { popupOnly = false } = {}) {
  const rows = []
  for (const [label, row] of Object.entries(statsObj || {})) {
    if (popupOnly && row.hideInPopupCard) continue
    if (label === 'FotMob rating' || row.key === 'rating_title') continue
    if (row.stat?.type === 'boolean') continue
    const value = formatFotmobStat(row.stat)
    if (value == null) continue
    rows.push({ label: translateStatLabel(label), value })
  }
  return rows
}

export function extractPlayerAllStatSections(entry) {
  const sections = []
  for (const group of entry?.stats || []) {
    const rows = extractStatRows(group.stats)
    if (!rows.length) continue
    sections.push({
      title: translateGroupTitle(group.title || group.key),
      rows,
    })
  }
  return sections
}

function formatFotmobStat(stat) {
  if (!stat || stat.value == null) return null
  if (stat.type === 'fractionWithPercentage') {
    const total = stat.total ?? stat.value
    const pct = total ? Math.round((stat.value / total) * 100) : null
    return pct != null ? `${stat.value}/${total} (${pct}%)` : `${stat.value}/${total}`
  }
  if (stat.type === 'double') return Number(stat.value).toFixed(2)
  return String(stat.value)
}

function extractRating(entry) {
  const top = entry.stats?.find(s => s.key === 'top_stats')
  const rating = top?.stats?.['FotMob rating']?.stat?.value
  return rating != null ? Number(rating) : null
}

function findStatByKey(entry, key) {
  for (const group of entry.stats || []) {
    for (const row of Object.values(group.stats || {})) {
      if (row.key === key && row.stat?.value != null) return row.stat.value
    }
  }
  return null
}

export function extractPlayerPopupStats(entry) {
  const top = entry.stats?.find(s => s.key === 'top_stats')
  if (!top?.stats) return []
  return extractStatRows(top.stats, { popupOnly: true })
}

export function transformPlayerStatsMap(raw = {}) {
  const map = {}
  for (const [id, entry] of Object.entries(raw)) {
    if (!entry || typeof entry !== 'object') continue
    map[String(id)] = {
      id: Number(entry.id) || Number(id),
      name: entry.name,
      teamId: entry.teamId,
      teamName: entry.teamName,
      shirtNumber: entry.shirtNumber,
      isGoalkeeper: !!entry.isGoalkeeper,
      positionId: entry.positionId,
      usualPosition: entry.usualPosition,
      rating: extractRating(entry),
      topStats: extractPlayerPopupStats(entry),
      statSections: extractPlayerAllStatSections(entry),
      highlights: extractPlayerHighlights(entry),
      touches: findStatByKey(entry, 'touches'),
    }
  }
  return map
}

export function getFotmobPositionShort({ positionId, usualPosition, position }) {
  if (positionId != null && POSITION_ID_SHORT[positionId]) {
    return POSITION_ID_SHORT[positionId]
  }
  if (position) {
    const short = shortPositionName(position)
    if (short) return short
  }
  if (usualPosition != null && USUAL_POSITION_SHORT[usualPosition]) {
    return USUAL_POSITION_SHORT[usualPosition]
  }
  return '—'
}

export function countryFlagUrl(countryCode) {
  if (!countryCode) return null
  return `https://images.fotmob.com/image_resources/logo/teamlogo/${String(countryCode).toLowerCase()}.png`
}

export function buildPlayerDetailView(match, playerId, lineupPlayer = null) {
  const id = String(playerId)
  const stats = match?.playerStatsById?.[id]
  const fromLineup = lineupPlayer || findLineupPlayer(match, id)

  if (!fromLineup && !stats) return null

  const name = fromLineup?.name || stats?.name || 'Jugador'
  const rating = stats?.rating ?? fromLineup?.rating ?? null
  const positionShort = getFotmobPositionShort({
    positionId: stats?.positionId ?? fromLineup?.positionId,
    usualPosition: stats?.usualPosition ?? fromLineup?.usualPlayingPositionId,
    position: fromLineup?.position,
  })

  return {
    id: Number(id),
    name,
    photoUrl: fromLineup?.photoUrl || fotmobPlayerPhotoUrl(id),
    rating,
    positionShort,
    age: fromLineup?.age ?? null,
    club: fromLineup?.club || null,
    clubCrest: fromLineup?.primaryTeamId ? teamCrestUrl(fromLineup.primaryTeamId) : null,
    countryCode: fromLineup?.countryCode || null,
    countryFlagUrl: countryFlagUrl(fromLineup?.countryCode),
    teamName: stats?.teamName || null,
    shirtNumber: fromLineup?.shirtNumber ?? stats?.shirtNumber ?? null,
    highlights: stats?.highlights || [],
    statSections: stats?.statSections || [],
    topStats: stats?.topStats || [],
    touches: stats?.touches ?? null,
    hasStats: Boolean(stats?.statSections?.length),
    hasHighlights: Boolean(stats?.highlights?.length),
  }
}

function findLineupPlayer(match, playerId) {
  const id = String(playerId)
  const pools = [
    match?.homeTeam?.lineup,
    match?.homeTeam?.bench,
    match?.awayTeam?.lineup,
    match?.awayTeam?.bench,
  ]
  for (const pool of pools) {
    const hit = pool?.find(p => String(p.id) === id)
    if (hit) return hit
  }
  return null
}

export function collectMatchPlayerRoster(match) {
  const pools = [
    ...(match?.homeTeam?.lineup || []),
    ...(match?.homeTeam?.bench || []),
    ...(match?.awayTeam?.lineup || []),
    ...(match?.awayTeam?.bench || []),
  ]
  const map = new Map()
  for (const p of pools) {
    if (p?.id != null) map.set(String(p.id), p)
  }
  return [...map.values()]
}

export function resolveHeatmapPubUrl(content, matchId) {
  const raw = content?.heatmapUrl
  if (raw) {
    const query = raw.includes('?') ? raw.split('?')[1] : ''
    const pub = new URLSearchParams(query).get('heatmapUrl')
    if (pub) return pub
  }
  return `https://pub.fotmob.com/prod/db/api/heatmap/match/${matchId}`
}
