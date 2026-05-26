import type { ThirdPlaceCombinationMap } from '../types'

/**
 * Tabla global de combinaciones de mejores terceros → asignación por número de partido.
 * Rellenar con las combinaciones oficiales FIFA; no inventar filas.
 *
 * Ejemplo ilustrativo (solo para la clave de prueba ACDFGHIJ):
 */
export const thirdPlaceCombinationMap: ThirdPlaceCombinationMap = {
  ACDFGHIJ: {
    74: 'C',
    77: 'D',
    79: 'F',
  },
}
