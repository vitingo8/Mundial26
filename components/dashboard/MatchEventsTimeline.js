'use client'

import { Icon, goalIconName } from '../icons'
import { formatEventMinute } from '../../lib/matchDetail'

function formatScoreLabel(score) {
  if (!score || score.home == null || score.away == null) return null
  return `${score.home} - ${score.away}`
}

function EventPlayerAvatar({ photoUrl, name, card, onClick, playerId }) {
  if (!photoUrl) return null
  const cardClass = card === 'RED'
    ? ' match-events-avatar--red'
    : card === 'YELLOW'
      ? ' match-events-avatar--yellow'
      : ''
  const clickable = typeof onClick === 'function' && playerId != null
  const img = (
    <img src={photoUrl} alt={name || ''} loading="lazy" />
  )

  if (clickable) {
    return (
      <button
        type="button"
        className={`match-events-avatar match-events-avatar--clickable${cardClass}`}
        onClick={() => onClick({ id: playerId, name })}
        aria-label={name ? `Ver ficha de ${name}` : 'Ver ficha del jugador'}
      >
        {img}
      </button>
    )
  }

  return (
    <span className={`match-events-avatar${cardClass}`}>
      {img}
    </span>
  )
}

function EventPlayerName({ name, playerId, onPlayerClick, className = 'match-events-primary' }) {
  const clickable = typeof onPlayerClick === 'function' && playerId != null && name
  if (!name) return null
  if (clickable) {
    return (
      <button
        type="button"
        className={`${className} match-events-name-btn`}
        onClick={() => onPlayerClick({ id: playerId, name })}
      >
        <strong>{name}</strong>
      </button>
    )
  }
  return (
    <p className={className}>
      <strong>{name}</strong>
    </p>
  )
}

