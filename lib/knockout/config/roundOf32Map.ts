import type { BracketMatch } from '../types'

/**
 * Plantilla de dieciseisavos — ampliar con los 16 partidos oficiales.
 * Los códigos home/away siguen la nomenclatura FIFA (1A, 2C, 3A/B/C/D/F, …).
 */
export const roundOf32Map: BracketMatch[] = [
  {
    match: 74,
    home: '1E',
    away: '3A/B/C/D/F',
    venue: 'Boston Stadium',
  },
  {
    match: 75,
    home: '1F',
    away: '2C',
    venue: 'Estadio Monterrey',
  },
  {
    match: 76,
    home: '1C',
    away: '2F',
    venue: 'Houston Stadium',
  },
  {
    match: 77,
    home: '1I',
    away: '3C/D/F/G/H',
    venue: 'New York New Jersey Stadium',
  },
  {
    match: 78,
    home: '2E',
    away: '2I',
    venue: 'Dallas Stadium',
  },
  {
    match: 79,
    home: '1A',
    away: '3C/E/F/H/I',
    venue: 'Mexico City Stadium',
  },
]
