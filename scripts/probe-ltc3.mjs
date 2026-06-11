const matchId = 4667751
const teams = JSON.stringify(['Mexico', 'South Africa'])
const ltcUrl = `http://data.fotmob.com/webcl/ltc/gsm/${matchId}_es.json.gz`
const params = new URLSearchParams({ ltcUrl, teams })
const d = await (await fetch(`https://www.fotmob.com/api/data/ltc?${params}`, {
  headers: { 'User-Agent': 'Mozilla/5.0' },
})).json()

console.log('event types', [...new Set(d.events.map(e => e.type))])
console.log('pulse types', [...new Set(d.pulseItems.map(p => p.type))])

const rcEvent = d.events.find(e => /roja|TARJETA ROJA/i.test(e.text || ''))
console.log('\nRC event', JSON.stringify(rcEvent, null, 2)?.slice(0, 2500))

const rcPulse = d.pulseItems.find(p => p.type === 'RC' || p.placementId?.includes('RC'))
console.log('\nRC pulse', JSON.stringify(rcPulse, null, 2)?.slice(0, 3500))

const poll = d.pulseItems.find(p => p.content?.some?.(c => c.type === 'poll' || c.metadata?.question))
console.log('\npoll item', JSON.stringify(poll, null, 2)?.slice(0, 3500))

const withPlayers = d.events.find(e => e.players?.length)
console.log('\nwith players', JSON.stringify(withPlayers, null, 2)?.slice(0, 2000))
