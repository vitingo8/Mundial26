export const LOGO_DATA_URL_MAX_LEN = 70000
export const TEAM_LOGO_FILE_MAX_BYTES = 2 * 1024 * 1024
export const LEAGUE_LOGO_FILE_MAX_BYTES = 5 * 1024 * 1024

/** Valida data URL de imagen para logos (participante o liga) */
export function normalizeLogoDataUrl(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string' || !value.startsWith('data:image/')) {
    throw new Error('Logo no válido')
  }
  if (value.length > LOGO_DATA_URL_MAX_LEN) {
    throw new Error('Logo demasiado grande')
  }
  return value
}

/** Redimensiona imagen a data URL (JPEG) para guardar en team_logo / league_logo */
export function resizeLogoFile(
  file,
  { maxPx = 128, quality = 0.82, maxBytes = 48000, maxFileBytes = TEAM_LOGO_FILE_MAX_BYTES } = {},
) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('Selecciona una imagen (JPG, PNG o WebP)'))
      return
    }
    if (file.size > maxFileBytes) {
      const mb = maxFileBytes / (1024 * 1024)
      reject(new Error(`La imagen no puede superar ${mb} MB`))
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      // PNG/WebP transparentes: JPEG deja blanco por defecto → fondo negro
      const hasAlpha = file.type === 'image/png' || file.type === 'image/webp'
      if (hasAlpha) {
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, w, h)
      }
      ctx.drawImage(img, 0, 0, w, h)
      let q = quality
      let dataUrl = canvas.toDataURL('image/jpeg', q)
      while (dataUrl.length > maxBytes * 1.37 && q > 0.45) {
        q -= 0.08
        dataUrl = canvas.toDataURL('image/jpeg', q)
      }
      if (dataUrl.length > maxBytes * 1.37) {
        reject(new Error('Imagen demasiado grande; prueba otra más simple'))
        return
      }
      resolve(dataUrl)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen'))
    }
    img.src = url
  })
}

export const FULL_SCHEDULE_VIEW_KEY = 'porra_full_schedule_view'
export const SCHEDULE_VIEW_MODE_KEY = 'porra_schedule_view_mode'
export const SCHEDULE_VIEW_MODES = ['daily', 'full', 'groups', 'bracket']

/** @returns {'daily'|'full'|'groups'|'bracket'} */
export function readScheduleViewMode() {
  if (typeof localStorage === 'undefined') return 'daily'
  try {
    const stored = localStorage.getItem(SCHEDULE_VIEW_MODE_KEY)
    if (SCHEDULE_VIEW_MODES.includes(stored)) return stored
    if (localStorage.getItem(FULL_SCHEDULE_VIEW_KEY) === '1') return 'full'
    return 'daily'
  } catch {
    return 'daily'
  }
}

/** @param {'daily'|'full'|'groups'|'bracket'} mode */
export function writeScheduleViewMode(mode) {
  if (typeof localStorage === 'undefined') return
  if (!SCHEDULE_VIEW_MODES.includes(mode)) return
  try {
    localStorage.setItem(SCHEDULE_VIEW_MODE_KEY, mode)
    localStorage.setItem(FULL_SCHEDULE_VIEW_KEY, mode === 'full' ? '1' : '0')
  } catch { /* ignore */ }
}

/** @deprecated Usa readScheduleViewMode */
export function readFullScheduleView() {
  return readScheduleViewMode() === 'full'
}

/** @deprecated Usa writeScheduleViewMode */
export function writeFullScheduleView(on) {
  writeScheduleViewMode(on ? 'full' : 'daily')
}
