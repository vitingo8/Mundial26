import test from 'node:test'
import assert from 'node:assert/strict'
import { transformFotmobStandings, FOTMOB_QUALIFIED_COLOR } from './fotmobStandings.js'

const mockApi = {
  table: [{
    data: {
      tables: [
        {
          leagueName: 'Grp. A',
          table: {
            all: [
              { idx: 1, name: 'Mexico', qualColor: FOTMOB_QUALIFIED_COLOR },
              { idx: 2, name: 'South Korea', qualColor: FOTMOB_QUALIFIED_COLOR },
              { idx: 3, name: 'Czechia', qualColor: '#FFD908' },
            ],
          },
        },
        {
          leagueName: 'Best 3rd placed teams',
          table: {
            all: [
              { idx: 1, name: 'Bosnia and Herzegovina', qualColor: FOTMOB_QUALIFIED_COLOR },
              { idx: 9, name: 'Czechia', qualColor: null },
            ],
          },
        },
      ],
    },
  }],
}

test('transformFotmobStandings maps group leaders and qualified thirds', () => {
  const groupMatches = [
    { group: 'A', home: 'México', away: 'Sudáfrica' },
    { group: 'B', home: 'Suiza', away: 'Canadá' },
    { group: 'B', home: 'Bosnia y Herzegovina', away: 'Catar' },
  ]
  const r = transformFotmobStandings(mockApi, groupMatches)
  assert.ok(r.ready)
  assert.equal(r.byGroup.A[1], 'Mexico')
  assert.equal(r.byGroup.A[2], 'South Korea')
  assert.equal(r.byGroup.A[3], null)
  assert.equal(r.byGroup.B[3], 'Bosnia and Herzegovina')
  assert.ok(r.resolvedCount >= 3)
})
