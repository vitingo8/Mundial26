import { transformGroupMatches, transformKnockoutMatches } from '../lib/footballData.js'

/** Opciones de puntuación alineadas con la UI (incluye clasificación FotMob). */
export function buildScoringOptsFromWc(wc) {
  return {
    groupMatches: transformGroupMatches(wc.matches),
    knockoutMatches: transformKnockoutMatches(wc.matches),
    fotmobStandings: wc.standings ?? null,
    apiMatches: wc.matches,
  }
}
