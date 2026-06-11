import { buildFotmobLtcFeed } from '../lib/matchDetail.js'

const matchId = 4667751
const teams = JSON.stringify(['Mexico', 'South Africa'])
const ltcUrl = `http://data.fotmob.com/webcl/ltc/gsm/${matchId}_es.json.gz`
const params = new URLSearchParams({ ltcUrl, teams })
const ltc = await (await fetch(`https://www.fotmob.com/api/data/ltc?${params}`, {
  headers: { 'User-Agent': 'Mozilla/5.0' },
})).json()

const emojis = await (await fetch('https://data.fotmob.com/webcl/pulse/emojis.json')).json()
const emojiById = new Map((emojis.emojis || []).map(e => [String(e.id), e.value]))
const pulse = await (await fetch(`https://pub.fotmob.com/prod/pulse/api/match/${matchId}`)).json()
const pulseData = { ...pulse, emojiById }

const feed = buildFotmobLtcFeed(ltc, pulseData, 'es')
console.log('feed items', feed.length)
console.log('types', [...new Set(feed.map(f => f.feedType))])

const rcBlock = feed.filter(f =>
  f.title?.includes('roja') || f.text?.includes('SITHOLE') || f.source?.includes('espectador') || f.question?.includes('roja'),
)
console.log('\nRC block sample:')
for (const item of rcBlock.slice(0, 4)) {
  console.log(JSON.stringify({
    feedType: item.feedType,
    minute: item.minute,
    title: item.title,
    author: item.author,
    source: item.source,
    question: item.question,
    reactions: item.reactions?.slice(0, 3),
    text: item.text?.slice(0, 80),
  }, null, 2))
}
