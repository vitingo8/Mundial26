'use client'

import { useEffect, useMemo, useState } from 'react'
import { useWcMatches } from '../hooks/useWcMatches'
import { getApiMatchDisplayScore } from '../lib/apiMatchScores'
import { displayTeamName } from '../lib/teamNamesEs'
import { Icon } from './icons'
import { useSimulatedLiveClock } from '../hooks/useSimulatedLiveClock'

const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'LIVE'])

function teamLabel(name) {
  const label = displayTeamName(name)
  return label || '?'
}

function LiveFloatingButton({ match, onClick }) {
  const home = match.homeTeam?.shortName || match.homeTeam?.name
  const away = match.awayTeam?.shortName || match.awayTeam?.name
  const score = getApiMatchDisplayScore(match)
  const isPaused = match.status === 'PAUSED'
  const liveClock = useSimulatedLiveClock({
    liveTime: match.liveTime,
    minute: match.minute,
    status: match.status,
  })
  const minute = isPaused ? 'HT' : liveClock?.compact

  if (!score) return null

  return (
    <button
      type="button"
      className={`live-floating-btn${isPaused ? ' live-floating-btn--paused' : ''}`}
      onClick={() => onClick(match.id)}
      aria-label={`${displayTeamName(home)} ${score.home} a ${score.away} ${displayTeamName(away)}${minute ? `, ${minute}` : ''}`}
    >
      {!isPaused && <span className="live-floating-btn__pulse" aria-hidden />}
      <span className="live-floating-btn__score">
        <span className="live-floating-btn__team">{teamLabel(home)}</span>
        <span className="live-floating-btn__nums">{score.home}-{score.away}</span>
        <span className="live-floating-btn__team">{teamLabel(away)}</span>
      </span>
      {minute && <span className="live-floating-btn__min">{minute}</span>}
      {!isPaused && <Icon name="signal" size={12} className="live-floating-btn__icon" />}
    </button>
  )
}

export default function LiveFloatingButtons() {
  const { wcMatches } = useWcMatches()
  const [inDashboard, setInDashboard] = useState(false)

  const liveMatches = useMemo(
    () => (wcMatches || [])
      .filter(m => LIVE_STATUSES.has(m.status) && getApiMatchDisplayScore(m))
      .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate)),
    [wcMatches],
  )

  useEffect(() => {
    const check = () => setInDashboard(!!document.querySelector('.dashboard-app'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.body, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [])

  function handleClick(matchId) {
    sessionStorage.setItem('porra_open_live', String(matchId))
    window.dispatchEvent(new CustomEvent('porra:open-live', { detail: { matchId } }))
    if (!document.querySelector('.dashboard-app')) {
      window.location.href = '/'
    }
  }

  if (!liveMatches.length) return null

  return (
    <div
      className={`live-floating-wrap${inDashboard ? ' live-floating-wrap--dashboard' : ''}`}
      role="region"
      aria-label="Partidos en vivo"
    >
      {liveMatches.map(m => (
        <LiveFloatingButton key={m.id} match={m} onClick={handleClick} />
      ))}
    </div>
  )
}
