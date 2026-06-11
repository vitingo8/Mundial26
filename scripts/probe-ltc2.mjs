const matchId = 4667751
const teams = JSON.stringify(['Mexico', 'South Africa'])
const langs = ['es', 'es_gen', 'en', 'en_gen']

for (const lang of langs) {
  const ltcUrl = `http://data.fotmob.com/webcl/ltc/gsm/${matchId}_${lang}.json.gz`
  const params = new URLSearchParams({ ltcUrl, teams })
  const r = await fetch(`https://www.fotmob.com/api/data/ltc?${params}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  const t = await r.text()
  console.log('\n===', lang, r.status, t.length)
  if (r.ok) {
    const d = JSON.parse(t)
    console.log('keys', Object.keys(d))
    console.log('events count', d.events?.length)
    console.log('pulseItems', d.pulseItems?.length)
    if (d.events?.[0]) console.log('event0', JSON.stringify(d.events[0], null, 2).slice(0, 1500))
    if (d.pulseItems?.[0]) console.log('pulse0', JSON.stringify(d.pulseItems[0], null, 2).slice(0, 1500))
  } else {
    console.log(t.slice(0, 200))
  }
}
