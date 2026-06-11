const matchId = 4667751
const r = await fetch(`https://pub.fotmob.com/prod/pulse/api/match/${matchId}`, {
  headers: { 'User-Agent': 'Mozilla/5.0' },
})
console.log('status', r.status)
const d = await r.json()
console.log('keys', Object.keys(d))
console.log('sample', JSON.stringify(d, null, 2).slice(0, 4000))
