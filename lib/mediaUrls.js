export function teamCrestUrl(teamId) {
  if (teamId == null || teamId === '') return null
  return `https://images.fotmob.com/image_resources/logo/teamlogo/${teamId}_small.png`
}

export function countryFlagUrl(countryCode) {
  if (!countryCode) return null
  return `https://images.fotmob.com/image_resources/logo/teamlogo/${String(countryCode).toLowerCase()}.png`
}

export function playerPhotoUrl(playerId) {
  if (!playerId) return undefined
  return `https://images.fotmob.com/image_resources/playerimages/${playerId}.png`
}
