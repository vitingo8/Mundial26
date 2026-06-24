export function teamCrestUrl(_teamId) {
  return null
}

export function playerPhotoUrl(playerId) {
  if (!playerId) return undefined
  return `https://images.fotmob.com/image_resources/playerimages/${playerId}.png`
}
