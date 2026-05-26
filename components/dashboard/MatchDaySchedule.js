'use client'

import { useEffect, useMemo, useState } from 'react'

import {
  buildDayTabs,
  matchDateKey,
  scheduleAnchorDateKey,
  todayDateKey,
} from '../../lib/matchSchedule'

import DayTabs from './DayTabs'
import MatchRow from './MatchRow'

/**
 * Calendario por días o vista completa (todos los partidos en una lista).
 * @param {'group'|'knockout'} schedulePhase
 */
export default function MatchDaySchedule({
  matches,
  preds,
  onScore,
  locked,
  matchRefs,
  getSectionLabel,
  getSectionKey,
  filterMatch,
  schedulePhase = 'group',
  fullView = false,
}) {
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
    setSelectedDay(prev => {
      if (prev && days.some(d => d.key === prev)) return prev
      const todayTab = days.find(d => d.key === today)
      const anchorTab = days.find(d => d.key === anchor)
      return todayTab?.key ?? anchorTab?.key ?? days[0].key
    })
  }, [days, today, anchor, fullView])

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
    if (fullView) {
      return [{ label: null, items: dayMatches }]
    }
    const map = new Map()
    for (const m of dayMatches) {
      const key = getSectionKey(m)
      if (!map.has(key)) map.set(key, { label: getSectionLabel(m), items: [] })
      map.get(key).items.push(m)
    }
    return [...map.values()]
  }, [dayMatches, getSectionKey, getSectionLabel, fullView])

  if (!matches.length) return null

  return (
    <div className={`schedule-panel${fullView ? ' schedule-panel--full' : ''}`}>
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

      <div className="schedule-matches-panel">
        {sections.length === 0 || dayMatches.length === 0 ? (
          <p className="schedule-empty-day">No hay partidos este día</p>
        ) : fullView ? (
          <div className="schedule-full-list">
            {dayMatches.map((m, i) => {
              const dayKey = matchDateKey(m.utcDate)
              const prevKey = i > 0 ? matchDateKey(dayMatches[i - 1].utcDate) : null
              const showDay = dayKey !== prevKey
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="schedule-full-day-label">{formatFullDayLabel(m.utcDate)}</div>
                  )}
                  <MatchRow
                    matchRef={el => { if (matchRefs) matchRefs.current[m.id] = el }}
                    home={m.home}
                    away={m.away}
                    homeCrest={m.homeCrest}
                    awayCrest={m.awayCrest}
                    utcDate={m.utcDate}
                    homeVal={preds[m.id]?.home ?? ''}
                    awayVal={preds[m.id]?.away ?? ''}
                    onHome={v => onScore(m.id, 'home', v)}
                    onAway={v => onScore(m.id, 'away', v)}
                    locked={locked}
                    compact={fullView}
                  />
                </div>
              )
            })}
          </div>
        ) : (
          sections.map(sec => (
            <section key={sec.label} className="schedule-block">
              <header className="schedule-block-header">{sec.label}</header>
              <div className="schedule-block-list">
                {sec.items.map(m => (
                  <MatchRow
                    key={m.id}
                    matchRef={el => { if (matchRefs) matchRefs.current[m.id] = el }}
                    home={m.home}
                    away={m.away}
                    homeCrest={m.homeCrest}
                    awayCrest={m.awayCrest}
                    utcDate={m.utcDate}
                    homeVal={preds[m.id]?.home ?? ''}
                    awayVal={preds[m.id]?.away ?? ''}
                    onHome={v => onScore(m.id, 'home', v)}
                    onAway={v => onScore(m.id, 'away', v)}
                    locked={locked}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
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
