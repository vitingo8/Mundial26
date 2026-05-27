'use client'

import { useEffect } from 'react'
import LeagueLogo from './LeagueLogo'
import { ParticipantAvatar } from './ParticipantDisplay'
import { Icon } from './icons'

export default function ProfileMenuSheet({
  open,
  onClose,
  user,
  currentGroupId,
  groups = [],
  onOpenProfile,
  onSwitchGroup,
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const sorted = [...groups].sort((a, b) => {
    if (a.group_id === currentGroupId) return -1
    if (b.group_id === currentGroupId) return 1
    return (a.groupName || '').localeCompare(b.groupName || '', 'es')
  })

  return (
    <div
      className="install-app-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-menu-title"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="install-app-sheet profile-menu-sheet">
        <button
          type="button"
          className="install-app-close"
          aria-label="Cerrar"
          onClick={onClose}
        >
          ×
        </button>

        <div className="profile-menu-head">
          <ParticipantAvatar participant={user} size={48} />
          <div className="profile-menu-head-text">
            <h2 id="profile-menu-title" className="install-app-title profile-menu-title">
              {user.team_name?.trim() || user.name}
            </h2>
            {user.team_name?.trim() && (
              <span className="profile-menu-subname">{user.name}</span>
            )}
          </div>
        </div>

        <p className="profile-menu-hint">
          Elige un grupo o abre tu perfil para cambiar escudo y nombre de equipo.
        </p>

        <ul className="profile-menu-groups">
          {sorted.map(g => {
            const isCurrent = g.group_id === currentGroupId
            return (
              <li key={g.id}>
                <button
                  type="button"
                  className={`profile-menu-group-btn${isCurrent ? ' profile-menu-group-btn--current' : ''}`}
                  disabled={isCurrent}
                  onClick={() => {
                    if (isCurrent) return
                    onClose()
                    onSwitchGroup?.(g.group_id, g.id)
                  }}
                >
                  <LeagueLogo
                    src={g.league_logo}
                    name={g.groupName}
                    size={40}
                    placeholder
                  />
                  <span className="profile-menu-group-body">
                    <strong>{g.groupName}</strong>
                    <span>
                      {isCurrent ? 'Grupo actual' : `Como ${g.name}`}
                      {!isCurrent && g.participantCount > 0 && (
                        <> · {g.participantCount} {g.participantCount === 1 ? 'jugador' : 'jugadores'}</>
                      )}
                    </span>
                  </span>
                  {!isCurrent && (
                    <span className="profile-menu-group-go" aria-hidden>
                      <Icon name="chevronRight" size="sm" />
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>

        <button
          type="button"
          className="profile-menu-profile-btn"
          onClick={() => {
            onClose()
            onOpenProfile()
          }}
        >
          <Icon name="user" size="sm" />
          Mi perfil
        </button>
      </div>
    </div>
  )
}
