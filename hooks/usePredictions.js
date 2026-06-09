'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getStoredWriteToken, clearStoredWriteToken } from '../lib/sessionToken'
import { isPredPhaseEditable } from '../lib/phaseLock'
import { normalizeInicioKoPreds } from '../lib/knockoutBridge'
import { normalizePredictions } from '../lib/predictionMirror'

const AUTOSAVE_MS = 2000

function predictionsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function usePredictions({
  user,
  group,
  predPhase,
  tab,
  notify,
  setCurrentUser,
  isAdmin,
  adminOverride = false,
  knockoutMatches = [],
}) {
  const [groupPreds, setGroupPreds] = useState(user.predictions?.group || {})
  const [koPreds, setKoPreds] = useState(user.predictions?.knockout || {})
  const [inicioKoPreds, setInicioKoPreds] = useState(() =>
    normalizeInicioKoPreds(user.predictions?.inicioKnockout || {}),
  )
  const [bonusPreds, setBonusPreds] = useState(
    user.predictions?.bonuses || { topScorer: '', topKeeper: '', topAssists: '', mvp: '' }
  )
  const [savingManual, setSavingManual] = useState(false)
  const [saveStatus, setSaveStatus] = useState('saved')
  const skipAutoSave = useRef(true)
  const skipUserSync = useRef(false)
  const pendingRef = useRef(false)
  const saveInFlight = useRef(false)
  const debounceTimer = useRef(null)
  const predsRef = useRef({
    group: groupPreds,
    knockout: koPreds,
    inicioKnockout: inicioKoPreds,
    bonuses: bonusPreds,
  })

  predsRef.current = {
    group: groupPreds,
    knockout: koPreds,
    inicioKnockout: inicioKoPreds,
    bonuses: bonusPreds,
  }

  useEffect(() => {
    if (skipUserSync.current) {
      skipUserSync.current = false
      return
    }
    if (pendingRef.current || saveInFlight.current) return
    setGroupPreds(user.predictions?.group || {})
    setKoPreds(user.predictions?.knockout || {})
    setInicioKoPreds(normalizeInicioKoPreds(user.predictions?.inicioKnockout || {}))
    setBonusPreds(user.predictions?.bonuses || {
      topScorer: '', topKeeper: '', topAssists: '', mvp: '',
    })
    skipAutoSave.current = true
  }, [user.id, user.updated_at])

  const runSave = useCallback(async (manual = false) => {
    if (saveInFlight.current) {
      pendingRef.current = true
      return false
    }
    if (!isPredPhaseEditable(predPhase, group, isAdmin, adminOverride, { knockoutMatches })) {
      if (manual) notify('Esta fase no se puede editar', 'warning')
      return false
    }

    const predictions = predsRef.current
    saveInFlight.current = true
    if (manual) {
      setSavingManual(true)
      setSaveStatus('saving')
    } else {
      setSaveStatus('saving')
    }

    const token = getStoredWriteToken(group.id, user.id)
    let error = null

    async function saveViaSupabase() {
      const result = await supabase
        .from('porra_participants')
        .update({ predictions, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      return result.error
    }

    if (token) {
      const res = await fetch('/api/predictions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: group.id,
          userId: user.id,
          token,
          predictions,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 403) clearStoredWriteToken()
        const supaErr = await saveViaSupabase()
        if (supaErr) {
          error = { message: data.error || supaErr.message || 'Error al guardar' }
        }
      }
    } else {
      error = await saveViaSupabase()
    }

    saveInFlight.current = false

    if (error) {
      setSaveStatus('error')
      if (manual) notify('No se pudo guardar. Revisa tu conexión.', 'error')
      if (manual) setSavingManual(false)
      return false
    }

    const stillDirty = !predictionsEqual(predsRef.current, predictions)
    pendingRef.current = stillDirty

    skipUserSync.current = true
    setCurrentUser({ ...user, predictions, updated_at: new Date().toISOString() })

    if (stillDirty) {
      setSaveStatus('pending')
      debounceTimer.current = setTimeout(() => {
        debounceTimer.current = null
        void runSaveRef.current(false)
      }, 400)
    } else {
      setSaveStatus('saved')
      pendingRef.current = false
    }

    if (manual) {
      notify('Predicciones guardadas')
      setSavingManual(false)
    }
    return true
  }, [user, group, predPhase, isAdmin, adminOverride, notify, setCurrentUser])

  const runSaveRef = useRef(runSave)
  runSaveRef.current = runSave

  const scheduleAutoSave = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null
      void runSaveRef.current(false)
    }, AUTOSAVE_MS)
  }, [])

  const persistPredictions = useCallback(
    (manual = false) => runSave(manual),
    [runSave]
  )

  const flushSave = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
      debounceTimer.current = null
    }
    if (
      debounceTimer.current ||
      pendingRef.current ||
      saveStatus === 'pending' ||
      saveStatus === 'saving'
    ) {
      return runSaveRef.current(false)
    }
    return Promise.resolve(true)
  }, [saveStatus])

  useEffect(() => {
    if (skipAutoSave.current) {
      skipAutoSave.current = false
      return
    }
    if (tab !== 'predictions') return
    pendingRef.current = true
    setSaveStatus(prev => (prev === 'saving' ? 'saving' : 'pending'))
    scheduleAutoSave()
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [groupPreds, koPreds, inicioKoPreds, bonusPreds, tab, scheduleAutoSave])

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'hidden') flushSave()
    }
    function onBeforeUnload(e) {
      if (pendingRef.current && saveStatus !== 'saved') {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [flushSave, saveStatus])

  const importPredictions = useCallback(
    async (raw, manual = true) => {
      const norm = normalizePredictions(raw)
      setGroupPreds(norm.group)
      setKoPreds(norm.knockout)
      setInicioKoPreds(norm.inicioKnockout)
      setBonusPreds(norm.bonuses)
      predsRef.current = norm
      skipAutoSave.current = true
      pendingRef.current = true
      return runSave(manual)
    },
    [runSave],
  )

  return {
    groupPreds,
    setGroupPreds,
    koPreds,
    setKoPreds,
    inicioKoPreds,
    setInicioKoPreds,
    bonusPreds,
    setBonusPreds,
    saving: savingManual,
    saveStatus,
    persistPredictions,
    flushSave,
    importPredictions,
  }
}
