/** Redimensiona imagen a data URL (JPEG) para guardar en team_logo */
export function resizeLogoFile(file, { maxPx = 128, quality = 0.82, maxBytes = 48000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('Selecciona una imagen (JPG, PNG o WebP)'))
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      reject(new Error('La imagen no puede superar 2 MB'))
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

export function readFullScheduleView() {
  if (typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(FULL_SCHEDULE_VIEW_KEY) === '1'
  } catch {
    return false
  }
}

export function writeFullScheduleView(on) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(FULL_SCHEDULE_VIEW_KEY, on ? '1' : '0')
  } catch { /* ignore */ }
}
