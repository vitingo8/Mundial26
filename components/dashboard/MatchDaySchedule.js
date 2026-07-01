'use client'

import { useEffect, useMemo, useState } from 'react'

import {
  buildDayTabs,
  matchDateKey,
  scheduleAnchorDateKey,
  todayDateKey,
} from '../../lib/matchSchedule'

import { groupMatchesByKnockoutRound } from '../../lib/knockoutBracketDisplay'
import { lookupEliminatoriasKoPred } from '../../lib/knockoutBridge'

import DayTabs from './DayTabs'
import { indexApiMatches } from '../../lib/apiMatchScores'
import { isPorraApiResultStatus } from '../../lib/matchDetail'
import MatchRow from './MatchRow'
import { resolveKnockoutTeamsForScoring } from '../../lib/knockoutMatchScoring'

/**
 * Calendario por días o vista Todo (todos los partidos en una lista).
 * @param {'group'|'knockout'} schedulePhase
 * @param {'daily'|'full'} viewMode
 */
export default function MatchDaySchedule({
  matches,
  preds,
  onScore,
  onAdvance,
  locked = false,
  getMatchLocked,
  matchRefs,
  getSectionLabel,
  getSectionKey,
  filterMatch,
  schedulePhase = 'group',
  viewMode = 'daily',
  /** Sin caja de fondo en el listado (p. ej. porra eliminatorias) */
  flatMatchesPanel = false,
  /** Si no se define, en fase knockout todos los partidos muestran selector en empate */
  advancePickerForMatch,
  publishedResults = {},
  knockoutScoringCtx = null,
  apiMatches = [],
  onOpenMatch,
  participants = null,
  groupMatches = [],
  knockoutMatches = [],
  inicioKnockoutScoring = null,
  /** Fuerza la pestaña de día (p. ej. «hoy» desde aviso de porra). */
  focusDayKey = null,
}) {
  const rawById = useMemo(() => indexApiMatches(apiMatches), [apiMatches])
  const knockoutAdvanceDefault = schedulePhase === 'knockout'
  function showAdvancePicker(m) {
    if (advancePickerForMatch) return advancePickerForMatch(m)
    return knockoutAdvanceDefault
  }
  const fullView = viewMode === 'full'
  const days = useMemo(
    () => buildDayTabs(matches, { phase: schedulePhase }),
    [matches, schedulePhase],
  )
  const today = todayDateKey()
  const anchor = scheduleAnchorDateKey(schedulePhase)
  const [selectedDay, setSelectedDay] = useState(null)

  useEffect(() => {
    if (fullView || !days.length) {
      setSelectedDay(null)
      return
    }
    if (focusDayKey && days.some(d => d.key === focusDayKey)) {
      setSelectedDay(focusDayKey)
      return
    }
    setSelectedDay(prev => {
      if (prev && days.some(d => d.key === prev)) return prev
      const todayTab = days.find(d => d.key === today)
      const anchorTab = days.find(d => d.key === anchor)
      return todayTab?.key ?? anchorTab?.key ?? days[0].key
    })
  }, [days, today, anchor, fullView, focusDayKey])

  const filteredMatches = useMemo(() => {
    return matches
      .filter(m => (filterMatch ? filterMatch(m) : true))
      .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
  }, [matches, filterMatch])

  const dayMatches = useMemo(() => {
    if (fullView) return filteredMatches
    if (!selectedDay) return []
    return filteredMatches.filter(m => matchDateKey(m.utcDate) === selectedDay)
  }, [filteredMatches, selectedDay, fullView])

  const sections = useMemo(() => {
    if (schedulePhase === 'knockout') {
      const source = fullView ? filteredMatches : dayMatches
      return groupMatchesByKnockoutRound(source)
    }
    if (fullView) {
      return [{ key: 'all', label: null, items: dayMatches }]
    }
    const map = new Map()
    for (const m of dayMatches) {
      const key = getSectionKey(m)
      if (!map.has(key)) {
        map.set(key, { key, label: getSectionLabel(m), items: [] })
      }
      map.get(key).items.push(m)
    }
    return [...map.values()]
  }, [dayMatches, filteredMatches, getSectionKey, getSectionLabel, fullView, schedulePhase])

  if (!matches.length) return null

  const listEmpty = schedulePhase === 'knockout' && fullView
    ? filteredMatches.length === 0
    : dayMatches.length === 0

  const panelClass = [
    'schedule-panel',
    fullView ? 'schedule-panel--full' : '',
    schedulePhase === 'knockout' ? 'schedule-panel--knockout' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const matchesPanelClass = [
    'schedule-matches-panel',
    flatMatchesPanel ? 'schedule-matches-panel--flat' : '',
  ]
    .filter(Boolean)
    .join(' ')

  function renderMatchRow(m, compact = false) {
    const publishedResult = publishedResults[m.id]
    const scoringTeams = knockoutScoringCtx
      ? resolveKnockoutTeamsForScoring(m.id, publishedResult, knockoutScoringCtx)
      : {}
    const predRow =
      schedulePhase === 'knockout'
        ? lookupEliminatoriasKoPred(preds, m) || {}
        : preds[m.id] || {}
    return (
      <MatchRow
        key={m.id}
        matchId={m.id}
        matchRef={el => { if (matchRefs) matchRefs.current[m.id] = el }}
        home={m.home}
        away={m.away}
        homeCrest={m.homeCrest}
        awayCrest={m.awayCrest}
        utcDate={m.utcDate}
        matchNumber={m.matchNumber}
        fifaMatchLabel={m.fifaMatchLabel}
        knockoutMatchupLabel={m.knockoutMatchupLabel}
        homeVal={predRow.home ?? ''}
        awayVal={predRow.away ?? ''}
        onHome={v => onScore(m.id, 'home', v)}
        onAway={v => onScore(m.id, 'away', v)}
        advancesVal={predRow.advances}
        onAdvance={side => onAdvance?.(m.id, side)}
        knockoutAdvance={showAdvancePicker(m)}
        locked={locked || (getMatchLocked ? getMatchLocked(m) : false)}
        compact={compact}
        showMatchDate={schedulePhase === 'knockout'}
        publishedResult={publishedResult}
        knockoutScoringTeams={scoringTeams}
        apiRaw={rawById[m.id]}
        onOpenLiveDetail={
          onOpenMatch && rawById[m.id] && isPorraApiResultStatus(rawById[m.id].status)
            ? () => onOpenMatch(m)
            : undefined
        }
        participants={participants}
        groupMatches={groupMatches}
        knockoutMatches={knockoutMatches}
        homePendingThird={m.homePendingThird}
        awayPendingThird={m.awayPendingThird}
        pendingThirdMatch={m.pendingThirdMatch}
        homePendingThirdSlot={m.homePendingThirdSlot}
        awayPendingThirdSlot={m.awayPendingThirdSlot}
        inicioKnockoutScoring={inicioKnockoutScoring}
      />
    )
  }

  const matchesBody =
    sections.length === 0 || listEmpty ? (
      <p className="schedule-empty-day">No hay partidos este día</p>
    ) : fullView ? (
      <div className="schedule-full-list">
        {(schedulePhase === 'knockout' ? filteredMatches : dayMatches).map((m, i, arr) => {
          const prev = i > 0 ? arr[i - 1] : null
          let header = null
          if (schedulePhase === 'knockout') {
            if (prev?.roundId !== m.roundId) {
              header = m.roundLabel || m.roundId || null
            }
          } else {
            const dayKey = matchDateKey(m.utcDate)
            const prevKey = prev ? matchDateKey(prev.utcDate) : null
            if (dayKey !== prevKey) header = formatFullDayLabel(m.utcDate)
          }
          return (
            <div key={m.id}>
              {header ? (
                <div className="schedule-full-day-label">{header}</div>
              ) : null}
              {renderMatchRow(m, true)}
            </div>
          )
        })}
      </div>
    ) : (
      sections.map(sec => (
        <section key={sec.key || sec.label} className="schedule-block">
          {sec.label ? (
            <header className="schedule-block-header schedule-block-header--round">
              {sec.label}
            </header>
          ) : null}
          <div className="schedule-block-list">
            {sec.items.map(m => renderMatchRow(m, fullView && schedulePhase === 'knockout'))}
          </div>
        </section>
      ))
    )

  return (
    <div className={panelClass}>
      {!fullView && (
        <div className="schedule-day-picker">
          <DayTabs
            days={days}
            selectedKey={selectedDay}
            onSelect={setSelectedDay}
            centerKey={anchor}
          />
        </div>
      )}

      <div className={matchesPanelClass}>{matchesBody}</div>
    </div>
  )
}

function formatFullDayLabel(utcDate) {
  return new Date(utcDate).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Madrid',
  })
}
