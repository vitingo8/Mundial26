'use client'

import { useEffect, useState } from 'react'
import { displayTeamName } from '../../lib/teamNamesEs'

const TABS = [
  { id: 'scorers', label: 'Mejor Goleador', statLabel: 'Goles' },
  { id: 'assists', label: 'Mejor Asistente', statLabel: 'Asist.' },
  { id: 'rating', label: 'Mejor Jugador', statLabel: 'Nota' },
  { id: 'keepers', label: 'Mejor Portero', statLabel: 'Nota' },
]

export default function LiveSpecialsPanel({ isActive = false }) {
  const [tab, setTab] = useState('scorers')
  const [payload, setPayload] = useState(null)

  useEffect(() => {
    if (!isActive) return
    let cancelled = false
    fetch('/api/fotmob/specials')
      .then(res => res.json())
      .then(data => {
        if (!cancelled) setPayload(data)
      })
      .catch(() => {
        if (!cancelled) setPayload({ scorers: { players: [] }, assists: { players: [] }, rating: { players: [] }, keepers: { players: [] } })
      })
    return () => { cancelled = true }
  }, [isActive])

  const current = payload?.[tab]
  const players = current?.players || []
  const activeTab = TABS.find(t => t.id === tab) || TABS[0]

  return (
    <section className="live-specials live-specials--phase" aria-label="Especiales">
      <div className="live-specials__tabs schedule-view-tabs" role="tablist" aria-label="Especiales del Mundial">
        {TABS.map(item => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`schedule-view-tab${tab === item.id ? ' schedule-view-tab--active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {players.length > 0 && (
        <ol className="live-specials__list">
          {players.slice(0, 10).map((row, idx) => (
            <li key={`${row.playerId || row.name}-${idx}`} className="live-specials__row">
              <span className="live-specials__rank">{row.rank}</span>
              {row.photo ? (
                <img
                  src={row.photo}
                  alt=""
                  className="live-specials__photo"
                  width={32}
                  height={32}
                  loading="lazy"
                />
              ) : (
                <span className="live-specials__photo live-specials__photo--empty" aria-hidden />
              )}
              <div className="live-specials__meta">
                <span className="live-specials__name">{row.name}</span>
                {row.team && (
                  <span className="live-specials__team">{displayTeamName(row.team)}</span>
                )}
              </div>
              <div className="live-specials__stat">
                <span className="live-specials__stat-value">{row.valueLabel}</span>
                <span className="live-specials__stat-label">{activeTab.statLabel}</span>
                {row.secondary?.label && (
                  <span className="live-specials__stat-sub">{row.secondary.label} {row.secondary.value}</span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
