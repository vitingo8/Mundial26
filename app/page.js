'use client'
import { useEffect, useState } from 'react'
import HomeScreen from '../components/HomeScreen'
import { CreateScreen, JoinScreen } from '../components/CreateScreen'
import GroupDashboard from '../components/GroupDashboard'
import { supabase } from '../lib/supabase'
import { createWriteToken } from '../lib/sessionToken'
import { Icon } from '../components/icons'

export default function Page() {
  const [screen, setScreen] = useState('loading')
  const [joinCode, setJoinCode] = useState('')
  const [joinEmail, setJoinEmail] = useState('')
  const [joinNewUser, setJoinNewUser] = useState(false)
  const [resumeUserId, setResumeUserId] = useState(null)
  const [resumeCandidates, setResumeCandidates] = useState(null)
  const [currentGroup, setCurrentGroup] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [notification, setNotification] = useState(null)

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    const params = new URLSearchParams(window.location.search)
    const code = params.get('join') || (hash.startsWith('join-') ? hash.replace('join-', '') : '')
    const userParam = params.get('user')
    const screenParam = params.get('screen')

    async function init() {
      const atHome = typeof window !== 'undefined' && sessionStorage.getItem('porra_at_home')
      const savedSession = localStorage.getItem('porra_session')
      if (savedSession && !atHome) {
        try {
          const { groupId, userId } = JSON.parse(savedSession)
          if (code && code !== groupId) {
            setJoinCode(code)
            setJoinEmail('')
            setJoinNewUser(false)
            setResumeUserId(userParam || null)
            setScreen('join')
            return
          }
          if (userParam && userParam !== userId) {
            const ok = await restoreSession(groupId, userParam)
            if (ok) return
          }
          const ok = await restoreSession(groupId, userId)
          if (ok) return
        } catch { /* ignore */ }
      }

      if (code && userParam) {
        setJoinCode(code)
        setJoinEmail('')
        setJoinNewUser(false)
        setResumeUserId(userParam)
        setScreen('join')
        return
      }

      if (code) {
        const participants = await loadParticipants(code.toLowerCase().trim())
        if (participants?.length) {
          setJoinCode(code)
          setResumeCandidates({ groupId: code.toLowerCase().trim(), participants })
          setScreen('resume')
          return
        }
        setJoinCode(code)
        setJoinEmail('')
        setJoinNewUser(false)
        setScreen('join')
        return
      }

      if (screenParam === 'create') setScreen('create')
      else if (screenParam === 'recover') setScreen('home')
      else setScreen('home')
    }

    init()
  }, [])

  async function loadParticipants(groupId) {
    const { data } = await supabase.from('porra_participants').select('id,name,is_admin').eq('group_id', groupId)
    return data
  }

  async function restoreSession(groupId, userId) {
    try {
      const { data: group } = await supabase.from('porra_groups').select('*').eq('id', groupId).single()
      const { data: participants } = await supabase
        .from('porra_participants')
        .select('*')
        .eq('group_id', groupId)

      if (group && participants) {
        const user = participants.find(p => p.id === userId)
        if (user) {
          if (typeof window !== 'undefined') sessionStorage.removeItem('porra_at_home')
          setCurrentGroup({
            ...group,
            participants: Object.fromEntries(participants.map(p => [p.id, p])),
          })
          setCurrentUser(user)
          setScreen('dashboard')
          return true
        }
      }
    } catch { /* ignore */ }
    return false
  }

  function notify(msg, type = 'success') {
    setNotification({ msg, type })
    setTimeout(() => setNotification(null), 3500)
  }

  function saveSession(groupId, userId) {
    localStorage.setItem('porra_session', JSON.stringify({ groupId, userId }))
  }

  function goToHome() {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('porra_at_home', '1')
    }
    setCurrentGroup(null)
    setCurrentUser(null)
    setScreen('home')
  }

  function clearSession() {
    if (typeof window !== 'undefined' && !window.confirm(
      '¿Salir del grupo? Tu porra sigue guardada. Vuelve entrando tu email en inicio.'
    )) return
    localStorage.removeItem('porra_session')
    if (typeof window !== 'undefined') sessionStorage.removeItem('porra_at_home')
    setCurrentGroup(null)
    setCurrentUser(null)
    setScreen('home')
  }

  function enterDashboard(group, user) {
    if (typeof window !== 'undefined') sessionStorage.removeItem('porra_at_home')
    setCurrentGroup(group)
    setCurrentUser(user)
    setScreen('dashboard')
  }

  async function switchGroup(groupId, userId) {
    saveSession(groupId, userId)
    const ok = await restoreSession(groupId, userId)
    if (ok) {
      await createWriteToken(groupId, userId)
      notify('Grupo cambiado')
    } else {
      notify('No se pudo cambiar de grupo', 'error')
    }
  }

  async function refreshGroup(groupId) {
    const { data: group } = await supabase.from('porra_groups').select('*').eq('id', groupId).single()
    const { data: participants } = await supabase
      .from('porra_participants')
      .select('*')
      .eq('group_id', groupId)

    if (group && participants) {
      const full = {
        ...group,
        participants: Object.fromEntries(participants.map(p => [p.id, p])),
      }
      setCurrentGroup(full)
      return full
    }
  }

  if (screen === 'loading') return <LoadingScreen />

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      {notification && <Notification {...notification} />}

      {screen === 'home' && (
        <HomeScreen
          setScreen={setScreen}
          setJoinCode={setJoinCode}
          setJoinEmail={setJoinEmail}
          setJoinNewUser={setJoinNewUser}
          notify={notify}
          onRecovered={async (groupId, userId) => {
            saveSession(groupId, userId)
            const ok = await restoreSession(groupId, userId)
            if (ok) await createWriteToken(groupId, userId)
            else notify('No se pudo entrar', 'error')
          }}
        />
      )}
      {screen === 'create' && (
        <CreateScreen
          setScreen={setScreen}
          notify={notify}
          onCreated={async (group, user) => {
            saveSession(group.id, user.id)
            await createWriteToken(group.id, user.id)
            enterDashboard(group, user)
          }}
        />
      )}
      {screen === 'resume' && resumeCandidates && (
        <ResumeScreen
          groupId={resumeCandidates.groupId}
          participants={resumeCandidates.participants}
          onPick={async userId => {
            saveSession(resumeCandidates.groupId, userId)
            const ok = await restoreSession(resumeCandidates.groupId, userId)
            if (ok) await createWriteToken(resumeCandidates.groupId, userId)
            if (!ok) {
              notify('No se pudo restaurar la sesión', 'error')
              setJoinCode(resumeCandidates.groupId)
              setJoinEmail('')
              setJoinNewUser(false)
              setScreen('join')
            }
          }}
          onNew={() => {
            setJoinCode(resumeCandidates.groupId)
            setJoinEmail('')
            setJoinNewUser(false)
            setScreen('join')
          }}
          onBack={() => setScreen('home')}
        />
      )}
      {screen === 'join' && (
        <JoinScreen
          initialCode={joinCode}
          initialEmail={joinEmail}
          isNewParticipant={joinNewUser}
          resumeUserId={resumeUserId}
          setScreen={setScreen}
          notify={notify}
          onJoined={async (group, user) => {
            saveSession(group.id, user.id)
            await createWriteToken(group.id, user.id)
            setResumeUserId(null)
            setJoinEmail('')
            setJoinNewUser(false)
            enterDashboard(group, user)
          }}
        />
      )}
      {screen === 'dashboard' && currentGroup && currentUser && (
        <GroupDashboard
          group={currentGroup}
          user={currentUser}
          refreshGroup={refreshGroup}
          setCurrentUser={setCurrentUser}
          notify={notify}
          onLeave={clearSession}
          onGoHome={goToHome}
          onSwitchGroup={switchGroup}
        />
      )}
    </div>
  )
}

