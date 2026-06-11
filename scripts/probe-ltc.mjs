const page = await fetch('https://www.fotmob.com/es/matches/south-africa-vs-mexico/1einvt', {
  headers: { 'User-Agent': 'Mozilla/5.0' },
})
const html = await page.text()
const chunkUrl = [...html.matchAll(/\/_next\/static\/chunks\/91051[^"']+\.js/g)][0]
if (!chunkUrl) throw new Error('chunk not found')
const js = await (await fetch(`https://www.fotmob.com${chunkUrl[0]}`, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text()

for (const term of ['ltcUrl', 'ltc', 'hasUrl', 'hasEvents', 'viewerOpinion', 'spectator', 'pulse']) {
  let idx = 0
  let count = 0
  while ((idx = js.indexOf(term, idx)) !== -1 && count < 8) {
    console.log(`\n--- ${term} ---`)
    console.log(js.slice(Math.max(0, idx - 100), idx + 350))
    idx += term.length
    count++
  }
}

// get matchDetails for ltcUrl if any
const md = await (await fetch('https://www.fotmob.com/api/data/matchDetails?matchId=4667751', { headers: { 'User-Agent': 'Mozilla/5.0' } })).json()
console.log('\nfull liveticker', JSON.stringify(md.content?.liveticker, null, 2))
console.log('\nongoing', md.ongoing)

// try /api/data/ltc with guessed urls
const teams = JSON.stringify(md.content?.liveticker?.teams || [])
const guesses = [
  `https://pub.fotmob.com/prod/db/api/pulse/match/4667751`,
  `https://pub.fotmob.com/prod/db/api/pulse/match/4667751/es`,
  `https://pub.fotmob.com/prod/db/api/pulse/4667751`,
]
for (const ltcUrl of guesses) {
  const params = new URLSearchParams({ ltcUrl, teams })
  const r = await fetch(`https://www.fotmob.com/api/data/ltc?${params}`, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  console.log('\nltc try', ltcUrl, r.status, (await r.text()).slice(0, 500))
}
