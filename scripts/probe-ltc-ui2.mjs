const matchId = 4667751
const teams = JSON.stringify(['Mexico', 'South Africa'])
const ltcUrl = `http://data.fotmob.com/webcl/ltc/gsm/${matchId}_es.json.gz`
const params = new URLSearchParams({ ltcUrl, teams })
const d = await (await fetch(`https://www.fotmob.com/api/data/ltc?${params}`, {
  headers: { 'User-Agent': 'Mozilla/5.0' },
})).json()

console.log('types with title', d.events.filter(e => e.title).map(e => ({ type: e.type, key: e.title?.key, value: e.title?.value })))

const ht = d.events.find(e => e.type === 'half time')
console.log('\nhalf time', JSON.stringify(ht, null, 2)?.slice(0, 1200))

const hl = d.events.find(e => e.type === 'highlight')
console.log('\nhighlight', JSON.stringify(hl, null, 2)?.slice(0, 1200))

const g = d.events.find(e => e.type === 'G')
console.log('\ngoal', JSON.stringify(g, null, 2)?.slice(0, 2000))
