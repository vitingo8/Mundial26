'use client'

import { useMemo, useCallback } from 'react'
import { buildBracketRounds } from '../../lib/knockoutBracketDisplay'
import {
  BRACKET_LEFT_COLUMNS,
  BRACKET_RIGHT_COLUMNS,
  BRACKET_LEFT_LANES,
  BRACKET_RIGHT_LANES,
  BRACKET_CENTER,
} from '../../lib/knockoutBracketTreeLayout'
import { formatKnockoutErrorForUi, getKnockoutErrorHint } from '../../lib/knockoutBridge'
import { resolveKnockoutTeamsForScoring } from '../../lib/knockoutMatchScoring'
import { indexApiMatches } from '../../lib/apiMatchScores'
import { useIsMobileBracket } from '../../hooks/useIsMobileBracket'
import { BracketCenterOut } from './BracketCenterOut'
import BracketMobileScroll from './BracketMobileScroll'

export default function KnockoutBracketView({
  matches = [],
  preds = {},
  onScore,
  onAdvance,
  locked = false,
  getMatchLocked,
  matchRefs,
  error = null,
  readOnly = false,
  apiMatches = [],
  userPreds = {},
  onGoToPrediction,
  publishedResults = {},
  knockoutScoringCtx = null,
  onOpenMatch,
  participants = null,
  groupMatches = [],
  knockoutMatches = [],
  viewingParticipantPreds = false,
}) {
  const isMobile = useIsMobileBracket()

  const matchByNum = useMemo(() => {
    const rounds = buildBracketRounds(matches)
    const map = {}
    for (const round of rounds) {
      for (const m of round.matches) {
        map[m.matchNumber] = m
      }
    }
    return map
  }, [matches])

  const rawById = useMemo(() => indexApiMatches(apiMatches), [apiMatches])
  const getMatch = useCallback(n => matchByNum[n] ?? null, [matchByNum])

  const slotProps = {
    preds,
    onScore,
    onAdvance,
    locked,
    getMatchLocked,
    matchRefs,
    readOnly,
    userPreds,
    onGoToPrediction,
    rawById,
    publishedResults,
    knockoutScoringCtx,
    onOpenMatch,
    participants,
    groupMatches,
    knockoutMatches,
    viewingParticipantPreds,
  }

  if (isMobile) {
    return (
      <BracketMobileScroll
        getMatch={getMatch}
        error={error}
        {...slotProps}
      />
    )
  }

  return (
    <div className="knockout-bracket-scene">
      {error && (
        <div className="predicted-knockout-alert knockout-bracket-alert" role="status">
          {formatKnockoutErrorForUi(error)}
          {getKnockoutErrorHint(error) && (
            <span className="predicted-knockout-alert-detail">{getKnockoutErrorHint(error)}</span>
          )}
        </div>
      )}

      <div className="knockout-bracket-tree-wrap">
        <div
          className="knockout-bracket-tree"
          role="img"
          aria-label="Cuadro eliminatorio Mundial 2026"
        >
          <BracketCenterOut
            leftColumns={BRACKET_LEFT_COLUMNS}
            rightColumns={BRACKET_RIGHT_COLUMNS}
            leftLanes={BRACKET_LEFT_LANES}
            rightLanes={BRACKET_RIGHT_LANES}
            finalMatch={getMatch(BRACKET_CENTER.final)}
            thirdMatch={getMatch(BRACKET_CENTER.third)}
            getMatch={getMatch}
            {...slotProps}
          />
        </div>
      </div>
    </div>
  )
}