function ResumeScreen({ groupId, participants, onPick, onNew, onBack }) {
  return (
    <div style={{
      maxWidth: 480, margin: '0 auto', padding: '40px 16px',
      position: 'relative', zIndex: 1,
    }}>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', textAlign: 'left' }}>← Volver</button>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>¿Continuar como…?</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
          Elige tu nombre en el grupo <strong>#{groupId}</strong>
        </p>
        {participants.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p.id)}
            style={{
              background: 'var(--white)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '12px 16px', cursor: 'pointer',
              textAlign: 'left', fontWeight: 700, fontSize: 15,
              boxShadow: 'var(--card-shadow)',
            }}
          >
            {p.name}{p.is_admin ? ' · Organizador' : ''}
          </button>
        ))}
        <button type="button" onClick={onNew} style={{
          background: 'var(--white)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '12px 16px', cursor: 'pointer', color: 'var(--muted)',
        }}>
          Soy nuevo en este grupo →
        </button>
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexDirection: 'column', gap: 16,
      position: 'relative', zIndex: 1,
    }}>
      <img src="/logo-wc26.png" alt="" width={120} height={120} style={{ opacity: 0.95 }} aria-hidden="true" />
      <div style={{
        width: 32, height: 32, border: '3px solid var(--border)',
        borderTopColor: 'var(--accent)', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span className="sr-only">Cargando…</span>
    </div>
  )
}

function Notification({ msg, type }) {
  const iconName = type === 'error' ? 'exclamationTriangle' : type === 'warning' ? 'clock' : 'checkCircle'
  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed', top: 20, right: 16, left: 16, zIndex: 9999,
        maxWidth: 400, margin: '0 auto',
        background: type === 'error' ? 'var(--red)' : type === 'warning' ? 'var(--warning)' : 'var(--green)',
        color: 'white', padding: '14px 18px', borderRadius: 14,
        fontWeight: 700, fontSize: 14, boxShadow: 'var(--shadow-soft)',
        animation: 'slideDown 0.3s ease',
        display: 'flex', alignItems: 'center', gap: 8,
      }}
    >
      <Icon name={iconName} size="md" style={{ color: 'white' }} /> {msg}
    </div>
  )
}
