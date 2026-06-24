'use client'
import { useEffect, useState } from 'react'
import HomeScreen from '../components/HomeScreen'
import { CreateScreen, JoinScreen } from '../components/CreateScreen'
import GroupDashboard from '../components/GroupDashboard'
import { supabase } from '../lib/supabase'
import { createWriteToken } from '../lib/sessionToken'
import { getSavedEmail } from '../lib/savedEmail'
import { Icon } from '../components/icons'
import {
  readDashboardCache,
  readInitialDashboardState,
  readStoredSession,
  resolveInitialScreen,
  saveDashboardCache,
} from '../lib/dashboardSessionCache'

export default function Page() {
  const initialDash = readInitialDashboardState()
  const [screen, setScreen] = useState(resolveInitialScreen)
  const [joinCode, setJoinCode] = useState('')
  const [joinEmail, setJoinEmail] = useState('')
  const [joinNewUser, setJoinNewUser] = useState(false)
  const [currentGroup, setCurrentGroup] = useState(initialDash.group)
  const [currentUser, setCurrentUser] = useState(initialDash.user)
  const [notification, setNotification] = useState(null)

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    const params = new URLSearchParams(window.location.search)
    const code = params.get('join') || (hash.startsWith('join-') ? hash.replace('join-', '') : '')

    async function init() {
      const session = readStoredSession()

      if (session) {
        const { groupId, userId } = session
        if (code && code !== groupId) {
          setJoinCode(code)
          setJoinEmail(getSavedEmail())
          setJoinNewUser(false)
          setScreen('join')
          return
        }
        const ok = await restoreSession(groupId, userId)
        if (ok) return
        if (!readDashboardCache(groupId, userId)) setScreen('home')
        return
      }

      if (code) {
        setJoinCode(code)
        setJoinEmail(getSavedEmail())
        setJoinNewUser(false)
        setScreen('join')
        return
      }

      const screenParam = params.get('screen')
      if (screenParam === 'create') setScreen('create')
      else if (screenParam === 'recover') setScreen('home')
      else if (screen !== 'join') setScreen('home')
    }

    void init()
  }, [])

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
          const fullGroup = {
            ...group,
            participants: Object.fromEntries(participants.map(p => [p.id, p])),
          }
          setCurrentGroup(fullGroup)
          setCurrentUser(user)
          saveDashboardCache(fullGroup, user)
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
    saveDashboardCache(group, user)
    setScreen('dashboard')
  }

  async function switchGroup(groupId, userId) {
    const ok = await restoreSession(groupId, userId)
    if (!ok) {
      notify('No se pudo cambiar de grupo', 'error')
      return
    }
    saveSession(groupId, userId)
    try {
      await createWriteToken(groupId, userId)
    } catch { /* reload aunque falle el token; init lo reintenta */ }
    if (typeof window !== 'undefined') {
      window.location.reload()
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
      if (currentUser) saveDashboardCache(full, currentUser)
      return full
    }
  }

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
      {screen === 'join' && (
        <JoinScreen
          initialCode={joinCode}
          initialEmail={joinEmail}
          isNewParticipant={joinNewUser}
          setScreen={setScreen}
          notify={notify}
          onJoined={async (group, user) => {
            saveSession(group.id, user.id)
            await createWriteToken(group.id, user.id)
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
      {screen === 'dashboard' && (!currentGroup || !currentUser) && (
        <DashboardRestoring />
      )}
    </div>
  )
}

function DashboardRestoring() {
  return (
    <div className="app-splash" aria-busy="true" aria-label="Cargando">
      <img
        src="/logo-wc26.png"
        alt="FIFA World Cup 2026"
        className="app-splash-logo"
        width={200}
        height={200}
      />
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
