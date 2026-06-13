/**
 * Nombres de selecciones en español para la UI.
 * La API (football-data.org) y el catálogo FIFA usan inglés; aquí se traduce solo al mostrar.
 */

function stripAccents(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function teamNameKey(name) {
  if (!name) return ''
  return stripAccents(String(name).trim().toLowerCase()).replace(/\s+/g, ' ')
}

/** Clave canónica (inglés, sin acentos) → etiqueta en español */
const EN_TO_ES = {
  mexico: 'México',
  'south africa': 'Sudáfrica',
  'korea republic': 'Corea del Sur',
  czechia: 'República Checa',
  canada: 'Canadá',
  'bosnia and herzegovina': 'Bosnia y Herzegovina',
  'united states': 'Estados Unidos',
  paraguay: 'Paraguay',
  haiti: 'Haití',
  scotland: 'Escocia',
  australia: 'Australia',
  turkiye: 'Turquía',
  brazil: 'Brasil',
  morocco: 'Marruecos',
  qatar: 'Catar',
  switzerland: 'Suiza',
  'ivory coast': 'Costa de Marfil',
  ecuador: 'Ecuador',
  germany: 'Alemania',
  curacao: 'Curazao',
  netherlands: 'Países Bajos',
  japan: 'Japón',
  sweden: 'Suecia',
  tunisia: 'Túnez',
  'saudi arabia': 'Arabia Saudí',
  uruguay: 'Uruguay',
  spain: 'España',
  'cape verde': 'Cabo Verde',
  iran: 'Irán',
  'new zealand': 'Nueva Zelanda',
  belgium: 'Bélgica',
  egypt: 'Egipto',
  france: 'Francia',
  senegal: 'Senegal',
  iraq: 'Irak',
  norway: 'Noruega',
  argentina: 'Argentina',
  algeria: 'Argelia',
  austria: 'Austria',
  jordan: 'Jordania',
  ghana: 'Ghana',
  panama: 'Panamá',
  england: 'Inglaterra',
  croatia: 'Croacia',
  portugal: 'Portugal',
  'congo dr': 'República Democrática del Congo',
  uzbekistan: 'Uzbekistán',
  colombia: 'Colombia',
  wales: 'Gales',
  ukraine: 'Ucrania',
  poland: 'Polonia',
  serbia: 'Serbia',
  denmark: 'Dinamarca',
  'costa rica': 'Costa Rica',
  chile: 'Chile',
  peru: 'Perú',
  venezuela: 'Venezuela',
  bolivia: 'Bolivia',
  cameroon: 'Camerún',
  nigeria: 'Nigeria',
  'north macedonia': 'Macedonia del Norte',
  slovenia: 'Eslovenia',
  slovakia: 'Eslovaquia',
  hungary: 'Hungría',
  romania: 'Rumanía',
  greece: 'Grecia',
  finland: 'Finlandia',
  ireland: 'Irlanda',
  'northern ireland': 'Irlanda del Norte',
  iceland: 'Islandia',
  jamaica: 'Jamaica',
  honduras: 'Honduras',
  'el salvador': 'El Salvador',
  guatemala: 'Guatemala',
  nicaragua: 'Nicaragua',
  cuba: 'Cuba',
  china: 'China',
  india: 'India',
  thailand: 'Tailandia',
  vietnam: 'Vietnam',
  indonesia: 'Indonesia',
  malaysia: 'Malasia',
  singapore: 'Singapur',
  philippines: 'Filipinas',
  'saudi arabian': 'Arabia Saudí',
}

/** Alias español (clave sin acentos) → clave canónica inglesa */
const ES_TO_EN = Object.fromEntries(
  Object.entries(EN_TO_ES)
    .sort(([a], [b]) => {
      if (a === 'turkiye' || a === 'cape verde') return -1
      if (b === 'turkiye' || b === 'cape verde') return 1
      return 0
    })
    .map(([en, es]) => [teamNameKey(es), en]),
)

/** Alias inglés adicionales → canónico (antes de lookup ES) */
const EN_ALIASES = {
  usa: 'united states',
  us: 'united states',
  'south korea': 'korea republic',
  korea: 'korea republic',
  'cote divoire': 'ivory coast',
  "cote d'ivoire": 'ivory coast',
  'dr congo': 'congo dr',
  'democratic republic of the congo': 'congo dr',
  'congo democratic republic': 'congo dr',
  'czech republic': 'czechia',
  'iran, islamic republic of': 'iran',
  'cabo verde': 'cape verde',
  'ir iran': 'iran',
  turquia: 'turkiye',
  turkey: 'turkiye',
  'arabia saudi': 'saudi arabia',
  'saudi arabian': 'saudi arabia',
  'bosnia-h': 'bosnia and herzegovina',
  'bosnia-h.': 'bosnia and herzegovina',
}

/**
 * Clave canónica en inglés (sin acentos, minúsculas) para emparejar API/catálogo.
 */
export function toCanonicalTeamName(name) {
  const key = teamNameKey(name)
  if (!key) return ''
  if (EN_ALIASES[key]) return EN_ALIASES[key]
  if (EN_TO_ES[key]) return key
  if (ES_TO_EN[key]) return ES_TO_EN[key]
  return key
}

/**
 * Etiqueta en español para mostrar en la interfaz.
 * Deja intactos placeholders (Europa A, etc.) y nombres desconocidos.
 */
export function displayTeamName(name) {
  if (name == null || name === '') return ''
  const raw = String(name).trim()
  const canonical = toCanonicalTeamName(raw)
  if (EN_TO_ES[canonical]) return EN_TO_ES[canonical]
  return raw
}

/** Etiqueta compacta para cabeceras de estadísticas del partido. */
export function formatStatsTeamName(name) {
  if (toCanonicalTeamName(name) === 'bosnia and herzegovina') return 'Bosnia-Herz.'
  return displayTeamName(name)
}

/** Primera palabra del país (sin abreviar). */
export function floatingTeamLabel(name) {
  const label = displayTeamName(name)
  if (!label) return '?'
  return label.split(/\s+/)[0]
}
