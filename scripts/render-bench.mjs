/**
 * Bundlea y ejecuta el benchmark de render (scripts/render-bench-entry.jsx) en jsdom.
 * Uso: node scripts/render-bench.mjs [viewMode]   (daily | full | bracket)
 * Con perfil: node --cpu-prof --cpu-prof-dir=.bench scripts/render-bench.mjs bracket
 */
import { buildSync } from 'esbuild'
import { JSDOM } from 'jsdom'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const viewMode = process.argv[2] || 'daily'
process.env.BENCH_VIEW_MODE = viewMode

const outfile = path.resolve('.bench/render-bench.bundle.mjs')
buildSync({
  entryPoints: ['scripts/render-bench-entry.jsx'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  jsx: 'automatic',
  loader: { '.js': 'jsx' },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  external: ['jsdom'],
  logLevel: 'warning',
})

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://localhost/',
  pretendToBeVisual: true,
})

const { window } = dom
globalThis.window = window
globalThis.self = window
globalThis.document = window.document
try {
  Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true })
} catch { /* Node >=21 expone navigator propio */ }
globalThis.localStorage = window.localStorage
globalThis.sessionStorage = window.sessionStorage
globalThis.HTMLElement = window.HTMLElement
globalThis.Element = window.Element
globalThis.Node = window.Node
globalThis.getComputedStyle = window.getComputedStyle.bind(window)
globalThis.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 0)
globalThis.cancelAnimationFrame = id => clearTimeout(id)
globalThis.requestIdleCallback = cb => setTimeout(() => cb({ timeRemaining: () => 50, didTimeout: false }), 0)
globalThis.cancelIdleCallback = id => clearTimeout(id)
globalThis.matchMedia = window.matchMedia || (q => ({
  matches: false, media: q,
  addEventListener() {}, removeEventListener() {},
  addListener() {}, removeListener() {},
}))
window.matchMedia = globalThis.matchMedia
if (!window.ResizeObserver) {
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
}
globalThis.ResizeObserver = window.ResizeObserver
if (!window.PerformanceObserver) {
  window.PerformanceObserver = class { observe() {} disconnect() {} }
  window.PerformanceObserver.supportedEntryTypes = []
}
globalThis.PerformanceObserver = window.PerformanceObserver
window.Element.prototype.scrollTo = function () {}
window.Element.prototype.scrollIntoView = function () {}
window.scrollTo = () => {}

await import(pathToFileURL(outfile).href)