function EventGoalContent({ item, side, onPlayerClick }) {
  const scoreLabel = formatScoreLabel(item.score)
  return (
    <div className={`match-events-event match-events-event--goal match-events-event--${side}`}>
      {side === 'away' && (
        <span className="match-events-icon match-events-icon--goal" aria-hidden="true">
          <Icon name={goalIconName(item.goalType)} size={16} />
        </span>
      )}
      <EventPlayerAvatar
        photoUrl={item.photoUrl}
        name={item.playerName}
        playerId={item.playerId}
        onClick={onPlayerClick}
      />
      <div className="match-events-event-body">
        <EventPlayerName
          name={item.playerName}
          playerId={item.playerId}
          onPlayerClick={onPlayerClick}
        />
        {scoreLabel && (
          <p className="match-events-score-inline">({scoreLabel})</p>
        )}
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

function SubPlayerLine({ player, direction, onPlayerClick }) {
  if (!player?.name) return null
  const clickable = typeof onPlayerClick === 'function' && player.id != null
  const className = direction === 'in' ? 'match-events-sub-in' : 'match-events-sub-out'
  const inner = (
    <>
      {player.photoUrl && (
        <EventPlayerAvatar
          photoUrl={player.photoUrl}
          name={player.name}
          playerId={player.id}
          onClick={onPlayerClick}
        />
      )}
      <span>
        {player.shirtNumber != null && `${player.shirtNumber} `}
        {player.name}
      </span>
    </>
  )

  if (clickable) {
    return (
      <button
        type="button"
        className={`${className} match-events-sub-player--clickable`}
        onClick={() => onPlayerClick(player)}
        aria-label={`Ver ficha de ${player.name}`}
      >
        {inner}
      </button>
    )
  }

  return <p className={className}>{inner}</p>
}

function EventSubContent({ item, side, onPlayerClick }) {
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
        <SubPlayerLine player={item.playerIn} direction="in" onPlayerClick={onPlayerClick} />
        <SubPlayerLine player={item.playerOut} direction="out" onPlayerClick={onPlayerClick} />
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

function EventCardContent({ item, side, onPlayerClick }) {
  const isRed = item.card === 'RED'
  return (
    <div className={`match-events-event match-events-event--card match-events-event--${side}`}>
      {side === 'away' && (
        <span
          className={`match-events-card-dot${isRed ? ' match-events-card-dot--red' : ' match-events-card-dot--yellow'}`}
          aria-hidden="true"
        />
      )}
      <EventPlayerAvatar
        photoUrl={item.photoUrl}
        name={item.playerName}
        card={item.card}
        playerId={item.playerId}
        onClick={onPlayerClick}
      />
      <EventPlayerName
        name={item.playerName}
        playerId={item.playerId}
        onPlayerClick={onPlayerClick}
        className="match-events-primary match-events-primary--inline"
      />
      {side === 'home' && (
        <span
          className={`match-events-card-dot${isRed ? ' match-events-card-dot--red' : ' match-events-card-dot--yellow'}`}
          aria-hidden="true"
        />
      )}
    </div>
  )
}

function EventPenaltyShootoutContent({ item, side, onPlayerClick }) {
  const scoreLabel = formatScoreLabel(item.penScore)
  const scored = item.outcome === 'scored'
  return (
    <div className={`match-events-event match-events-event--pen match-events-event--${side}`}>
      {side === 'away' && (
        <span
          className={`match-events-pen-dot${scored ? ' match-events-pen-dot--scored' : ' match-events-pen-dot--missed'}`}
          aria-hidden="true"
        >
          {scored ? '●' : '✕'}
        </span>
      )}
      <EventPlayerAvatar
        photoUrl={item.photoUrl}
        name={item.playerName}
        playerId={item.playerId}
        onClick={onPlayerClick}
      />
      <div className="match-events-event-body">
        <EventPlayerName
          name={item.playerName}
          playerId={item.playerId}
          onPlayerClick={onPlayerClick}
        />
        {scoreLabel && (
          <p className="match-events-score-inline">({scoreLabel})</p>
        )}
        {item.subtext && (
          <p className="match-events-sub">{item.subtext}</p>
        )}
      </div>
      {side === 'home' && (
        <span
          className={`match-events-pen-dot${scored ? ' match-events-pen-dot--scored' : ' match-events-pen-dot--missed'}`}
          aria-hidden="true"
        >
          {scored ? '●' : '✕'}
        </span>
      )}
    </div>
  )
}

function EventSideContent({ item, onPlayerClick }) {
  if (item.isHome == null) return null
  const side = item.isHome ? 'home' : 'away'
  if (item.kind === 'goal') return <EventGoalContent item={item} side={side} onPlayerClick={onPlayerClick} />
  if (item.kind === 'penShootout') {
    return <EventPenaltyShootoutContent item={item} side={side} onPlayerClick={onPlayerClick} />
  }
  if (item.kind === 'sub') return <EventSubContent item={item} side={side} onPlayerClick={onPlayerClick} />
  if (item.kind === 'card') return <EventCardContent item={item} side={side} onPlayerClick={onPlayerClick} />
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

  if (item.kind === 'half' || item.kind === 'penShootoutHeader') {
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

export default function MatchEventsTimeline({ items, onPlayerClick }) {
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
          if (item.kind === 'half' || item.kind === 'addedTime' || item.kind === 'penShootoutHeader') {
            return <CenterMarkerRow key={item.id} item={item} />
          }

          const minuteLabel = formatEventMinute(item.minute, item.injuryTime)
          return (
            <li key={item.id} className="match-events-row">
              <div className="match-events-col match-events-col--home">
                {item.isHome === true && <EventSideContent item={item} onPlayerClick={onPlayerClick} />}
              </div>
              <div className="match-events-col match-events-col--time">
                {minuteLabel !== '—' && item.kind !== 'penShootout' && (
                  <span className="match-events-minute">{minuteLabel}</span>
                )}
              </div>
              <div className="match-events-col match-events-col--away">
                {item.isHome === false && <EventSideContent item={item} onPlayerClick={onPlayerClick} />}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
