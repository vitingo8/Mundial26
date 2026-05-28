/** Sugerencias para predicciones especiales (campo libre, no porteros). */
export const PLAYER_SUGGESTIONS = [
  'Lionel Messi', 'Kylian Mbappé', 'Erling Haaland', 'Vinícius Júnior',
  'Jude Bellingham', 'Harry Kane', 'Lamine Yamal', 'Rodri',
  'Mohamed Salah', 'Lautaro Martínez', 'Raphinha', 'Ousmane Dembélé',
  'Kevin De Bruyne', 'Bruno Fernandes', 'Pedri', 'Gavi',
]

/** Solo porteros — apuesta «Mejor portero». */
export const GOALKEEPER_SUGGESTIONS = [
  'Alisson', 'Emiliano Martínez', 'Gianluigi Donnarumma', 'Thibaut Courtois',
  'Joan Garcia', 'Jordan Pickford', 'Jan Oblak', 'Manuel Neuer',
  'Mike Maignan', 'Ederson', 'David Raya',
  'Yann Sommer', 'Wojciech Szczęsny', 'Diogo Costa', 'Unai Simón',
  'Sergio Rochet', 'Walter Benítez', 'Keylor Navas', 'Guillermo Ochoa',
]

const keeperSet = new Set(GOALKEEPER_SUGGESTIONS.map(n => n.trim().toLowerCase()))

export function getBonusFieldSuggestions(fieldId) {
  return fieldId === 'topKeeper' ? GOALKEEPER_SUGGESTIONS : PLAYER_SUGGESTIONS
}

export function isGoalkeeperSuggestion(name) {
  if (!name || !String(name).trim()) return true
  return keeperSet.has(String(name).trim().toLowerCase())
}
