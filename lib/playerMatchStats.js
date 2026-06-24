import { playerPhotoUrl } from './mediaUrls.js'

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
  if (!pos || pos === 'Player') return null
  return POSITION_NAME_SHORT[pos] || pos.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()
}

const STAT_LABELS_ES = {
  'FotMob rating': 'Nota',
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
  51: 'MC',
  59: 'CAI',
  60: 'CAD',
  61: 'MC',
  62: 'MP',
  63: 'SAI',
  64: 'MC',
  65: 'MC',
  66: 'MCO',
  68: 'MCO',
  73: 'MC',
  75: 'MC',
  77: 'MC',
  82: 'MC',
  84: 'MCO',
  86: 'ED',
  88: 'MCO',
  104: 'MC',
  105: 'ED',
  106: 'ED',
  115: 'MC',
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
      optaId: entry.optaId != null ? Number(entry.optaId) : null,
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
      shots: normalizePlayerShots(entry.shotmap),
    }
  }
  return map
}

const SHOT_EVENT_ES = {
  Goal: 'Gol',
  AttemptSaved: 'Parada',
  Miss: 'Fuera',
  Blocked: 'Bloqueado',
  Post: 'Palo',
}

const SHOT_TYPE_ES = {
  RightFoot: 'Pie derecho',
  LeftFoot: 'Pie izquierdo',
  Header: 'Cabeza',
  Other: 'Otro',
}

const SHOT_SITUATION_ES = {
  RegularPlay: 'Juego normal',
  FromCorner: 'Córner',
  FreeKick: 'Falta',
  SetPiece: 'Balón parado',
  FastBreak: 'Contraataque',
  ThrowIn: 'Saque de banda',
  Penalty: 'Penalti',
}

const GOAL_CENTER_Y = 34
const GOAL_HALF_WIDTH = 3.66

/** Vista recortada del área rival (sin medio campo vacío). */
export const SHOT_MAP_VIEW_WIDTH = 68
export const SHOT_MAP_VIEW_HEIGHT = 36

/** Líneas del campo en coords SVG (y = ancho del campo, 0–68). */
export const SHOT_MAP_PENALTY_BOX = { x: 13.84, width: 40.32, height: 16 }
export const SHOT_MAP_GOAL_AREA = { x: 24.84, width: 18.32, height: 5.5 }
export const SHOT_MAP_GOAL = { x: 30.34, width: 7.32, height: 0.9 }

const SHOT_MAP_PENALTY_ARC_DX = Math.sqrt(9 * 9 - (SHOT_MAP_PENALTY_BOX.height - 11) ** 2)
export const SHOT_MAP_PENALTY_ARC = {
  x1: SHOT_MAP_VIEW_WIDTH / 2 - SHOT_MAP_PENALTY_ARC_DX,
  x2: SHOT_MAP_VIEW_WIDTH / 2 + SHOT_MAP_PENALTY_ARC_DX,
  y: SHOT_MAP_PENALTY_BOX.height,
}

const GOAL_CROSSBAR_M = 2.44
const SHOT_GOAL_LINE_X = 104.05
const BLOCKED_BEFORE_GOAL_X = 103

/** Medio campo rival: x 52.5→105, y 0→68. SVG con portería arriba. */
export function shotPitchToSvg(x, y) {
  return { sx: y, sy: 105 - x }
}

/** Punto en la boca de la portería (mapa de campo). */
export function shotGoalFaceToSvg(shot) {
  let sx = shot.goalCrossedY != null ? Number(shot.goalCrossedY) : null
  if (sx == null && shot.blockedY != null && Number(shot.blockedX ?? 0) >= BLOCKED_BEFORE_GOAL_X) {
    sx = Number(shot.blockedY)
  }
  if (sx == null) return null

  let sy
  if (shot.onGoal?.y != null) {
    sy = (1 - Number(shot.onGoal.y)) * SHOT_MAP_GOAL.height
  } else if (shot.goalCrossedZ != null) {
    const zRatio = Math.min(Number(shot.goalCrossedZ) / GOAL_CROSSBAR_M, 1.15)
    sy = SHOT_MAP_GOAL.height * (1 - zRatio)
  } else {
    sy = SHOT_MAP_GOAL.height * 0.5
  }

  return { sx, sy }
}

export function shouldShowShotGoalDot(shot) {
  return shotGoalFaceToSvg(shot) != null
}

/** Final de la trayectoria en el mapa de campo (siempre hacia la boca de gol). */
export function shotTrajectoryEndSvg(shot) {
  const goalFace = shotGoalFaceToSvg(shot)
  if (goalFace) return goalFace

  if (shot.blockedX != null && shot.blockedY != null) {
    return shotPitchToSvg(shot.blockedX, shot.blockedY)
  }

  return shotPitchToSvg(SHOT_GOAL_LINE_X, shot.y)
}

/** Vista frontal de la portería (panel xG). onGoal usa escala distinta al campo. */
export function onGoalShotToSvg(onGoal) {
  if (!onGoal || onGoal.x == null || onGoal.y == null) return null
  const goalLeft = GOAL_CENTER_Y - GOAL_HALF_WIDTH
  const goalWidth = GOAL_HALF_WIDTH * 2
  return {
    sx: goalLeft + (Number(onGoal.x) / 2) * goalWidth,
    sy: (1 - Number(onGoal.y)) * 14 + 2,
  }
}

