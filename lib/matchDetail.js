const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'LIVE'])

export function isLiveMatchStatus(status) {
  return LIVE_STATUSES.has(status)
}

/** Porra: cabecera con marcador API (en vivo o ya finalizado). */
export function isPorraApiResultStatus(status) {
  return isLiveMatchStatus(status) || status === 'FINISHED'
}

/** Marcador principal para cabecera del detalle. */
export function getMatchDetailScore(match) {
  if (!match?.score) return null
  const ft = match.score.fullTime
  if (ft?.home != null && ft?.away != null) {
    return { home: ft.home, away: ft.away, label: null }
  }
  if (isLiveMatchStatus(match.status)) {
    const ht = match.score.halfTime
    if (ht?.home != null && ht?.away != null) {
      return { home: ht.home, away: ht.away, label: 'Descanso' }
    }
  }
  const lastGoal = match.goals?.[match.goals.length - 1]
  if (lastGoal?.score?.home != null && lastGoal?.score?.away != null) {
    return { home: lastGoal.score.home, away: lastGoal.score.away, label: null }
  }
  return null
}

function eventSortKey(minute, injuryTime) {
  const m = minute ?? 0
  const extra = injuryTime ?? 0
  return m * 100 + extra
}

/** Cronología unificada: goles, tarjetas y cambios. */
export function buildMatchTimeline(match) {
  const items = []

  for (const g of match?.goals || []) {
    items.push({
      kind: 'goal',
      minute: g.minute,
      injuryTime: g.injuryTime,
      sortKey: eventSortKey(g.minute, g.injuryTime),
      teamName: g.team?.name,
      playerName: g.scorer?.name,
      assistName: g.assist?.name,
      type: g.type,
      score: g.score,
    })
  }

  for (const b of match?.bookings || []) {
    items.push({
      kind: 'card',
      minute: b.minute,
      injuryTime: null,
      sortKey: eventSortKey(b.minute, 0),
      teamName: b.team?.name,
      playerName: b.player?.name,
      card: b.card,
    })
  }

  for (const s of match?.substitutions || []) {
    items.push({
      kind: 'sub',
      minute: s.minute,
      injuryTime: null,
      sortKey: eventSortKey(s.minute, 0),
      teamName: s.team?.name,
      playerOut: s.playerOut?.name,
      playerIn: s.playerIn?.name,
    })
  }

  items.sort((a, b) => a.sortKey - b.sortKey)
  return items
}

function teamSide(teamName, homeName, awayName) {
  if (teamName == null || teamName === '') return null
  const tn = String(teamName || '').toLowerCase()
  const h = String(homeName || '').toLowerCase()
  const a = String(awayName || '').toLowerCase()
  if (h && (tn === h || tn.includes(h) || h.includes(tn))) return true
  if (a && (tn === a || tn.includes(a) || a.includes(tn))) return false
  return null
}

function goalSubtextFromRaw(ev, assistName) {
  const parts = []
  const typeStr = String(ev?.typeStr || ev?.goalType || '')
  if (ev?.ownGoal) parts.push('Autogol')
  else if (ev?.isPenaltyShootoutEvent || ev?.penalty) parts.push('Penalti')
  else if (/header/i.test(typeStr)) parts.push('Cabeza')
  if (assistName) parts.push(`asistencia de ${assistName}`)
  return parts.join(', ')
}

function goalSubtextFromGoal(g) {
  const parts = []
  if (g.type === 'OWN') parts.push('Autogol')
  else if (g.type === 'PENALTY') parts.push('Penalti')
  if (g.assist?.name) parts.push(`asistencia de ${g.assist.name}`)
  return parts.join(', ')
}

