'use client'
import { useEffect, useState } from 'react'
import HomeScreen from '../components/HomeScreen'
import CreateScreen from '../components/CreateScreen'
import JoinScreen from '../components/JoinScreen'
import GroupDashboard from '../components/GroupDashboard'
import { supabase } from '../lib/supabase'

export default function Page() {
  const [screen, setScreen] = useState('loading')
  const [joinCode, setJoinCode] = useState('')
  const [currentGroup, setCurrentGroup] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [notification, setNotification] = useState(null)

  useEffect(() => {
    // Check URL for join code
    const hash = window.location.hash.replace('#', '')
    const params = new URLSearchParams(window.location.search)
    const code = params.get('join') || (hash.startsWith('join-') ? hash.replace('join-', '') : '')

    // Check localStorage for saved session
    const savedSession = localStorage.getItem('porra_session')
    if (savedSession) {
      try {
        const { groupId, userId } = JSON.parse(savedSession)
        if (code && code !== groupId) {
          // Different group - go to join
          setJoinCode(code)
          setScreen('join')
        } else {
          // Restore session
          restoreSession(groupId, userId)
          return
        }
      } catch { }
    }

    if (code) {
      setJoinCode(code)
      setScreen('join')
    } else {
      setScreen('home')
    }
  }, [])

  async function restoreSession(groupId, userId) {
    try {
      const { data: group } = await supabase
        .from('porra_groups')
        .select('*')
        .eq('id', groupId)
        .single()

      const { data: participants } = await supabase
        .from('porra_participants')
        .select('*')
        .eq('group_id', groupId)

      if (group && participants) {
        const groupWithParticipants = {
          ...group,
          participants: Object.fromEntries(participants.map(p => [p.id, p]))
        }
        const user = participants.find(p => p.id === userId)
        if (user) {
          setCurrentGroup(groupWithParticipants)
          setCurrentUser(user)
          setScreen('dashboard')
          return
        }
      }
    } catch { }
    setScreen('home')
  }

  function notify(msg, type = 'success') {
    setNotification({ msg, type })
    setTimeout(() => setNotification(null), 3500)
  }

  function saveSession(groupId, userId) {
    localStorage.setItem('porra_session', JSON.stringify({ groupId, userId }))
  }

  function clearSession() {
    localStorage.removeItem('porra_session')
    setCurrentGroup(null)
    setCurrentUser(null)
    setScreen('home')
  }

  async function refreshGroup(groupId) {
    const { data: group } = await supabase
      .from('porra_groups')
      .select('*')
      .eq('id', groupId)
      .single()

    const { data: participants } = await supabase
      .from('porra_participants')
      .select('*')
      .eq('group_id', groupId)

    if (group && participants) {
      const full = {
        ...group,
        participants: Object.fromEntries(participants.map(p => [p.id, p]))
      }
      setCurrentGroup(full)
      return full
    }
  }

  if (screen === 'loading') return <LoadingScreen />

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <BgDecor />
      {notification && <Notification {...notification} />}

      {screen === 'home' && (
        <HomeScreen
          setScreen={setScreen}
          setJoinCode={setJoinCode}
          notify={notify}
        />
      )}
      {screen === 'create' && (
        <CreateScreen
          setScreen={setScreen}
          notify={notify}
          onCreated={(group, user) => {
            setCurrentGroup(group)
            setCurrentUser(user)
            saveSession(group.id, user.id)
            setScreen('dashboard')
          }}
        />
      )}
      {screen === 'join' && (
        <JoinScreen
          initialCode={joinCode}
          setScreen={setScreen}
          notify={notify}
          onJoined={(group, user) => {
            setCurrentGroup(group)
            setCurrentUser(user)
            saveSession(group.id, user.id)
            setScreen('dashboard')
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
        />
      )}
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexDirection: 'column', gap: 16,
      background: 'var(--bg)'
    }}>
      <BgDecor />
      <div style={{ fontSize: 48 }}>⚽</div>
      <div style={{
        width: 32, height: 32, border: '3px solid var(--border)',
        borderTopColor: 'var(--accent)', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
    </div>
  )
}

function BgDecor() {
  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(rgba(249,115,22,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(249,115,22,0.03) 1px, transparent 1px)`,
        backgroundSize: '48px 48px'
      }} />
      <div style={{
        position: 'fixed', width: 700, height: 700, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(249,115,22,0.07) 0%, transparent 65%)',
        top: -250, right: -250, zIndex: 0, pointerEvents: 'none'
      }} />
      <div style={{
        position: 'fixed', width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 65%)',
        bottom: -150, left: -150, zIndex: 0, pointerEvents: 'none'
      }} />
    </>
  )
}

function Notification({ msg, type }) {
  return (
    <div style={{
      position: 'fixed', top: 20, right: 16, left: 16, zIndex: 9999,
      maxWidth: 400, margin: '0 auto',
      background: type === 'error' ? 'var(--red)' : type === 'warning' ? '#d97706' : 'var(--green)',
      color: 'white', padding: '14px 18px', borderRadius: 14,
      fontWeight: 700, fontSize: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      animation: 'slideDown 0.3s ease',
      display: 'flex', alignItems: 'center', gap: 8
    }}>
      {type === 'error' ? '⚠️' : type === 'warning' ? '⏰' : '✅'} {msg}
    </div>
  )
}
