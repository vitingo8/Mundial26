import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { defaultParticipantSheetView } from './defaultParticipantSheetView.js'

describe('defaultParticipantSheetView', () => {
  it('uses bracket when group phase is knockout', () => {
    assert.equal(defaultParticipantSheetView({ groupPhase: 'knockout' }), 'bracket')
  })

  it('uses bracket when group deadline passed even if phase is still group', () => {
    assert.equal(
      defaultParticipantSheetView({
        groupPhase: 'group',
        group: { group_deadline: '2020-01-01T00:00:00.000Z' },
      }),
      'bracket',
    )
  })

  it('uses bracket when knockout matches are live in API', () => {
    assert.equal(
      defaultParticipantSheetView({
        groupPhase: 'group',
        apiMatches: [{ stage: 'LAST_32', status: 'IN_PLAY' }],
      }),
      'bracket',
    )
  })

  it('uses groups during group stage before knockout window', () => {
    assert.equal(
      defaultParticipantSheetView({
        groupPhase: 'group',
        group: { group_deadline: '2099-01-01T00:00:00.000Z' },
        apiMatches: [{ stage: 'GROUP_STAGE', status: 'SCHEDULED' }],
        todayKey: '2026-06-20',
      }),
      'groups',
    )
  })
})
