'use client'

import { useEffect, useRef } from 'react'

function scrollDayToCenter(container, dayKey, behavior = 'auto') {
  if (!container || !dayKey) return
  const el = container.querySelector(`[data-day-key="${dayKey}"]`)
  if (!el) return
  const left = el.offsetLeft - (container.clientWidth - el.offsetWidth) / 2
  container.scrollTo({ left: Math.max(0, left), behavior })
}

export default function DayTabs({ days, selectedKey, onSelect, centerKey }) {
  const scrollRef = useRef(null)
  const didCenterToday = useRef(false)

  useEffect(() => {
    didCenterToday.current = false
  }, [centerKey])

  useEffect(() => {
    if (didCenterToday.current) return
    const container = scrollRef.current
    if (!container || !centerKey || !days.some(d => d.key === centerKey)) return
    requestAnimationFrame(() => {
      scrollDayToCenter(container, centerKey, 'auto')
      didCenterToday.current = true
    })
  }, [days, centerKey])

  useEffect(() => {
    if (!selectedKey || selectedKey === centerKey) return
    const container = scrollRef.current
    if (!container) return
    scrollDayToCenter(container, selectedKey, 'smooth')
  }, [selectedKey, centerKey])

  if (!days.length) return null

  return (
    <div
      className="schedule-day-tabs"
      ref={scrollRef}
      role="tablist"
      aria-label="Días"
    >
      {days.map(d => {
        const selected = d.key === selectedKey
        return (
          <button
            key={d.key}
            type="button"
            role="tab"
            aria-selected={selected}
            data-day-key={d.key}
            className={`schedule-day-tab${selected ? ' schedule-day-tab--active' : ''}${d.isToday ? ' schedule-day-tab--today' : ''}`}
            onClick={() => onSelect(d.key)}
          >
            <span className="schedule-day-tab__dow">{d.weekday}</span>
            {d.isToday && selected ? (
              <span className="schedule-day-tab__today">HOY</span>
            ) : (
              <span className="schedule-day-tab__num">{d.dayNum}</span>
            )}
            <span className="schedule-day-tab__mon">{d.month}</span>
          </button>
        )
      })}
    </div>
  )
}
