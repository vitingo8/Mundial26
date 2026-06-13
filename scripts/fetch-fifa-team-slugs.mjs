import { fifaTeamSlug } from '../lib/fifaHighlights.js'

const url =
  'https://cxm-api.fifa.com/fifaplusweb/api/sections/teamsModule/4v5Yng3VdGD9c1cpnOIff1?locale=en&limit=50'
const res = await fetch(url, { headers: { 'User-Agent': 'Mundial26/1.0' } })
const data = await res.json()

const rows = (data.teams || []).map(team => {
  const expected = team.teamPageUrl.split('/teams/').pop()
  const got = fifaTeamSlug(team.teamName)
  return { expected, got, fifaName: team.teamName, ok: expected === got }
})

rows.sort((a, b) => a.expected.localeCompare(b.expected))
const failed = rows.filter(r => !r.ok)

for (const row of rows) {
  console.log(`${row.ok ? ' ' : '!'} ${row.expected.padEnd(22)} ${row.fifaName}`)
}

console.log(`\n${rows.length} equipos, ${failed.length} desajustes`)
if (failed.length) {
  process.exitCode = 1
  for (const row of failed) {
    console.error(`  ${row.fifaName}: got "${row.got}", expected "${row.expected}"`)
  }
}
