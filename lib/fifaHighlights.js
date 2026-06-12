import { toCanonicalTeamName } from './teamNamesEs.js'

export const FIFA_WC26_BASE = 'https://www.fifa.com'
export const FIFA_WC26_ARTICLE_PATH =
  '/en/tournaments/mens/worldcup/canadamexicousa2026/articles'
export const FIFA_CXM_PAGES_API =
  'https://cxm-api.fifa.com/fifaplusweb/api/pages'

/** Slug FIFA para URLs de resumen: korea-republic, south-africa, etc. */
export function fifaTeamSlug(teamName) {
  const canonical = toCanonicalTeamName(teamName)
  if (!canonical) return ''
  return canonical
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Ej.: mexico-south-africa-highlights-match-report (local primero). */
export function buildFifaHighlightsArticleSlug(homeTeam, awayTeam) {
  const home = fifaTeamSlug(homeTeam)
  const away = fifaTeamSlug(awayTeam)
  if (!home || !away) return null
  if (home.includes('europa') || away.includes('europa')) return null
  return `${home}-${away}-highlights-match-report`
}

export function buildFifaHighlightsPagePath(homeTeam, awayTeam) {
  const slug = buildFifaHighlightsArticleSlug(homeTeam, awayTeam)
  if (!slug) return null
  return `${FIFA_WC26_ARTICLE_PATH}/${slug}`
}

export function resolveTeamNamesFromApiRaw(apiRaw) {
  if (!apiRaw) return { home: '', away: '' }
  return {
    home: apiRaw.homeTeam?.name || apiRaw.homeTeam?.shortName || '',
    away: apiRaw.awayTeam?.name || apiRaw.awayTeam?.shortName || '',
  }
}

export function openFifaHighlightsWindow(url) {
  if (!url || typeof window === 'undefined') return null
  const width = Math.min(1120, window.screen?.availWidth ? window.screen.availWidth - 48 : 1120)
  const height = Math.round(width * 9 / 16) + 80
  const left = Math.max(0, Math.round((window.screen?.availWidth || width - width) / 2))
  const top = Math.max(0, Math.round((window.screen?.availHeight || height - height) / 2))
  const features = [
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    'noopener,noreferrer',
    'scrollbars=yes,resizable=yes',
  ].join(',')
  return window.open(url, 'fifa-wc26-highlights', features)
}
