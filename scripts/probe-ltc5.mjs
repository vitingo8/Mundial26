const matchId = 4667751
const teams = JSON.stringify(['Mexico', 'South Africa'])
const ltcUrl = `http://data.fotmob.com/webcl/ltc/gsm/${matchId}_es.json.gz`
const params = new URLSearchParams({ ltcUrl, teams })
const d = await (await fetch(`https://www.fotmob.com/api/data/ltc?${params}`, {
  headers: { 'User-Agent': 'Mozilla/5.0' },
})).json()

console.log('first event elapsed', d.events[0]?.elapsed, d.events[0]?.time?.main)
console.log('last event elapsed', d.events.at(-1)?.elapsed)

// Group pulse by placementId
const byPlacement = {}
for (const p of d.pulseItems) {
  if (!byPlacement[p.placementId]) byPlacement[p.placementId] = []
  byPlacement[p.placementId].push(p)
}

const rcMsgId = 'es:card:RC:218418'
console.log('\npulse for RC', byPlacement[rcMsgId]?.map(p => p.type))

// Check poll vote counts
const pollPulse = d.pulseItems.find(p => p.type === 'poll' && p.placementId === rcMsgId)
console.log('\npoll full', JSON.stringify(pollPulse, null, 2))

// Check if poll votes in pulse API
const pr = await (await fetch(`https://pub.fotmob.com/prod/pulse/api/match/${matchId}`)).json()
const pollReactions = pr.reactions.find(x => x.reactionToId === String(pollPulse?.id))
console.log('\npoll reactions', JSON.stringify(pollReactions, null, 2))
