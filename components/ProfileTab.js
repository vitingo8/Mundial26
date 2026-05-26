'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { getStoredWriteToken } from '../lib/sessionToken'
import { resizeLogoFile } from '../lib/participantProfile'
import { ParticipantAvatar } from './ParticipantDisplay'
import PredictionMirrorPanel from './PredictionMirrorPanel'
import { Icon } from './icons'

export default function ProfileTab({
  user,
  groupId,
  currentPredictions,
  onSaved,
  notify,
  onApplyMirror,
  onSwitchGroup,
}) {
  const [teamName, setTeamName] = useState(user.team_name || '')
  const [logo, setLogo] = useState(user.team_logo || '')
  const [saving, setSaving] = useState(false)

  async function handleLogoChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const dataUrl = await resizeLogoFile(file)
      setLogo(dataUrl)
    } catch (err) {
      notify(err.message || 'Error al procesar la imagen', 'error')
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      groupId,
      userId: user.id,
      token: getStoredWriteToken(groupId, user.id),
      team_name: teamName.trim(),
      team_logo: logo || null,
    }
    try {
      if (payload.token) {
        const res = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'No se pudo guardar')
      } else {
        const { error } = await supabase
          .from('porra_participants')
          .update({
            team_name: payload.team_name || null,
            team_logo: payload.team_logo,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
        if (error) throw error
      }
      onSaved({
        ...user,
        team_name: payload.team_name || null,
        team_logo: payload.team_logo,
      })
      notify('Perfil guardado', 'success')
    } catch (err) {
      notify(err.message || 'Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const previewParticipant = {
    ...user,
    team_name: teamName.trim() || null,
    team_logo: logo || null,
  }

  return (
    <div className="dash-tab-panel profile-tab">
      <h2 className="profile-tab-title">
        <Icon name="user" size="md" />
        Mi perfil
      </h2>
      <p className="profile-tab-hint">
        Tu nombre de equipo y escudo aparecen en el ranking y en las tablas. Tu nombre real queda debajo en texto más suave.
      </p>

      <form className="profile-form dash-card" onSubmit={handleSave}>
        <div className="profile-preview">
          <ParticipantAvatar participant={previewParticipant} size={72} />
          <div className="profile-preview-text">
            {teamName.trim() ? (
              <>
                <strong>{teamName.trim()}</strong>
                <span>{user.name}</span>
              </>
            ) : (
              <strong>{user.name}</strong>
            )}
          </div>
        </div>

        <label className="profile-field">
          <span className="profile-label">Nombre de tu equipo</span>
          <input
            className="profile-input input-touch"
            type="text"
            maxLength={48}
            placeholder="Ej. Los Cracks FC"
            value={teamName}
            onChange={ev => setTeamName(ev.target.value)}
          />
        </label>

        <div className="profile-field">
          <span className="profile-label">Escudo / logo</span>
          <div className="profile-logo-actions">
            <label className="profile-upload-btn">
              <input type="file" accept="image/*" onChange={handleLogoChange} hidden />
              {logo ? 'Cambiar imagen' : 'Subir imagen'}
            </label>
            {logo && (
              <button type="button" className="profile-remove-logo" onClick={() => setLogo('')}>
                Quitar logo
              </button>
            )}
          </div>
          <p className="profile-field-hint">JPG o PNG, máx. 2 MB. Se redimensiona automáticamente.</p>
        </div>

        <div className="profile-readonly">
          <span className="profile-label">Tu nombre</span>
          <span className="profile-readonly-value">{user.name}</span>
        </div>
        <div className="profile-readonly">
          <span className="profile-label">Email</span>
          <span className="profile-readonly-value">{user.email}</span>
        </div>

        <button type="submit" className="profile-save-btn" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar perfil'}
        </button>
      </form>

      {onApplyMirror && (
        <PredictionMirrorPanel
          user={user}
          currentGroupId={groupId}
          currentPredictions={currentPredictions}
          onApplyToCurrent={onApplyMirror}
          onSwitchGroup={onSwitchGroup}
          notify={notify}
        />
      )}
    </div>
  )
}
