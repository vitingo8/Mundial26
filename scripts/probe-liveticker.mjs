const id = 4667751
const paths = [
  `/api/data/liveticker?matchId=${id}&lang=es`,
  `/api/data/liveticker?matchId=${id}`,
  `/api/liveticker?matchId=${id}&lang=es`,
  `/api/data/matchLiveticker?matchId=${id}&lang=es`,
  `/api/data/match-liveticker?matchId=${id}&lang=es`,
  `/api/data/liveticker/${id}?lang=es`,
  `/api/data/matchDetails?matchId=${id}&tab=liveticker&lang=es`,
  `/api/data/matchDetails?matchId=${id}&tab=liveticker`,
  `/api/data/matchTicker?matchId=${id}&lang=es`,
  `/api/data/ticker?matchId=${id}&lang=es`,
]

for (const path of paths) {
  const url = `https://www.fotmob.com${path}`
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } })
  const ct = r.headers.get('content-type') || ''
  const t = await r.text()
  const ok = r.ok && ct.includes('json')
  console.log(r.status, ok ? t.slice(0, 300) : ct.slice(0, 40), path)
}

const page = await fetch('https://www.fotmob.com/es/matches/south-africa-vs-mexico/1einvt', {
  headers: { 'User-Agent': 'Mozilla/5.0' },
})
const html = await page.text()
const chunks = []
for (const m of html.matchAll(/\/api\/data\/[a-zA-Z0-9?&=_\-.]+/g)) chunks.push(m[0])
console.log('\nAPI refs in HTML:', [...new Set(chunks)].filter(u => /live|tick|comment|fact/i.test(u)))

const next = html.match(/__NEXT_DATA__[^>]*>([\s\S]*?)<\/script>/)
if (next) {
  const data = JSON.parse(next[1])
  const buildId = data.buildId
  console.log('\nbuildId', buildId)
  // try common next.js data routes
  const extra = [
    `/api/data/liveticker?matchId=${id}&lang=es&country=ESP`,
    `https://data.fotmob.com/prod/news/api/liveticker?matchId=${id}&lang=es`,
    `https://data.fotmob.com/liveticker/${id}.json`,
  ]
  for (const url of extra) {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    console.log(r.status, url, (await r.text()).slice(0, 150))
  }
}