function playerNamesMatch(a, b) {
  const na = normalizePlayerName(a)
  const nb = normalizePlayerName(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

function photoForPlayer(playerId, playerName, lookup) {
  if (playerId != null) return fotmobPlayerPhotoUrl(playerId)
  if (!playerName || !lookup) return null
  for (const p of lookup.values()) {
    if (playerNamesMatch(p.name, playerName)) {
      return p.photoUrl || fotmobPlayerPhotoUrl(p.id)
    }
  }
  return null
}

function resolveEventPlayer(raw, fallbackName, lookup) {
  const fromLookup = raw?.id != null ? lookup?.get(Number(raw.id)) : null
  const id = raw?.id ?? fromLookup?.id ?? null
  const name = raw?.name || fallbackName || fromLookup?.name || null
  if (id == null && !name) return null
  return {
    id,
    name,
    shirtNumber: raw?.shirtNumber ?? fromLookup?.shirtNumber ?? null,
    photoUrl: raw?.photoUrl || photoForPlayer(id, name, lookup),
  }
}

function eventsFromRaw(rawEvents, homeName, awayName, lookup) {
  const items = []
  for (let i = 0; i < rawEvents.length; i++) {
    const ev = rawEvents[i]
    const { minute, injuryTime } = parseEventMinuteLabel(ev.time ?? ev.timeStr)
    const sortKey = eventSortKey(minute, injuryTime)

    if (ev.type === 'Goal') {
      const playerName = ev.player?.name || ev.nameStr || ev.fullName
      if (!playerName) continue
      const assistName = ev.assistInput
        || (ev.assistStr ? ev.assistStr.replace(/^assist by\s+/i, '') : null)
      const score = ev.newScore
        ? { home: ev.newScore[0], away: ev.newScore[1] }
        : (ev.homeScore != null ? { home: ev.homeScore, away: ev.awayScore } : null)
      const playerId = ev.player?.id ?? ev.playerId ?? null
      items.push({
        id: ev.reactKey || `goal-${i}`,
        kind: 'goal',
        minute,
        injuryTime,
        sortKey,
        isHome: ev.isHome,
        playerId,
        playerName,
        photoUrl: photoForPlayer(playerId, playerName, lookup),
        score,
        subtext: goalSubtextFromRaw(ev, assistName),
        goalType: ev.ownGoal ? 'OWN' : ev.isPenaltyShootoutEvent ? 'PENALTY' : 'REGULAR',
      })
      continue
    }

    if (ev.type === 'Substitution' || ev.type === 'subst') {
      const rawIn = ev.playerIn || ev.swap?.[1] || (ev.inName ? { name: ev.inName } : null)
      const rawOut = ev.playerOut || ev.swap?.[0] || (ev.outName ? { name: ev.outName } : null)
      const playerIn = resolveEventPlayer(rawIn, ev.inName, lookup)
      const playerOut = resolveEventPlayer(rawOut, ev.outName, lookup)
      if (!playerIn?.name && !playerOut?.name) continue
      items.push({
        id: ev.reactKey || `sub-${i}`,
        kind: 'sub',
        minute,
        injuryTime,
        sortKey,
        isHome: ev.isHome,
        playerIn,
        playerOut,
      })
      continue
    }

    if (ev.type === 'Card') {
      const playerName = ev.player?.name || ev.nameStr
      if (!playerName) continue
      const card = String(ev.card || ev.cardType || 'YELLOW').toUpperCase().includes('RED') ? 'RED' : 'YELLOW'
      const playerId = ev.player?.id ?? ev.playerId ?? null
      items.push({
        id: ev.reactKey || `card-${i}`,
        kind: 'card',
        minute,
        injuryTime,
        sortKey,
        isHome: ev.isHome,
        playerId,
        playerName,
        photoUrl: photoForPlayer(playerId, playerName, lookup),
        card,
      })
      continue
    }

    if (ev.type === 'Half') {
      const htHome = ev.homeScore ?? ev.newScore?.[0] ?? 0
      const htAway = ev.awayScore ?? ev.newScore?.[1] ?? 0
      items.push({
        id: `half-${i}`,
        kind: 'half',
        minute,
        injuryTime,
        sortKey: sortKey || eventSortKey(45, 0),
        isHome: null,
        label: `HT ${htHome} - ${htAway}`,
      })
      continue
    }

    if (ev.type === 'AddedTime') {
      const mins = ev.minutesAddedInput
        ?? (ev.minutesAddedStr ? Number(String(ev.minutesAddedStr).match(/\d+/)?.[0]) : null)
      items.push({
        id: `added-${i}`,
        kind: 'addedTime',
        minute,
        injuryTime,
        sortKey: sortKey || eventSortKey(minute ?? 45, injuryTime),
        isHome: null,
        label: mins != null ? `+${mins} min de descuento` : 'Tiempo añadido',
      })
    }
  }
  return items
}

function eventsFromStructured(match, homeName, awayName, lookup) {
  const items = []

  for (let i = 0; i < (match?.goals || []).length; i++) {
    const g = match.goals[i]
    const side = goalSide(g, homeName, awayName)
    const playerId = g.scorer?.id ?? null
    const playerName = g.scorer?.name
    items.push({
      id: `goal-${i}`,
      kind: 'goal',
      minute: g.minute,
      injuryTime: g.injuryTime,
      sortKey: eventSortKey(g.minute, g.injuryTime),
      isHome: side === 'home' ? true : side === 'away' ? false : null,
      playerId,
      playerName,
      photoUrl: photoForPlayer(playerId, playerName, lookup),
      score: g.score,
      subtext: goalSubtextFromGoal(g),
      goalType: g.type || 'REGULAR',
    })
  }

  for (let i = 0; i < (match?.bookings || []).length; i++) {
    const b = match.bookings[i]
    const side = teamSide(b.team?.name, homeName, awayName)
    const playerId = b.player?.id ?? null
    const playerName = b.player?.name
    items.push({
      id: `card-${i}`,
      kind: 'card',
      minute: b.minute,
      injuryTime: b.injuryTime,
      sortKey: eventSortKey(b.minute, b.injuryTime),
      isHome: side,
      playerId,
      playerName,
      photoUrl: photoForPlayer(playerId, playerName, lookup),
      card: b.card || 'YELLOW',
    })
  }

  for (let i = 0; i < (match?.substitutions || []).length; i++) {
    const s = match.substitutions[i]
    const side = teamSide(s.team?.name, homeName, awayName)
    const playerIn = resolveEventPlayer(s.playerIn, s.playerIn?.name, lookup)
    const playerOut = resolveEventPlayer(s.playerOut, s.playerOut?.name, lookup)
    items.push({
      id: `sub-${i}`,
      kind: 'sub',
      minute: s.minute,
      injuryTime: s.injuryTime,
      sortKey: eventSortKey(s.minute, s.injuryTime),
      isHome: side,
      playerIn,
      playerOut,
    })
  }

  const ht = match?.score?.halfTime
  if (ht?.home != null && ht?.away != null) {
    items.push({
      id: 'half-fallback',
      kind: 'half',
      minute: 45,
      injuryTime: null,
      sortKey: eventSortKey(45, 0),
      isHome: null,
      label: `HT ${ht.home} - ${ht.away}`,
    })
  }

  return items
}

/**
 * Cronología estilo FotMob para la pestaña Eventos (local arriba-izq, visitante arriba-dcha).
 */
export function buildMatchEventsTabItems(match, homeName, awayName) {
  const lookup = buildPlayerLookup(match?.homeTeam, match?.awayTeam)
  const rawEvents = match?.rawEvents
  const items = rawEvents?.length
    ? eventsFromRaw(rawEvents, homeName, awayName, lookup)
    : eventsFromStructured(match, homeName, awayName, lookup)

  items.sort((a, b) => a.sortKey - b.sortKey)
  return items
}

/** Texto estilo FotMob para un evento crudo de matchFacts. */
export function formatFotmobCommentaryLine(ev, homeName, awayName) {
  if (!ev) return null
  const player = ev.player?.name || ev.nameStr || ev.fullName
  const team = ev.isHome ? homeName : awayName
  const scoreStr = ev.newScore
    ? `${ev.newScore[0]}-${ev.newScore[1]}`
    : (ev.homeScore != null && ev.awayScore != null ? `${ev.homeScore}-${ev.awayScore}` : null)

  switch (ev.type) {
    case 'Goal': {
      if (ev.ownGoal) return `Autogol de ${player}${scoreStr ? ` (${scoreStr})` : ''}`
      const label = ev.isPenaltyShootoutEvent ? 'Gol de penalti' : 'Gol'
      const assist = ev.assistInput || ev.assistStr?.replace(/^assist by\s+/i, '')
      let line = `${label} de ${player}${scoreStr ? ` (${scoreStr})` : ''}`
      if (assist) line += `. Asistencia de ${assist}`
      return line
    }
    case 'Card': {
      const isRed = String(ev.card || ev.cardType || '').toUpperCase().includes('RED')
      const cardLabel = isRed ? 'Tarjeta roja' : 'Tarjeta amarilla'
      return `${cardLabel} para ${player}${team ? ` (${team})` : ''}`
    }
    case 'Substitution': {
      const playerIn = ev.playerIn?.name || ev.inName || ev.swap?.[1]?.name
      const playerOut = ev.playerOut?.name || ev.outName || ev.swap?.[0]?.name
      if (!playerIn && !playerOut) return null
      return `Cambio en ${team}: entra ${playerIn || '—'}, sale ${playerOut || '—'}`
    }
    case 'Half':
      return ev.halfStrShort === 'HT' ? 'Descanso' : 'Fin del periodo'
    case 'AddedTime': {
      if (ev.minutesAddedInput != null) return `+${ev.minutesAddedInput} min de descuento`
      return ev.minutesAddedStr
        ? ev.minutesAddedStr.replace(/\+?\s*(\d+)\s*minutes added/i, '+$1 min de descuento')
        : 'Tiempo añadido'
    }
    case 'VAR':
      return ev.title || ev.body || ev.text || 'Revisión del VAR'
    case 'Start':
    case 'KickOff':
      return '¡Comienza el partido!'
    default:
      return ev.title || ev.body || ev.text || ev.description || null
  }
}

const LTC_TITLE_ES = {
  red_card: '¡Tarjeta roja!',
  yellow_card: 'Tarjeta amarilla',
  second_yellow: 'Segunda amarilla',
  goal: '¡Gol!',
  own_goal: 'Autogol',
  player_substitution: 'Sustitución',
  substitution: 'Sustitución',
  highlight: 'Momento destacable',
  pause_match: 'Descanso',
  var: 'VAR',
  kick_off: '¡Comienza el partido!',
  half_time: 'Descanso',
  assist_singular: 'Asistencia',
}

export function fotmobPlayerPhotoUrl(playerId) {
  if (!playerId) return null
  return `https://images.fotmob.com/image_resources/playerimages/${playerId}.png`
}

export function fotmobTeamCrestUrl(teamId) {
  if (!teamId) return null
  return `https://images.fotmob.com/image_resources/logo/teamlogo/${teamId}_small.png`
}

export function buildPlayerLookup(homeTeam, awayTeam) {
  const map = new Map()
  for (const p of [
    ...(homeTeam?.lineup || []),
    ...(homeTeam?.bench || []),
    ...(awayTeam?.lineup || []),
    ...(awayTeam?.bench || []),
  ]) {
    if (p?.id != null) map.set(Number(p.id), p)
  }
  return map
}

function normalizePlayerName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function teamNamesMatch(a, b) {
  if (!a || !b) return false
  const na = normalizePlayerName(a)
  const nb = normalizePlayerName(b)
  return na === nb || na.includes(nb) || nb.includes(na)
}

function enrichSubPlayer(raw, lookup) {
  if (!raw) return null
  const fromLineup = raw.id != null ? lookup?.get(Number(raw.id)) : null
  const id = raw.id ?? fromLineup?.id
  const name = raw.name || fromLineup?.name
  if (!name && id == null) return null
  return {
    id,
    name,
    shirtNumber: raw.shirtNumber ?? fromLineup?.shirtNumber,
    photoUrl: raw.photoUrl || fotmobPlayerPhotoUrl(id),
  }
}

/** Parsea minuto de evento LTC ("67+2'") o número. */
export function parseEventMinuteLabel(label) {
  if (label == null) return { minute: null, injuryTime: null }
  if (typeof label === 'number') return { minute: label, injuryTime: null }
  const s = String(label).replace(/\u200e/g, '').trim()
  const m = /^(\d+)(?:\+(\d+))?/.exec(s)
  if (!m) return { minute: null, injuryTime: null }
  return { minute: Number(m[1]), injuryTime: m[2] ? Number(m[2]) : null }
}

/** Cambios unificados (eventos + feed LTC) con foto y dorsal cuando existan. */
export function getUnifiedSubstitutions(match, homeName, awayName) {
  const lookup = buildPlayerLookup(match?.homeTeam, match?.awayTeam)
  const list = []
  const seen = new Set()

  function add(sub, teamName) {
    const playerIn = enrichSubPlayer(sub.playerIn, lookup)
    const playerOut = enrichSubPlayer(sub.playerOut, lookup)
    if (!playerIn?.name && !playerOut?.name) return
    const key = `${teamName}|${playerIn?.id ?? normalizePlayerName(playerIn?.name)}|${sub.minute}`
    if (seen.has(key)) return
    seen.add(key)
    list.push({
      minute: sub.minute ?? null,
      injuryTime: sub.injuryTime ?? null,
      teamName,
      playerIn,
      playerOut,
    })
  }

  for (const item of match?.liveCommentary || []) {
    if (!item.isSubstitution || !item.substitution) continue
    const { minute, injuryTime } = parseEventMinuteLabel(item.minute)
    add(
      {
        minute,
        injuryTime,
        playerIn: item.substitution.playerIn,
        playerOut: item.substitution.playerOut,
      },
      item.isHome ? homeName : awayName,
    )
  }

  for (const s of match?.substitutions || []) {
    if (!s.team?.name) continue
    add(s, s.team.name)
  }

  return list.sort((a, b) => eventSortKey(a.minute, a.injuryTime) - eventSortKey(b.minute, b.injuryTime))
}

/** Suplentes con foto y datos del cambio si entraron al partido. */
export function buildTeamSentOffIndex(match, teamName) {
  const ids = new Set()
  const names = new Set()

  function mark(player) {
    if (!player) return
    if (player.id != null) ids.add(Number(player.id))
    if (player.name) names.add(normalizePlayerName(player.name))
  }

  function sideIsTeam(side) {
    if (!side) return false
    return [side.name, side.shortName].some(n => teamNamesMatch(n, teamName))
  }

  if (sideIsTeam(match?.homeTeam)) {
    for (const p of [...(match.homeTeam.lineup || []), ...(match.homeTeam.bench || [])]) {
      if (p.events?.includes('redCard')) mark(p)
    }
  }
  if (sideIsTeam(match?.awayTeam)) {
    for (const p of [...(match.awayTeam.lineup || []), ...(match.awayTeam.bench || [])]) {
      if (p.events?.includes('redCard')) mark(p)
    }
  }

  for (const b of match?.bookings || []) {
    const card = String(b.card || '').toUpperCase()
    if (!card.includes('RED')) continue
    if (!teamNamesMatch(b.team?.name, teamName)) continue
    mark(b.player)
  }

  for (const item of match?.liveCommentary || []) {
    if (item.variant !== 'red-card' && item.type !== 'RC') continue
    const onTeam = item.isHome ? sideIsTeam(match?.homeTeam) : sideIsTeam(match?.awayTeam)
    if (!onTeam) continue
    for (const p of item.players || []) mark(p)
    if (item.substitution) {
      mark(item.substitution.playerIn)
      mark(item.substitution.playerOut)
    }
  }

  return {
    has(player) {
      if (!player) return false
      if (player.events?.includes('redCard')) return true
      if (player.id != null && ids.has(Number(player.id))) return true
      if (player.name && names.has(normalizePlayerName(player.name))) return true
      return false
    },
  }
}

export function enrichPlayerMatchEvents(player, match = null, teamName = null) {
  if (!player) return player
  const events = new Set(player.events || [])

  for (const g of match?.goals || []) {
    if (teamName && !teamNamesMatch(g.team?.name, teamName)) continue
    const scored =
      (player.id != null && g.scorer?.id != null && Number(player.id) === Number(g.scorer.id))
      || (g.scorer?.name && playerNamesMatch(g.scorer.name, player.name))
    if (scored) events.add('goal')

    const assisted =
      (player.id != null && g.assist?.id != null && Number(player.id) === Number(g.assist.id))
      || (g.assist?.name && playerNamesMatch(g.assist.name, player.name))
    if (assisted) events.add('assist')
  }

  for (const b of match?.bookings || []) {
    if (teamName && !teamNamesMatch(b.team?.name, teamName)) continue
    const booked =
      (player.id != null && b.player?.id != null && Number(player.id) === Number(b.player.id))
      || (b.player?.name && playerNamesMatch(b.player.name, player.name))
    if (!booked) continue
    const card = String(b.card || '').toUpperCase()
    events.add(card.includes('RED') ? 'redCard' : 'yellowCard')
  }

  return { ...player, events: [...events] }
}

export function annotateBenchPlayers(bench = [], substitutions = [], teamName, match = null) {
  const subById = new Map()
  const subByName = new Map()
  const sentOff = match ? buildTeamSentOffIndex(match, teamName) : null

  for (const sub of substitutions) {
    if (!teamNamesMatch(sub.teamName, teamName)) continue
    const entry = {
      minute: sub.minute,
      injuryTime: sub.injuryTime,
      replaced: sub.playerOut,
    }
    if (sub.playerIn?.id != null) subById.set(Number(sub.playerIn.id), entry)
    if (sub.playerIn?.name) subByName.set(normalizePlayerName(sub.playerIn.name), entry)
  }

  return bench
    .map(p => {
      const subOn =
        (p.id != null && subById.get(Number(p.id))) ||
        (p.name && subByName.get(normalizePlayerName(p.name))) ||
        null
      const enriched = enrichPlayerMatchEvents(p, match, teamName)
      return {
        ...enriched,
        photoUrl: enriched.photoUrl || fotmobPlayerPhotoUrl(enriched.id),
        subOn,
        sentOff: sentOff?.has(enriched) ?? false,
      }
    })
    .sort((a, b) => {
      if (a.subOn && !b.subOn) return -1
      if (!a.subOn && b.subOn) return 1
      if (a.subOn && b.subOn) {
        return eventSortKey(a.subOn.minute, a.subOn.injuryTime)
          - eventSortKey(b.subOn.minute, b.subOn.injuryTime)
      }
      return (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99)
    })
}

function enrichLtcPlayer(raw, lookup) {
  if (!raw) return null
  const fromLineup = lookup?.get(Number(raw.id))
  return {
    id: raw.id,
    name: raw.name,
    teamId: raw.teamId,
    teamName: raw.teamName,
    shirtNumber: fromLineup?.shirtNumber,
    position: fromLineup?.position,
    photoUrl: fotmobPlayerPhotoUrl(raw.id),
    teamCrest: fotmobTeamCrestUrl(raw.teamId),
  }
}

function ltcEventVariant(type, isSubstitution, title) {
  if (isSubstitution || type === 'SI') return 'substitution'
  if (type === 'RC') return 'red-card'
  if (type === 'YC' || type === 'Y2C') return 'yellow-card'
  if (type === 'G') return 'goal'
  if (type === 'highlight') return 'highlight'
  if (type === 'half time' || type === 'half_time summary') return 'half-time'
  if (title) return 'key-event'
  return 'comment'
}

function ltcTranslation(block, lang = 'es') {
  if (!block?.translations) return null
  return block.translations[lang]
    || block.translations.es
    || Object.values(block.translations)[0]
    || null
}

function indexPulseReactions(pulseData) {
  const map = new Map()
  for (const row of pulseData?.reactions || []) {
    map.set(String(row.reactionToId), row.reactionCounts || [])
  }
  return map
}

function mapReactionCounts(counts = [], emojiById, limit = 6) {
  return counts
    .map(({ reactionId, count }) => ({
      emoji: emojiById.get(String(reactionId)) || null,
      count: count ?? 0,
    }))
    .filter(r => r.emoji && r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

function ltcEventTitle(ev) {
  const key = ev.title?.key
  if (key && LTC_TITLE_ES[key]) return LTC_TITLE_ES[key]
  if (ev.title?.value) return ev.title.value
  return null
}

function ltcEventMinute(ev) {
  if (ev.time?.main) {
    let main = ev.time.main.replace(/\u200e/g, '').trim()
    const addedRaw = ev.time.added || (ev.elapsedPlus > 0 ? `+${ev.elapsedPlus}` : null)
    if (addedRaw && !main.includes('+')) {
      const base = main.replace(/[''’]/g, '')
      const added = String(addedRaw).startsWith('+') ? addedRaw : `+${addedRaw}`
      return `${base}${added}'`
    }
    return main
  }
  if (ev.elapsed != null && ev.elapsed >= 0) {
    if (ev.elapsedPlus > 0) return `${ev.elapsed}+${ev.elapsedPlus}`
    return ev.elapsed
  }
  return null
}

function mapLtcEvent(ev, reactionsByTarget, emojiById, playerLookup) {
  const id = ev.messageId || String(ev.optaEventId)
  const text = ev.text?.trim()
  const title = ltcEventTitle(ev)
  if (!text && !title) return null

  const isSubstitution = ev.isSubstitution || ev.type === 'SI'
  const players = (ev.players || []).map(p => enrichLtcPlayer(p, playerLookup)).filter(Boolean)

  return {
    id,
    feedType: 'event',
    type: ev.type,
    variant: ltcEventVariant(ev.type, isSubstitution, title),
    minute: ltcEventMinute(ev),
    injuryTime: ev.elapsedPlus > 0 ? ev.elapsedPlus : null,
    title,
    text: text || title,
    isHome: ev.teamEvent === 'home',
    isSubstitution,
    substitution: isSubstitution && players.length >= 2
      ? { playerIn: players[0], playerOut: players[1] }
      : null,
    players,
    reactions: mapReactionCounts(reactionsByTarget.get(id), emojiById),
  }
}

function mapLtcPulse(pulse, lang, reactionsByTarget, emojiById) {
  const minute = pulse.elapsed >= 0 ? pulse.elapsed : null
  const id = String(pulse.id)

  if (pulse.type === 'poll') {
    const content = pulse.content || []
    const question = ltcTranslation(content.find(c => c.type === 'question'), lang)
    const pollCounts = reactionsByTarget.get(id) || []
    const options = content
      .filter(c => c.type === 'alternative')
      .map(alt => {
        const votes = pollCounts.find(r => r.reactionId === alt.id)?.count ?? 0
        return { id: alt.id, label: ltcTranslation(alt, lang), votes }
      })
    const totalVotes = options.reduce((sum, o) => sum + o.votes, 0)
    if (!question) return null
    return {
      id: `poll-${id}`,
      feedType: 'poll',
      type: 'poll',
      minute,
      question,
      options,
      totalVotes,
      pollOpen: pulse.activeUntil ? new Date(pulse.activeUntil) > new Date() : false,
    }
  }

  if (pulse.type === 'fan-take' || pulse.type === 'expert-take') {
    const textBlock = (pulse.content || []).find(c => c.type === 'text')
    const text = ltcTranslation(textBlock, lang)
    if (!text) return null
    const meta = textBlock?.metadata || {}
    return {
      id: `take-${id}`,
      feedType: pulse.type,
      type: pulse.type,
      minute,
      text,
      author: meta.author || null,
      source: meta.source || null,
      reactions: mapReactionCounts(reactionsByTarget.get(id), emojiById),
    }
  }

  if (pulse.type === 'image') return null

  return null
}

/** Feed enriquecido del liveticker (LTC): eventos + opiniones + encuestas. */
export function buildFotmobLtcFeed(ltc, pulseData, lang = 'es', options = {}) {
  if (!ltc?.events?.length) return []

  const playerLookup = options.playerLookup || null
  const reactionsByTarget = indexPulseReactions(pulseData)
  const emojiById = pulseData?.emojiById || new Map()

  const pulsesByPlacement = new Map()
  for (const pulse of ltc.pulseItems || []) {
    const key = pulse.placementId
    if (!key) continue
    if (!pulsesByPlacement.has(key)) pulsesByPlacement.set(key, [])
    pulsesByPlacement.get(key).push(pulse)
  }

  const feed = []
  const usedPulseIds = new Set()

  for (const ev of ltc.events) {
    const placementId = ev.messageId
    for (const pulse of pulsesByPlacement.get(placementId) || []) {
      const mapped = mapLtcPulse(pulse, lang, reactionsByTarget, emojiById)
      if (mapped) feed.push(mapped)
      usedPulseIds.add(pulse.id)
    }

    const mappedEvent = mapLtcEvent(ev, reactionsByTarget, emojiById, playerLookup)
    if (mappedEvent) feed.push(mappedEvent)
  }

  for (const pulse of ltc.pulseItems || []) {
    if (usedPulseIds.has(pulse.id)) continue
    const mapped = mapLtcPulse(pulse, lang, reactionsByTarget, emojiById)
    if (mapped) feed.push(mapped)
  }

  return feed
}

/** Feed minuto a minuto (orden FotMob: más reciente arriba). */
export function buildFotmobLiveCommentary(rawEvents = [], homeName, awayName) {
  const items = []
  for (let i = 0; i < rawEvents.length; i++) {
    const ev = rawEvents[i]
    const text = formatFotmobCommentaryLine(ev, homeName, awayName)
    if (!text) continue
    items.push({
      id: ev.reactKey || (ev.eventId != null ? String(ev.eventId) : `${ev.type}-${ev.time}-${i}`),
      type: ev.type,
      minute: ev.time ?? ev.timeStr,
      injuryTime: ev.overloadTime || null,
      isHome: ev.isHome,
      text,
      score: ev.newScore
        ? { home: ev.newScore[0], away: ev.newScore[1] }
        : (ev.homeScore != null ? { home: ev.homeScore, away: ev.awayScore } : null),
    })
  }
  return items
}

export function formatEventMinute(minute, injuryTime) {
  if (minute == null || minute === '') return '—'
  if (typeof minute === 'string') {
    const trimmed = minute.replace(/\u200e/g, '').trim()
    if (trimmed.includes("'") || trimmed.includes('’')) return trimmed
    const n = Number(trimmed.replace(/[^\d]/g, ''))
    if (Number.isFinite(n)) minute = n
    else return trimmed || '—'
  }
  if (injuryTime) return `${minute}+${injuryTime}'`
  return `${minute}'`
}

const GOAL_TYPE_LABELS = {
  REGULAR: 'Gol',
  PENALTY: 'Penalti',
  OWN: 'Autogol',
}

export function goalTypeLabel(type) {
  return GOAL_TYPE_LABELS[type] || 'Gol'
}

const STAT_LABELS = {
  ball_possession: 'Posesión %',
  shots: 'Tiros',
  shots_on_goal: 'A puerta',
  shots_off_goal: 'Fuera',
  corners: 'Córners',
  corner_kicks: 'Córners',
  fouls: 'Faltas',
  offsides: 'Fuera de juego',
  yellow_cards: 'Amarillas',
  red_cards: 'Rojas',
  saves: 'Paradas',
  free_kicks: 'Faltas a favor',
  goal_kicks: 'Saques de puerta',
  throw_ins: 'Saques de banda',
}

export function pickTeamStatistics(stats) {
  if (!stats || typeof stats !== 'object') return []
  return Object.entries(stats)
    .filter(([, v]) => v != null && v !== '')
    .map(([key, value]) => ({
      key,
      label: STAT_LABELS[key] || key.replace(/_/g, ' '),
      value,
    }))
    .slice(0, 8)
}

const STAT_COMPARISON_LABELS = {
  BallPossesion: 'Posesión %',
  expected_goals: 'xG',
  total_shots: 'Tiros',
  ShotsOnTarget: 'A puerta',
  touches_opp_box: 'Toques área rival',
  corners: 'Córners',
  fouls: 'Faltas',
  yellow_cards: 'Amarillas',
  red_cards: 'Rojas',
}

/** Filas home/away para barras comparativas (FotMob). */
export function pickStatsComparison(rows = []) {
  return rows
    .filter(r => r.home != null && r.away != null)
    .map(r => ({
      key: r.key,
      label: STAT_COMPARISON_LABELS[r.key] || r.label || r.key,
      home: r.home,
      away: r.away,
      type: r.type,
    }))
    .slice(0, 10)
}

export function formatMatchHeaderDate(utcDate) {
  if (!utcDate) return '—'
  const d = new Date(utcDate)
  const tz = { timeZone: 'Europe/Madrid' }
  const weekday = d.toLocaleString('es-ES', { weekday: 'short', ...tz }).replace(/\.$/, '')
  const day = d.toLocaleString('es-ES', { day: 'numeric', ...tz })
  const month = d.toLocaleString('es-ES', { month: 'long', ...tz })
  const time = d.toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', ...tz })
  return `${weekday}, ${day} de ${month}, ${time}`
}

export function formatLiveClock(liveTime, minute, status) {
  if (status === 'PAUSED') return { clock: 'Descanso', addedTime: null }
  if (!liveTime && minute == null) return null

  let clock = liveTime?.long || null
  if (!clock && liveTime?.short) {
    const m = parseInt(String(liveTime.short).replace(/\D/g, ''), 10)
    if (!Number.isNaN(m)) clock = `${String(m).padStart(2, '0')}:00`
  }
  if (!clock && minute != null) clock = `${String(minute).padStart(2, '0')}:00`

  const added = liveTime?.addedTime
  const addedTime = added > 0 ? `+0:${String(added).padStart(2, '0')}` : null
  return clock ? { clock, addedTime } : null
}

function goalSide(goal, homeName, awayName) {
  const tn = (goal.team?.name || '').toLowerCase()
  const h = (homeName || '').toLowerCase()
  const a = (awayName || '').toLowerCase()
  if (h && (tn === h || tn.includes(h) || h.includes(tn))) return 'home'
  if (a && (tn === a || tn.includes(a) || a.includes(tn))) return 'away'
  return null
}

function shortPlayerName(name) {
  if (!name) return 'Gol'
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1] : name
}

/** Goles por bando para la cabecera estilo FotMob. */
export function getHeaderGoalScorers(match, homeName, awayName) {
  const home = []
  const away = []
  for (const g of match?.goals || []) {
    const side = goalSide(g, homeName, awayName)
    const entry = {
      name: shortPlayerName(g.scorer?.name),
      minute: formatEventMinute(g.minute, g.injuryTime),
      assist: g.assist?.name ? shortPlayerName(g.assist.name) : null,
      type: g.type,
    }
    if (side === 'home') home.push(entry)
    else if (side === 'away') away.push(entry)
  }
  return { home, away }
}

export function formatMatchRoundLabel(match) {
  return match?.roundLabel || null
}
