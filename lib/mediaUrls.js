export function teamCrestUrl(teamId) {
  if (!teamId) return undefined
  return `https://images.fotmob.com/image_resources/logo/teamlogo/${teamId}_small.png`
}

export function playerPhotoUrl(playerId) {
  if (!playerId) return undefined
  return `https://images.fotmob.com/image_resources/playerimages/${playerId}.png`
}
