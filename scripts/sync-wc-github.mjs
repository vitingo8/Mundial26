#!/usr/bin/env node
/**
 * Cron en GitHub Actions: solo sincroniza si hay partido en ventana (inicio / en juego / recién acabado).
 * Uso local: node --env-file=.env.local scripts/sync-wc-github.mjs
 * Forzar:   node --env-file=.env.local scripts/sync-wc-github.mjs --force
 */
import { syncAllGroupsFromApi } from '../lib/syncAllGroupsFromApi.js'

const force = process.argv.includes('--force')

async function main() {
  const result = await syncAllGroupsFromApi({ force })
  console.log(JSON.stringify(result, null, 2))
  if (result.skipped) process.exit(0)
}

main().catch(err => {
  console.error(err.message || err)
  process.exit(1)
})
