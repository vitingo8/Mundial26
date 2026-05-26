'use client'

/** Avatar: logo del equipo o inicial del nombre */
export function ParticipantAvatar({ participant, size = 36 }) {
  const logo = participant?.team_logo
  const label =
    (participant?.team_name || participant?.name || '?').trim()[0]?.toUpperCase() || '?'

  if (logo) {
    return (
      <img
        src={logo}
        alt=""
        className="participant-avatar participant-avatar--img"
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className="participant-avatar participant-avatar--initial"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-hidden="true"
    >
      {label}
    </div>
  )
}

/** Nombre de equipo (negrita) + persona (suave); si no hay equipo, solo el nombre */
export default function ParticipantDisplay({
  participant,
  isYou = false,
  showAdmin = false,
  compact = false,
  showAvatar = false,
  avatarSize = 36,
}) {
  if (!participant) return null

  const teamName = participant.team_name?.trim()
  const personName = participant.name || ''

  return (
    <div className={`participant-display${compact ? ' participant-display--compact' : ''}`}>
      {showAvatar && <ParticipantAvatar participant={participant} size={avatarSize} />}
      <div className="participant-display-text">
        {teamName ? (
          <>
            <div className="participant-team-name">{teamName}</div>
            <div className="participant-person-name">{personName}</div>
          </>
        ) : (
          <div className="participant-team-name">{personName}</div>
        )}
        {(isYou || (showAdmin && participant.is_admin)) && (
          <div className="participant-display-tags">
            {isYou && <span className="dash-tag dash-tag--you">Tú</span>}
            {showAdmin && participant.is_admin && (
              <span className="dash-tag dash-tag--admin">{compact ? 'Org' : 'Organizador'}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function participantPrimaryLabel(participant) {
  return participant?.team_name?.trim() || participant?.name || ''
}
