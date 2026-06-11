const id = 4667751
const urls = [
  `https://apigw.fotmob.com/livetickerapi?id=${id}&lang=es`,
  `https://apigw.fotmob.com/livetickerapi?id=${id}`,
  `https://apigw.fotmob.com/liveticker?id=${id}&lang=es`,
  `https://apigw.fotmob.com/matchDetails?matchId=${id}`,
  `https://apigw.fotmob.com/matchdetailapi?id=${id}`,
  `https://www.fotmob.com/api/data/matchDetails?matchId=${id}&lang=es`,
  `https://data.fotmob.com/prod/news/api/liveticker?matchId=${id}&lang=es`,
  `https://data.fotmob.com/liveticker/${id}.json`,
  `https://pub.fotmob.com/prod/news/api/liveticker?matchId=${id}&lang=es`,
]

for (const url of urls) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } })
    const t = await r.text()
    console.log(r.status, url.replace('https://', '').slice(0, 70), t.slice(0, 400))
  } catch (e) {
    console.log('ERR', url, e.message)
  }
}
