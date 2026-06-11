const id = 4667751
const page = await fetch('https://www.fotmob.com/es/matches/south-africa-vs-mexico/1einvt', {
  headers: { 'User-Agent': 'Mozilla/5.0' },
})
const html = await page.text()

const patterns = [
  /liveticker[^"'`\s]{0,120}/gi,
  /generated[^"'`\s]{0,120}/gi,
  /data\.fotmob\.com[^"'`\s]+/gi,
  /pub\.fotmob\.com[^"'`\s]+/gi,
  /Leonardo|espectador|spectator|viewerOpinion/gi,
]

for (const p of patterns) {
  const m = [...html.matchAll(p)]
  if (m.length) {
    console.log('\nPattern', p, [...new Set(m.map(x => x[0]))].slice(0, 15))
  }
}

const next = html.match(/__NEXT_DATA__[^>]*>([\s\S]*?)<\/script>/)
if (next) {
  const data = JSON.parse(next[1])
  const buildId = data.buildId
  console.log('\nbuildId', buildId)
  // fetch a chunk that might mention liveticker
  const chunks = [...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map(m => m[0])
  console.log('chunks', chunks.length)
}

// try data.fotmob patterns
const tries = [
  `https://data.fotmob.com/liveticker/${id}_es.json`,
  `https://data.fotmob.com/liveticker/${id}/es.json`,
  `https://data.fotmob.com/liveticker/77/${id}/es.json`,
  `https://data.fotmob.com/liveticker/77/${id}_es.json`,
  `https://data.fotmob.com/generated-liveticker/77/${id}/liveticker_es.json`,
  `https://data.fotmob.com/generated-liveticker/77/${id}/es.json`,
  `https://data.fotmob.com/translations/es/liveticker/${id}.json`,
  `https://www.fotmob.com/api/data/liveticker?matchId=${id}&lang=es&country=ESP`,
  `https://www.fotmob.com/api/data/liveticker?matchId=${id}&language=es`,
  `https://www.fotmob.com/api/data/liveticker?matchId=${id}&locale=es-ES`,
]

for (const url of tries) {
  const r = await fetch(url.startsWith('http') ? url : `https://www.fotmob.com${url}`, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
  })
  const t = await r.text()
  if (r.ok && !t.startsWith('<!') && !t.startsWith('<?xml')) {
    console.log('\nHIT', r.status, url)
    console.log(t.slice(0, 2000))
  }
}
