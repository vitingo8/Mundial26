// Fallback si la API no carga (datos locales mínimos)
export const GROUPS_DATA_FALLBACK = {}

export const GROUPS_DATA = GROUPS_DATA_FALLBACK
export const ALL_TEAMS = []

export const KNOCKOUT_ROUNDS = [
  { id: "r32", label: "Ronda de 32", emoji: "⚔️", matches: 16 },
  { id: "r16", label: "Octavos de Final", emoji: "🔥", matches: 8 },
  { id: "qf", label: "Cuartos de Final", emoji: "💥", matches: 4 },
  { id: "sf", label: "Semifinales", emoji: "🌟", matches: 2 },
  { id: "3rd", label: "3er y 4to Puesto", emoji: "🥉", matches: 1 },
  { id: "final", label: "Final", emoji: "🏆", matches: 1 },
]

export const SCORING = {
  correctOutcome: 3,
  exactScore: 2,
  topScorer: 5,
  topKeeper: 5,
  topAssists: 5,
  mvp: 10,
}

export function generateGroupMatches(groupsData = GROUPS_DATA) {
  const matches = []
  Object.entries(groupsData).forEach(([grp, teams]) => {
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matches.push({
          id: `${grp}-${i}-${j}`,
          group: grp,
          home: teams[i],
          away: teams[j],
        })
      }
    }
  })
  return matches
}

export function getOutcome(h, a) {
  if (h > a) return "H"
  if (h < a) return "A"
  return "D"
}

export function calcMatchPoints(prediction, result) {
  if (!prediction || result?.home == null || result?.away == null) return 0
  let pts = 0
  if (getOutcome(prediction.home, prediction.away) === getOutcome(result.home, result.away))
    pts += SCORING.correctOutcome
  if (prediction.home === result.home && prediction.away === result.away)
    pts += SCORING.exactScore
  return pts
}

export function calcBonusPoints(predictions, actuals) {
  let pts = 0
  const fields = ["topScorer", "topKeeper", "topAssists", "mvp"]
  fields.forEach(f => {
    if (predictions?.[f] && actuals?.[f] &&
      predictions[f].trim().toLowerCase() === actuals[f].trim().toLowerCase()) {
      pts += SCORING[f] || 0
    }
  })
  return pts
}

export function calcLeaderboard(group) {
  if (!group?.participants) return []
  return Object.values(group.participants).map(p => {
    let groupPts = 0, knockoutPts = 0, bonusPts = 0
    const preds = p.predictions || {}

    Object.entries(preds.group || {}).forEach(([id, pred]) => {
      const res = group.results?.group?.[id]
      if (res) groupPts += calcMatchPoints(pred, res)
    })
    Object.entries(preds.knockout || {}).forEach(([id, pred]) => {
      const res = group.results?.knockout?.[id]
      if (res) knockoutPts += calcMatchPoints(pred, res)
    })
    bonusPts = calcBonusPoints(preds.bonuses, group.actuals)

    const total = Math.round((groupPts * 0.6 + knockoutPts * 0.4 + bonusPts) * 10) / 10
    return { ...p, groupPts, knockoutPts, bonusPts, total }
  }).sort((a, b) => b.total - a.total)
}

export function uid() {
  return Math.random().toString(36).slice(2, 9)
}

export function isDeadlinePassed(deadline) {
  if (!deadline) return false
  return new Date() > new Date(deadline)
}