export function miniGoalShotToSvg(onGoal) {
  if (!onGoal || onGoal.x == null || onGoal.y == null) return null
  const goalLeft = 22
  const goalWidth = 24
  return {
    sx: goalLeft + (Number(onGoal.x) / 2) * goalWidth,
    sy: 2 + (1 - Number(onGoal.y)) * 14,
  }
}

export function formatShotType(shotType) {
  return SHOT_TYPE_ES[shotType] || shotType || '—'
}

export function formatShotSituation(situation) {
  return SHOT_SITUATION_ES[situation] || situation || '—'
}

export function formatShotMinute(minute, minAdded) {
  if (minute == null) return '—'
  if (minAdded) return `${minute}+${minAdded}'`
  return `${minute}'`
}

export function formatShotXg(value) {
  if (value == null || Number.isNaN(value)) return '—'
  return Number(value).toFixed(2)
}

export function normalizePlayerShots(raw = []) {
  if (!Array.isArray(raw) || !raw.length) return []
  return raw
    .map(shot => ({
      id: shot.id,
      eventType: shot.eventType,
      eventLabel: SHOT_EVENT_ES[shot.eventType] || shot.eventType,
      minute: shot.min,
      minAdded: shot.minAdded,
      x: shot.x,
      y: shot.y,
      blockedX: shot.blockedX ?? null,
      blockedY: shot.blockedY ?? null,
      goalCrossedY: shot.goalCrossedY ?? null,
      goalCrossedZ: shot.goalCrossedZ ?? null,
      isOnTarget: !!shot.isOnTarget,
      isBlocked: !!shot.isBlocked,
      isGoal: shot.eventType === 'Goal',
      onGoal: shot.onGoalShot || null,
      xG: shot.expectedGoals != null ? Number(shot.expectedGoals) : null,
      xGOT: shot.expectedGoalsOnTarget != null ? Number(shot.expectedGoalsOnTarget) : null,
      shotType: shot.shotType || null,
      situation: shot.situation || null,
      teamColor: shot.teamColor || '#ef4444',
    }))
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0))
}

export function getShotMapColor(shot, selected = false) {
  if (shot.isGoal) return selected ? '#16a34a' : '#22c55e'
  if (shot.eventType === 'Miss') return selected ? '#9ca3af' : '#cbd5e1'
  return selected ? (shot.teamColor || '#e53935') : '#f87171'
}

export function getShotMapFill(shot) {
  if (shot.isGoal) return 'rgba(22, 163, 74, 0.15)'
  if (shot.eventType === 'Miss') return 'rgba(203, 213, 225, 0.35)'
  return 'rgba(248, 113, 113, 0.2)'
}

export function getShotMapLineColor(shot, selected = false) {
  if (shot.isGoal) return selected ? '#16a34a' : '#22c55e'
  if (shot.eventType === 'Miss') return selected ? '#64748b' : '#94a3b8'
  return getShotMapColor(shot, selected)
}

export function formatShotTooltip(shot) {
  const parts = [shot.eventLabel]
  if (shot.minute != null) parts.push(`${shot.minute}'`)
  if (shot.xG != null) parts.push(`xG ${shot.xG.toFixed(2)}`)
  return parts.join(' · ')
}

export function getFotmobPositionShort({ positionId, usualPosition, position, isGoalkeeper }) {
  if (isGoalkeeper || positionId === 11) return 'POR'
  if (positionId != null && POSITION_ID_SHORT[positionId]) {
    return POSITION_ID_SHORT[positionId]
  }
  if (usualPosition != null && USUAL_POSITION_SHORT[usualPosition]) {
    return USUAL_POSITION_SHORT[usualPosition]
  }
  if (position) {
    const short = shortPositionName(position)
    if (short) return short
  }
  return '—'
}

const HEATMAP_CIRCLE_PLACEHOLDER = '{{circles__placeholder}}'

export function buildPlayerHeatmapSvg(template, circles, idSuffix = 'heat') {
  if (!template || !circles || !template.includes(HEATMAP_CIRCLE_PLACEHOLDER)) return null
  let svg = template.replace(HEATMAP_CIRCLE_PLACEHOLDER, circles)
  svg = svg.replace(/\bid="g"/g, `id="${idSuffix}-g"`)
  svg = svg.replace(/\bid="h"/g, `id="${idSuffix}-h"`)
  svg = svg.replace(/url\(#g\)/g, `url(#${idSuffix}-g)`)
  svg = svg.replace(/url\(#h\)/g, `url(#${idSuffix}-h)`)
  return svg
}

export function countryFlagUrl(_countryCode) {
  return null
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
    isGoalkeeper: stats?.isGoalkeeper ?? fromLineup?.positionId === 11,
  })

  return {
    id: Number(id),
    optaId: stats?.optaId ?? null,
    name,
    photoUrl: fromLineup?.photoUrl || playerPhotoUrl(id),
    rating,
    positionShort,
    age: fromLineup?.age ?? null,
    club: fromLineup?.club || null,
    clubCrest: fromLineup?.clubCrest ?? null,
    countryCode: fromLineup?.countryCode || null,
    countryFlagUrl: fromLineup?.countryFlagUrl ?? null,
    teamName: stats?.teamName || null,
    shirtNumber: fromLineup?.shirtNumber ?? stats?.shirtNumber ?? null,
    highlights: stats?.highlights || [],
    statSections: stats?.statSections || [],
    topStats: stats?.topStats || [],
    touches: stats?.touches ?? null,
    shots: stats?.shots || [],
    hasStats: Boolean(stats?.statSections?.length),
    hasHighlights: Boolean(stats?.highlights?.length),
    hasShots: Boolean(stats?.shots?.length),
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
