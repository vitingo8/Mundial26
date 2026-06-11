const matchId = 4667751
const teams = JSON.stringify(['Mexico', 'South Africa'])
const ltcUrl = `http://data.fotmob.com/webcl/ltc/gsm/${matchId}_es.json.gz`
const params = new URLSearchParams({ ltcUrl, teams })
const d = await (await fetch(`https://www.fotmob.com/api/data/ltc?${params}`, {
  headers: { 'User-Agent': 'Mozilla/5.0' },
})).json()

const polls = d.pulseItems.filter(p => p.type === 'poll')
console.log('polls count', polls.length)
console.log(JSON.stringify(polls[0], null, 2))

const fanTakes = d.pulseItems.filter(p => p.type === 'fan-take')
console.log('\nfan-takes', fanTakes.length)

// Check if events have reactions
const withReactions = d.events.filter(e => e.reactions || e.reactionCounts)
console.log('\nevents with reactions field', withReactions.length)
if (withReactions[0]) console.log(JSON.stringify(withReactions[0], null, 2).slice(0, 1500))

// pulseUrls might have reaction data
console.log('\npulseUrls keys', d.pulseUrls ? Object.keys(d.pulseUrls) : null)
if (d.pulseUrls) console.log(JSON.stringify(d.pulseUrls, null, 2).slice(0, 2000))

// Merge logic: placementId links pulse to events
console.log('\nplacementIds in pulse', d.pulseItems.map(p => ({ type: p.type, placementId: p.placementId, elapsed: p.elapsed })))
