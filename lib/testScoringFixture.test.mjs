import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { calcMatchPoints, SCORING } from './gameData.js'
import {
  TEST_PREDICTIONS,
  TEST_REAL_RESULTS,
  TEST_EXPECTED_SCORE,
  buildTestRealResults,
} from './testScoringFixture.js'
import { calcParticipantScoreColumns } from './gameData.js'

describe('testScoringFixture', () => {
  it('incluye 72 partidos de grupos', () => {
    assert.equal(Object.keys(TEST_PREDICTIONS.group).length, 72)
  })

  it('incluye 32 partidos inicioKnockout', () => {
    assert.equal(Object.keys(TEST_PREDICTIONS.inicioKnockout).length, 32)
  })

  it('patrón exacto / 1X2 / fallo en primeros tres ids de grupos', () => {
    const ids = Object.keys(TEST_PREDICTIONS.group).sort()
    const exact = calcMatchPoints(
      TEST_PREDICTIONS.group[ids[0]],
      TEST_REAL_RESULTS.group[ids[0]],
    )
    const outcome = calcMatchPoints(
      TEST_PREDICTIONS.group[ids[1]],
      TEST_REAL_RESULTS.group[ids[1]],
    )
    const miss = calcMatchPoints(
      TEST_PREDICTIONS.group[ids[2]],
      TEST_REAL_RESULTS.group[ids[2]],
    )
    assert.equal(exact, SCORING.correctOutcome + SCORING.exactScore)
    assert.equal(outcome, SCORING.correctOutcome)
    assert.equal(miss, 0)
  })

  it('cada tercio del calendario de grupos cumple exacto / 1X2 / fallo', () => {
    const ids = Object.keys(TEST_PREDICTIONS.group).sort()
    for (let i = 0; i < ids.length; i++) {
      const pred = TEST_PREDICTIONS.group[ids[i]]
      const res = TEST_REAL_RESULTS.group[ids[i]]
      const pts = calcMatchPoints(pred, res)
      if (i % 3 === 0) assert.equal(pts, 8, ids[i])
      else if (i % 3 === 1) assert.equal(pts, 3, ids[i])
      else assert.equal(pts, 0, ids[i])
    }
  })

  it('buildTestRealResults es determinista', () => {
    assert.deepEqual(buildTestRealResults(), TEST_REAL_RESULTS)
  })

  it('total esperado coincide con calcParticipantScoreColumns', () => {
    const cols = calcParticipantScoreColumns(
      { predictions: TEST_PREDICTIONS },
      { results: TEST_REAL_RESULTS, actuals: { topScorer: 'Mbappe', topKeeper: 'Joan Garcia', topAssists: 'Lamine Yamal', mvp: 'Lamine Yamal' } },
    )
    assert.deepEqual(cols, TEST_EXPECTED_SCORE)
  })

  it('bonos completos suman 28 pts', () => {
    assert.equal(TEST_EXPECTED_SCORE.especialPts, 18)
    assert.equal(TEST_EXPECTED_SCORE.mvpPts, 10)
  })
})
