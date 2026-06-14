/**
 * Restablece scroll al cambiar de sección en el dashboard.
 * @param {HTMLElement | null | undefined} root — normalmente `<main class="dash-content">`
 */
export function resetDashboardScroll(root) {
  if (typeof window !== 'undefined') {
    window.scrollTo(0, 0)
  }
  root?.scrollTo?.(0, 0)
  const panel = root?.querySelector?.('.swipe-tabs-panel[aria-hidden="false"]')
  panel?.scrollTo?.(0, 0)
}
