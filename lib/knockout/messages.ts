/** Mensajes de error del bracket (UI en castellano). */
export const knockoutMessages = {
  missingCombination: (key: string) =>
    `No hay asignación de mejores terceros para la combinación ${key}.`,
  missingCombinationHint:
    'Esta combinación aún no está en la tabla oficial configurada en el servidor.',
  missingAssignmentForMatch: (match: number, combinationKey: string) =>
    `Falta la asignación del tercer clasificado para el partido ${match} (combinación ${combinationKey}).`,
  groupNotAllowed: (match: number, group: string, source: string, allowed: string) =>
    `Partido ${match}: el grupo ${group} no está permitido para ${source} (permitidos: ${allowed}).`,
  groupNotAmongBestThirds: (match: number, group: string) =>
    `Partido ${match}: el grupo ${group} no está entre los 8 mejores terceros.`,
  thirdUsedTwice: (group: string, combinationKey: string) =>
    `El tercer clasificado del grupo ${group} está asignado más de una vez (combinación ${combinationKey}).`,
  bracketEmpty: 'El cuadro de dieciseisavos está vacío.',
  invalidSource: (code: string) => `Código de equipo no válido: ${code}`,
  missingAssignmentForSource: (match: number, source: string) =>
    `Sin asignación de tercero para el partido ${match} (${source}).`,
  expected12Groups: (count: number, keys: string) =>
    `Se esperaban 12 grupos (A–L); se recibieron ${count}: ${keys}.`,
  missingGroup: (letter: string) => `Falta el grupo ${letter}.`,
  groupMinTeams: (letter: string, count: number) =>
    `El grupo ${letter} debe tener al menos 3 equipos clasificados (tiene ${count}).`,
  expected8Thirds: (count: number) =>
    `Se esperaban exactamente 8 mejores terceros; se obtuvieron ${count}.`,
  combinationKeyNeeds8: (count: number) =>
    `La clave de combinación requiere 8 terceros; hay ${count}.`,
  noStandingPosition: (group: string, position: number) =>
    `El grupo ${group} no tiene equipo en la posición ${position}.`,
  noQualifiedEntry: (group: string, label: string) =>
    `No hay clasificado (${label}) para el grupo ${group}.`,
} as const
