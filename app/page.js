'use client'
import { useEffect, useLayoutEffect, useState } from 'react'
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
  saveDashboardCache,
} from '../lib/dashboardSessionCache'
import { F, perfAsync, perfMark, perfWhenInteractive } from '../lib/startupPerf'

export default function Page() {
  const [screen, setScreen] = useState('home')
  const [joinCode, setJoinCode] = useState('')
  const [joinEmail, setJoinEmail] = useState('')
  const [joinNewUser, setJoinNewUser] = useState(false)
  const [currentGroup, setCurrentGroup] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [notification, setNotification] = useState(null)
  const [clientReady, setClientReady] = useState(false)

  useLayoutEffect(() => {
    perfMark(F.PAGE, 'Leyendo URL y sessionStorage')
    const hash = window.location.hash.replace('#', '')
    const params = new URLSearchParams(window.location.search)
    const code = params.get('join') || (hash.startsWith('join-') ? hash.replace('join-', '') : '')

    if (code) {
      setJoinCode(code)
      setJoinEmail(getSavedEmail())
      setJoinNewUser(false)
      setScreen('join')
      setClientReady(true)
      return
    }

    const screenParam = params.get('screen')
    if (screenParam === 'create') {
      setScreen('create')
      setClientReady(true)
      return
    }
    if (screenParam === 'recover') {
      setScreen('home')
      setClientReady(true)
      return
    }

    const session = readStoredSession()
    if (session) {
      const cached = readInitialDashboardState()
      if (cached.group && cached.user) {
        perfMark(F.SESSION, 'Caché local del dashboard — HIT', {
          groupId: cached.group.id,
          participantes: Object.keys(cached.group.participants || {}).length,
        })
        setCurrentGroup(cached.group)
        setCurrentUser(cached.user)
      } else {
        perfMark(F.SESSION, 'Sesión guardada pero sin caché de dashboard', { groupId: session.groupId })
      }
      setScreen('dashboard')
    }

    setClientReady(true)
    perfMark(F.PAGE, 'Cliente listo para renderizar', {
      destino: session ? 'dashboard' : (code ? 'join' : screenParam || 'home'),
    })
  }, [])

  useEffect(() => {
    if (!clientReady) return

    const hash = window.location.hash.replace('#', '')
    const params = new URLSearchParams(window.location.search)
    const code = params.get('join') || (hash.startsWith('join-') ? hash.replace('join-', '') : '')

    async function init() {
      perfMark(F.PAGE, 'init() — comprobando sesión en segundo paso')
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
        const cached = readDashboardCache(groupId, userId)
        if (cached?.group && cached?.user) {
          perfMark(F.SESSION, 'Refresco Supabase en background (UI ya tiene caché)')
          void restoreSession(groupId, userId)
          return
        }
        perfMark(F.SESSION, 'Sin caché local — esperando Supabase antes de mostrar dashboard')
        const ok = await restoreSession(groupId, userId)
        if (ok) return
        setScreen('home')
        return
      }

      if (code) return

      const screenParam = params.get('screen')
      if (screenParam === 'create' || screenParam === 'recover') return
      if (screen !== 'join') setScreen('home')
    }

    void init()
  }, [clientReady])

  async function restoreSession(groupId, userId) {
    return perfAsync(F.SUPABASE, 'Restaurar sesión (porra_groups + participants)', async () => {
      try {
        const t0 = performance.now()
        const { data: group } = await supabase.from('porra_groups').select('*').eq('id', groupId).single()
        const tGroup = Math.round(performance.now() - t0)
        const t1 = performance.now()
        const { data: participants } = await supabase
          .from('porra_participants')
          .select('*')
          .eq('group_id', groupId)
        const tParticipants = Math.round(performance.now() - t1)

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
            perfMark(F.SUPABASE, 'Queries Supabase completadas', {
              porra_groups_ms: tGroup,
              participants_ms: tParticipants,
              participantes: participants.length,
            })
            return true
          }
        }
      } catch (err) {
        perfMark(F.SUPABASE, 'Error restaurando sesión', { error: String(err?.message || err) })
      }
      return false
    })
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

  if (!clientReady) {
    return (
      <div style={{ minHeight: '100vh', position: 'relative' }}>
        <DashboardRestoring />
      </div>
    )
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
          onMounted={() => perfWhenInteractive(F.DASHBOARD, 'Dashboard montado en DOM', {
            grupo: currentGroup?.id,
            usuario: currentUser?.id,
          })}
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
