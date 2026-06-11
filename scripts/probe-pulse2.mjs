const matchId = 4667751
const emojisRaw = await (await fetch('https://data.fotmob.com/webcl/pulse/emojis.json')).json()
console.log('emoji keys', typeof emojisRaw, Array.isArray(emojisRaw) ? emojisRaw.length : Object.keys(emojisRaw).slice(0, 5))
const emojis = Array.isArray(emojisRaw) ? emojisRaw : Object.values(emojisRaw)
console.log('emoji sample', JSON.stringify(emojis.slice(0, 3), null, 2))

const r = await (await fetch(`https://pub.fotmob.com/prod/pulse/api/match/${matchId}`)).json()
const rcReactions = r.reactions.find(x => x.reactionToId.includes('218418') || x.reactionToId === '3938')
console.log('\nRC reactions', JSON.stringify(rcReactions, null, 2))

// Find by messageId pattern
for (const id of ['es:card:RC:218418', '3938', '26082414900050']) {
  const found = r.reactions.find(x => x.reactionToId === id)
  if (found) console.log(`\nfound for ${id}`, JSON.stringify(found, null, 2))
}

// Map reaction ids to emojis
const emojiMap = new Map(emojis.map(e => [String(e.id), e]))
const eventReaction = r.reactions.find(x => x.reactionToId === 'es:card:RC:218418')
if (eventReaction) {
  console.log('\nmapped reactions:')
  for (const rc of eventReaction.reactionCounts) {
    const em = emojiMap.get(rc.reactionId)
    console.log(rc.reactionId, rc.count, em?.emoji || em?.name || '?')
  }
}
