const matchId = 4667751
const teams = JSON.stringify(['Mexico', 'South Africa'])
const ltcUrl = `http://data.fotmob.com/webcl/ltc/gsm/${matchId}_es.json.gz`
const params = new URLSearchParams({ ltcUrl, teams })
const d = await (await fetch(`https://www.fotmob.com/api/data/ltc?${params}`, {
  headers: { 'User-Agent': 'Mozilla/5.0' },
})).json()

const placementIds = new Set(d.pulseItems.map(p => p.placementId))
const eventIds = new Set(d.events.map(e => e.messageId))

for (const pid of placementIds) {
  if (!eventIds.has(pid)) {
    const pulses = d.pulseItems.filter(p => p.placementId === pid)
    console.log('orphan placement', pid, pulses.map(p => p.type), 'elapsed', pulses[0]?.elapsed)
  }
}

// Sample comment with pulse
const commentWithPulse = d.events.find(e => placementIds.has(e.messageId) && e.type === 'comment')
console.log('\ncomment with pulse', commentWithPulse?.messageId, commentWithPulse?.elapsed?.toString())
