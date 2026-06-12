'use client'

import { Icon, goalIconName } from '../icons'
import { formatEventMinute } from '../../lib/matchDetail'

function formatScoreLabel(score) {
  if (!score || score.home == null || score.away == null) return null
  return `${score.home} - ${score.away}`
}

function EventPlayerAvatar({ photoUrl, name, card }) {
  if (!photoUrl) return null
  const cardClass = card === 'RED'
    ? ' match-events-avatar--red'
    : card === 'YELLOW'
      ? ' match-events-avatar--yellow'
      : ''
  return (
    <span className={`match-events-avatar${cardClass}`}>
      <img src={photoUrl} alt={name || ''} loading="lazy" />
    </span>
  )
}

function EventGoalContent({ item, side }) {
  const scoreLabel = formatScoreLabel(item.score)
  return (
    <div className={`match-events-event match-events-event--goal match-events-event--${side}`}>
      {side === 'away' && (
        <span className="match-events-icon match-events-icon--goal" aria-hidden="true">
          <Icon name={goalIconName(item.goalType)} size={16} />
        </span>
      )}
      <EventPlayerAvatar photoUrl={item.photoUrl} name={item.playerName} />
      <div className="match-events-event-body">
        <p className="match-events-primary">
          <strong>{item.playerName}</strong>
          {scoreLabel && <span className="match-events-score"> ({scoreLabel})</span>}
        </p>
        {item.subtext && (
          <p className="match-events-sub">{item.subtext}</p>
        )}
      </div>
      {side === 'home' && (
        <span className="match-events-icon match-events-icon--goal" aria-hidden="true">
          <Icon name={goalIconName(item.goalType)} size={16} />
        </span>
      )}
    </div>
  )
}

function EventSubContent({ item, side }) {
  return (
    <div className={`match-events-event match-events-event--sub match-events-event--${side}`}>
      {side === 'away' && (
        <span className="match-events-icon match-events-icon--sub" aria-hidden="true">
          <span className="match-events-sub-arrows">
            <span className="match-events-sub-arrow match-events-sub-arrow--in">↗</span>
            <span className="match-events-sub-arrow match-events-sub-arrow--out">↙</span>
          </span>
        </span>
      )}
      <div className="match-events-event-body">
        {item.playerIn && (
          <p className="match-events-sub-in">{item.playerIn}</p>
        )}
        {item.playerOut && (
          <p className="match-events-sub-out">{item.playerOut}</p>
        )}
      </div>
      {side === 'home' && (
        <span className="match-events-icon match-events-icon--sub" aria-hidden="true">
          <span className="match-events-sub-arrows">
            <span className="match-events-sub-arrow match-events-sub-arrow--in">↗</span>
            <span className="match-events-sub-arrow match-events-sub-arrow--out">↙</span>
          </span>
        </span>
      )}
    </div>
  )
}

function EventCardContent({ item, side }) {
  const isRed = item.card === 'RED'
  return (
    <div className={`match-events-event match-events-event--card match-events-event--${side}`}>
      {side === 'away' && (
        <span
          className={`match-events-card-dot${isRed ? ' match-events-card-dot--red' : ' match-events-card-dot--yellow'}`}
          aria-hidden="true"
        />
      )}
      <EventPlayerAvatar photoUrl={item.photoUrl} name={item.playerName} card={item.card} />
      <p className="match-events-primary">
        <strong>{item.playerName}</strong>
      </p>
      {side === 'home' && (
        <span
          className={`match-events-card-dot${isRed ? ' match-events-card-dot--red' : ' match-events-card-dot--yellow'}`}
          aria-hidden="true"
        />
      )}
    </div>
  )
}

function EventSideContent({ item }) {
  if (item.isHome == null) return null
  const side = item.isHome ? 'home' : 'away'
  if (item.kind === 'goal') return <EventGoalContent item={item} side={side} />
  if (item.kind === 'sub') return <EventSubContent item={item} side={side} />
  if (item.kind === 'card') return <EventCardContent item={item} side={side} />
  return null
}

function CenterMarkerRow({ item }) {
  if (item.kind === 'addedTime') {
    return (
      <li className="match-events-row match-events-row--marker">
        <p className="match-events-added">{item.label}</p>
      </li>
    )
  }

  if (item.kind === 'half') {
    return (
      <li className="match-events-row match-events-row--marker">
        <div className="match-events-half">
          <span className="match-events-half-line" aria-hidden="true" />
          <span className="match-events-half-label">{item.label}</span>
          <span className="match-events-half-line" aria-hidden="true" />
        </div>
      </li>
    )
  }

  return null
}

export default function MatchEventsTimeline({ items }) {
  if (!items.length) {
    return (
      <p className="match-detail-hint">
        Sin eventos todavía. Aparecerán cuando el partido comience.
      </p>
    )
  }

  return (
    <section className="match-detail-section match-detail-section--events">
      <ul className="match-events-list">
        {items.map(item => {
          if (item.kind === 'half' || item.kind === 'addedTime') {
            return <CenterMarkerRow key={item.id} item={item} />
          }

          const minuteLabel = formatEventMinute(item.minute, item.injuryTime)
          return (
            <li key={item.id} className="match-events-row">
              <div className="match-events-col match-events-col--home">
                {item.isHome === true && <EventSideContent item={item} />}
              </div>
              <div className="match-events-col match-events-col--time">
                {minuteLabel !== '—' && (
                  <span className="match-events-minute">{minuteLabel}</span>
                )}
              </div>
              <div className="match-events-col match-events-col--away">
                {item.isHome === false && <EventSideContent item={item} />}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
