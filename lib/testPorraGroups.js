/** Grupos de porra con id `_test_*`: datos ficticios, sin sync API. */
export const TEST_PORRA_GROUP_PREFIX = '_test_'

export function isTestPorraGroup(id) {
  return String(id || '').startsWith(TEST_PORRA_GROUP_PREFIX)
}
