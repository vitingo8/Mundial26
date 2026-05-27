#!/usr/bin/env node
/**
 * Crea/actualiza el grupo de prueba de puntuación en Supabase y verifica el total.
 *
 *   node --env-file=.env.local scripts/seed-test-scoring.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { calcParticipantScoreColumns } from '../lib/gameData.js'
import {
  TEST_GROUP_ROW,
  TEST_PARTICIPANT_ROW,
  TEST_EXPECTED_SCORE,
  formatTestScoringSummary,
  TEST_SCORING_GROUP_ID,
  TEST_SCORING_PARTICIPANT_ID,
} from '../lib/testScoringFixture.js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (.env.local)')
  }
  return createClient(url, key)
}

async function main() {
  const supabase = getSupabase()

  const { error: gErr } = await supabase.from('porra_groups').upsert(TEST_GROUP_ROW, { onConflict: 'id' })
  if (gErr) throw new Error(`porra_groups: ${gErr.message}`)

  const { error: pErr } = await supabase
    .from('porra_participants')
    .upsert(TEST_PARTICIPANT_ROW, { onConflict: 'id' })
  if (pErr) throw new Error(`porra_participants: ${pErr.message}`)

  const { data: group } = await supabase.from('porra_groups').select('*').eq('id', TEST_SCORING_GROUP_ID).single()
  const { data: participant } = await supabase
    .from('porra_participants')
    .select('*')
    .eq('id', TEST_SCORING_PARTICIPANT_ID)
    .single()

  const cols = calcParticipantScoreColumns(participant, group)
  const ok =
    cols.total === TEST_EXPECTED_SCORE.total &&
    cols.gepPts === TEST_EXPECTED_SCORE.gepPts &&
    cols.resultadoPts === TEST_EXPECTED_SCORE.resultadoPts &&
    cols.especialPts === TEST_EXPECTED_SCORE.especialPts &&
    cols.mvpPts === TEST_EXPECTED_SCORE.mvpPts

  console.log('Grupo de prueba sembrado:', TEST_SCORING_GROUP_ID)
  console.log(formatTestScoringSummary())
  console.log('')
  console.log('Desde Supabase (calcParticipantScoreColumns):')
  console.log(
    `  Inicio (×0,6) ${cols.inicioPts} · KO real (×0,4) ${cols.knockoutPts} · Bonos ${cols.bonusPts}`,
  )
  console.log(
    `  G/E/P ${cols.gepPts} · Resultado ${cols.resultadoPts} · Especial ${cols.especialPts} · MVP ${cols.mvpPts} · TOTAL ${cols.total}`,
  )
  console.log('')
  console.log('Acceso en la app (consola del navegador en localhost):')
  console.log(
    `  localStorage.setItem('porra_session', JSON.stringify({ groupId: '${TEST_SCORING_GROUP_ID}', userId: '${TEST_SCORING_PARTICIPANT_ID}' })); location.reload();`,
  )
  console.log('')
  console.log(ok ? '✓ Verificación OK' : '✗ Los puntos no coinciden con el fixture')

  if (!ok) process.exit(1)
}

main().catch(err => {
  console.error(err.message || err)
  process.exit(1)
})
