const page = await fetch('https://www.fotmob.com/es/matches/south-africa-vs-mexico/1einvt', {
  headers: { 'User-Agent': 'Mozilla/5.0' },
})
const html = await page.text()
const chunks = [...new Set(
  [...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map(m => `https://www.fotmob.com${m[0]}`),
)]

for (const url of chunks) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const js = await r.text()
  if (!/liveticker|LiveTicker|viewerOpinion|spectator|espectador/i.test(js)) continue
  console.log('\n===', url.split('/').pop())
  for (const term of ['liveticker', 'LiveTicker', 'viewerOpinion', 'spectator', '/api/']) {
    let idx = 0
    while ((idx = js.indexOf(term, idx)) !== -1) {
      console.log(js.slice(Math.max(0, idx - 60), idx + 200))
      idx += term.length
      if (idx > 500000) break
    }
  }
}
