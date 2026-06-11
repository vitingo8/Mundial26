const matchId = 4667751
const teams = JSON.stringify(['Mexico', 'South Africa'])
const ltcUrl = `http://data.fotmob.com/webcl/ltc/gsm/${matchId}_es.json.gz`
const params = new URLSearchParams({ ltcUrl, teams })
const d = await (await fetch(`https://www.fotmob.com/api/data/ltc?${params}`, {
  headers: { 'User-Agent': 'Mozilla/5.0' },
})).json()

const sub = d.events.find(e => e.isSubstitution || e.type?.includes('sub') || /sustituci/i.test(e.text || ''))
console.log('sub event', JSON.stringify(sub, null, 2)?.slice(0, 3000))

const rc = d.events.find(e => e.type === 'RC')
console.log('\nRC players', JSON.stringify(rc?.players, null, 2))

const highlight = d.events.find(e => e.type === 'highlight' || e.title)
console.log('\nhighlight', JSON.stringify(d.events.filter(e => e.title).slice(0, 3), null, 2)?.slice(0, 2000))

const half = d.events.find(e => /half/i.test(e.type))
console.log('\nhalf', JSON.stringify(half, null, 2)?.slice(0, 1500))

const expert = d.pulseItems.find(p => p.type === 'expert-take')
console.log('\nexpert', JSON.stringify(expert, null, 2)?.slice(0, 1500))
