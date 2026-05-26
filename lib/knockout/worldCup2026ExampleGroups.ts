import type { GroupsInput } from './types'

/** Datos de ejemplo (predicciones / simulación) — no resultados oficiales. */
export const worldCup2026ExampleGroups: GroupsInput = {
  A: [
    { group: 'A', position: 1, team: 'Korea Republic', code: 'KOR', pts: 9, pj: 3, w: 3, d: 0, l: 0, gd: 6 },
    { group: 'A', position: 2, team: 'Czech Republic', code: 'CZE', pts: 3, pj: 3, w: 1, d: 0, l: 2, gd: -3 },
    { group: 'A', position: 3, team: 'Mexico', code: 'MEX', pts: 3, pj: 3, w: 1, d: 0, l: 2, gd: -2, gf: 8 },
    { group: 'A', position: 4, team: 'South Africa', code: 'ZAF', pts: 3, pj: 3, w: 1, d: 0, l: 2, gd: -1 },
  ],
  B: [
    { group: 'B', position: 1, team: 'Canada', code: 'CAN', pts: 6, pj: 3, w: 2, d: 0, l: 1, gd: 4 },
    { group: 'B', position: 2, team: 'Bosnia and Herzegovina', code: 'BIH', pts: 6, pj: 3, w: 2, d: 0, l: 1, gd: 45 },
    { group: 'B', position: 3, team: 'Qatar', code: 'QAT', pts: 4, pj: 3, w: 1, d: 1, l: 1, gd: 0, gf: 10 },
    { group: 'B', position: 4, team: 'Switzerland', code: 'SUI', pts: 1, pj: 3, w: 0, d: 1, l: 2, gd: -49 },
  ],
  C: [
    { group: 'C', position: 1, team: 'Scotland', code: 'SCO', pts: 6, pj: 3, w: 2, d: 0, l: 1, gd: 5 },
    { group: 'C', position: 2, team: 'Morocco', code: 'MAR', pts: 4, pj: 3, w: 1, d: 1, l: 1, gd: -2 },
    { group: 'C', position: 3, team: 'Brazil', code: 'BRA', pts: 4, pj: 3, w: 1, d: 1, l: 1, gd: -4, gf: 15 },
    { group: 'C', position: 4, team: 'Haiti', code: 'HTI', pts: 3, pj: 3, w: 1, d: 0, l: 2, gd: 1 },
  ],
  D: [
    { group: 'D', position: 1, team: 'United States', code: 'USA', pts: 9, pj: 3, w: 3, d: 0, l: 0, gd: 140 },
    { group: 'D', position: 2, team: 'Türkiye', code: 'TUR', pts: 6, pj: 3, w: 2, d: 0, l: 1, gd: -47 },
    { group: 'D', position: 3, team: 'Paraguay', code: 'PRY', pts: 3, pj: 3, w: 1, d: 0, l: 2, gd: -34, gf: 59 },
    { group: 'D', position: 4, team: 'Australia', code: 'AUS', pts: 0, pj: 3, w: 0, d: 0, l: 3, gd: -59 },
  ],
  E: [
    { group: 'E', position: 1, team: 'Germany', code: 'GER', pts: 6, pj: 3, w: 2, d: 0, l: 1, gd: 2 },
    { group: 'E', position: 2, team: 'Curacao', code: 'CUW', pts: 6, pj: 3, w: 2, d: 0, l: 1, gd: 2 },
    { group: 'E', position: 3, team: 'Ecuador', code: 'ECU', pts: 3, pj: 3, w: 1, d: 0, l: 2, gd: -2, gf: 7 },
    { group: 'E', position: 4, team: "Côte d'Ivoire", code: 'CIV', pts: 3, pj: 3, w: 1, d: 0, l: 2, gd: -2 },
  ],
  F: [
    { group: 'F', position: 1, team: 'Sweden', code: 'SWE', pts: 6, pj: 3, w: 2, d: 0, l: 1, gd: 2 },
    { group: 'F', position: 2, team: 'Netherlands', code: 'NED', pts: 6, pj: 3, w: 2, d: 0, l: 1, gd: 48 },
    { group: 'F', position: 3, team: 'Tunisia', code: 'TUN', pts: 3, pj: 3, w: 1, d: 0, l: 2, gd: -1, gf: 4 },
    { group: 'F', position: 4, team: 'Japan', code: 'JPN', pts: 3, pj: 3, w: 1, d: 0, l: 2, gd: -49 },
  ],
  G: [
    { group: 'G', position: 1, team: 'Iran', code: 'IRN', pts: 6, pj: 3, w: 2, d: 0, l: 1, gd: 33 },
    { group: 'G', position: 2, team: 'New Zealand', code: 'NZL', pts: 6, pj: 3, w: 2, d: 0, l: 1, gd: 2 },
    { group: 'G', position: 3, team: 'Egypt', code: 'EGY', pts: 3, pj: 3, w: 1, d: 0, l: 2, gd: -33, gf: 15 },
    { group: 'G', position: 4, team: 'Belgium', code: 'BEL', pts: 3, pj: 3, w: 1, d: 0, l: 2, gd: -2 },
  ],
  H: [
    { group: 'H', position: 1, team: 'Saudi Arabia', code: 'KSA', pts: 6, pj: 3, w: 2, d: 0, l: 1, gd: 2 },
    { group: 'H', position: 2, team: 'Spain', code: 'ESP', pts: 4, pj: 3, w: 1, d: 1, l: 1, gd: -1 },
    { group: 'H', position: 3, team: 'Uruguay', code: 'URU', pts: 4, pj: 3, w: 1, d: 1, l: 1, gd: 0, gf: 7 },
    { group: 'H', position: 4, team: 'Cape Verde Islands', code: 'CPV', pts: 2, pj: 3, w: 0, d: 2, l: 1, gd: -1 },
  ],
  I: [
    { group: 'I', position: 1, team: 'Norway', code: 'NOR', pts: 9, pj: 3, w: 3, d: 0, l: 0, gd: 7 },
    { group: 'I', position: 2, team: 'Iraq', code: 'IRQ', pts: 6, pj: 3, w: 2, d: 0, l: 1, gd: 2 },
    { group: 'I', position: 3, team: 'Senegal', code: 'SEN', pts: 3, pj: 3, w: 1, d: 0, l: 2, gd: -4, gf: 5 },
    { group: 'I', position: 4, team: 'France', code: 'FRA', pts: 0, pj: 3, w: 0, d: 0, l: 3, gd: -5 },
  ],
  J: [
    { group: 'J', position: 1, team: 'Argentina', code: 'ARG', pts: 9, pj: 3, w: 3, d: 0, l: 0, gd: 21 },
    { group: 'J', position: 2, team: 'Jordan', code: 'JOR', pts: 6, pj: 3, w: 2, d: 0, l: 1, gd: 6 },
    { group: 'J', position: 3, team: 'Austria', code: 'AUT', pts: 1, pj: 3, w: 0, d: 1, l: 2, gd: -3, gf: 1 },
    { group: 'J', position: 4, team: 'Algeria', code: 'DZA', pts: 1, pj: 3, w: 0, d: 1, l: 2, gd: -24 },
  ],
  K: [
    { group: 'K', position: 1, team: 'Colombia', code: 'COL', pts: 7, pj: 3, w: 2, d: 1, l: 0, gd: 3 },
    { group: 'K', position: 2, team: 'Portugal', code: 'POR', pts: 6, pj: 3, w: 2, d: 0, l: 1, gd: 1 },
    { group: 'K', position: 3, team: 'Congo DR', code: 'COD', pts: 3, pj: 3, w: 1, d: 0, l: 2, gd: 0, gf: 4 },
    { group: 'K', position: 4, team: 'Uzbekistan', code: 'UZB', pts: 1, pj: 3, w: 0, d: 1, l: 2, gd: -4 },
  ],
  L: [
    { group: 'L', position: 1, team: 'England', code: 'ENG', pts: 9, pj: 3, w: 3, d: 0, l: 0, gd: 3 },
    { group: 'L', position: 2, team: 'Panama', code: 'PAN', pts: 3, pj: 3, w: 1, d: 0, l: 2, gd: -1 },
    { group: 'L', position: 3, team: 'Ghana', code: 'GHA', pts: 3, pj: 3, w: 1, d: 0, l: 2, gd: 0, gf: 5 },
    { group: 'L', position: 4, team: 'Croatia', code: 'CRO', pts: 3, pj: 3, w: 1, d: 0, l: 2, gd: -2 },
  ],
}
