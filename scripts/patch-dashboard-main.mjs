import fs from 'fs'

let c = fs.readFileSync('components/GroupDashboard.js', 'utf8')

const oldMainStart = 'export default function GroupDashboard'
const oldMainEnd = '// ─── GROUP TAB ────────────────────────────────────────────────────────────────'

const idxStart = c.indexOf(oldMainStart)
const idxEnd = c.indexOf(oldMainEnd)
if (idxStart < 0 || idxEnd < 0) {
  console.error('markers not found')
  process.exit(1)
}

const newMain = `export default function GroupDashboard({ group, user, refreshGroup, setCurrentUser, notify, onLeave }) {
  const [tab, setTab] = useState('group')
  const [predPhase, setPredPhase] = useState('group')
  const [adminOverride, setAdminOverride] = useState(false)
  const [scrollToMatchId, setScrollToMatchId] = useState(null)
  const [liveData, setLiveData] = useState([])
  const [apiStatus, setApiStatus] = useState('idle')
  const [apiError, setApiError] = useState(null)
  const [currentGroup, setCurrentGroup] = useState(group)
  const matchRefs = useRef({})

  const { wcMatches, setWcMatches, wcLoading, reload: reloadWc } = useWcMatches()
  const groupMatches = useMemo(() => transformGroupMatches(wcMatches), [wcMatches])
  const knockoutMatches = useMemo(() => transformKnockoutMatches(wcMatches), [wcMatches])
  const isAdmin = user.is_admin

  const {
    groupPreds, setGroupPreds, koPreds, setKoPreds, bonusPreds, setBonusPreds,
    saving, saveStatus, persistPredictions, flushSave,
  } = usePredictions({
    user, group: currentGroup, predPhase, tab, notify, setCurrentUser, isAdmin, adminOverride,
  })

  const orphanGroupKeys = useMemo(() => countOrphanPredKeys(groupPreds, groupMatches), [groupPreds, groupMatches])
  const leaderboard = calcLeaderboard(currentGroup)
  const groupDeadlinePassed = isDeadlinePassed(currentGroup.group_deadline)
  const koDeadlinePassed = isDeadlinePassed(currentGroup.knockout_deadline)
  const bonusDeadlinePassed = isDeadlinePassed(currentGroup.bonus_deadline)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const shareUrl = \`\${origin}?join=\${currentGroup.id}\`
  const personalUrl = \`\${origin}?join=\${currentGroup.id}&user=\${user.id}\`
  const teamOptions = useMemo(() => getUniqueTeamsFromMatches(groupMatches, knockoutMatches), [groupMatches, knockoutMatches])
  const adminBadges = isAdmin ? getAdminTaskBadges(currentGroup, groupMatches, knockoutMatches) : []

  async function handleRefresh() {
    const updated = await refreshGroup(currentGroup.id)
    if (updated) {
      setCurrentGroup(updated)
      const u = updated.participants?.[user.id]
      if (u) setCurrentUser(u)
    }
  }

  useEffect(() => { const t = setInterval(handleRefresh, 60000); return () => clearInterval(t) }, [currentGroup.id])
  useEffect(() => { setPredPhase(getDefaultPredPhase(currentGroup.phase)) }, [currentGroup.phase])

  useEffect(() => {
    if (!groupMatches.length) return
    const { migrated: g } = migratePredictionMap(user.predictions?.group || {}, groupMatches)
    const { migrated: k } = migratePredictionMap(user.predictions?.knockout || {}, knockoutMatches)
    setGroupPreds(g)
    setKoPreds(k)
  }, [groupMatches.length, knockoutMatches.length])

  useEffect(() => {
    if (tab === 'live' && apiStatus === 'idle' && wcMatches.length > 0) { setLiveData(wcMatches); setApiStatus('ok') }
  }, [tab, wcMatches, apiStatus])

  useEffect(() => {
    if (!scrollToMatchId || tab !== 'predictions') return
    const el = matchRefs.current[scrollToMatchId]
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setScrollToMatchId(null) }
  }, [scrollToMatchId, tab, predPhase])

  async function changeTab(next) {
    if (tab === 'predictions' && next !== 'predictions') await flushSave()
    setTab(next)
  }

  function goToPrediction(matchId) {
    setScrollToMatchId(String(matchId))
    if (groupMatches.find(x => String(x.id) === String(matchId))) setPredPhase('group')
    else if (knockoutMatches.find(x => String(x.id) === String(matchId))) setPredPhase('knockout')
    setTab('predictions')
  }

  async function savePredictions() { await persistPredictions(true) }

  function copyLink(text, msg = '📋 Enlace copiado') {
    navigator.clipboard.writeText(text).then(() => notify(msg))
  }

  async function shareInvite() {
    const text = \`¡Únete a la porra "\${currentGroup.name}" del Mundial 2026!\\n\${shareUrl}\`
    if (navigator.share) {
      try { await navigator.share({ title: 'Porra Mundial 2026', text, url: shareUrl }); return } catch (e) { if (e.name === 'AbortError') return }
    }
    copyLink(text)
  }

  async function fetchLive() {
    setApiStatus('loading'); setApiError(null)
    try { const raw = await reloadWc(); setLiveData(raw); setApiStatus('ok') }
    catch (e) { setApiStatus('unavailable'); setApiError(e.message) }
  }

  const tabs = [
    { id: 'group', icon: '👥', label: 'Grupo' },
    { id: 'predictions', icon: '🎯', label: 'Porra' },
    { id: 'leaderboard', icon: '🏆', label: 'Ranking' },
    { id: 'live', icon: '🔴', label: 'En Vivo' },
    ...(isAdmin ? [{ id: 'admin', icon: '⚙️', label: 'Organización' }] : []),
  ]

  return (
    <div style={s.root}>
      <div style={{ ...s.header, paddingTop: 'max(14px, var(--safe-top))' }}>
        <div style={s.headerTop}>
          <div>
            <div style={s.groupName}>{currentGroup.name}</div>
            <div style={s.groupMeta}>
              <span style={s.codeTag}>#{currentGroup.id}</span>
              <span style={s.userTag}>👤 {user.name}</span>
            </div>
          </div>
          <div style={s.headerActions}>
            <button type="button" style={s.shareBtn} onClick={shareInvite} aria-label="Compartir">📤</button>
            <button type="button" style={s.shareBtn} onClick={() => copyLink(shareUrl)} aria-label="Copiar">📋</button>
          </div>
        </div>
        <div style={s.personalLinkBanner}>
          <span style={{ fontSize: 11, color: 'var(--muted)', flex: 1 }}>Tu enlace personal:</span>
          <button type="button" style={s.personalLinkBtn} onClick={() => copyLink(personalUrl, '🔗 Enlace copiado')}>Copiar</button>
        </div>
        {(currentGroup.group_deadline || currentGroup.knockout_deadline) && (
          <div style={s.deadlines}>
            {currentGroup.group_deadline && <DeadlineBadge label="Grupos" deadline={currentGroup.group_deadline} passed={groupDeadlinePassed} />}
            {currentGroup.knockout_deadline && <DeadlineBadge label="Eliminatorias" deadline={currentGroup.knockout_deadline} passed={koDeadlinePassed} />}
          </div>
        )}
        {isAdmin && adminBadges.length > 0 && (
          <div style={s.adminBadgesRow}>{adminBadges.map((b, i) => (
            <span key={i} style={{ ...s.adminBadge, ...(b.type === 'warn' ? s.adminBadgeWarn : {}) }}>{b.text}</span>
          ))}</div>
        )}
        <div className="tab-bar-desktop" style={s.tabBar}>
          {tabs.map(t => (
            <button key={t.id} type="button" aria-label={t.label} aria-selected={tab === t.id}
              className="tab-btn-touch" style={{ ...s.tabBtn, ...(tab === t.id ? s.tabActive : {}) }}
              onClick={() => changeTab(t.id)}>
              <span aria-hidden="true">{t.icon}</span>
              <span style={s.tabLabel}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="dashboard-content app-container app-container--wide" style={s.content}>
        {tab === 'group' && <GroupTab group={currentGroup} leaderboard={leaderboard} shareUrl={shareUrl} personalUrl={personalUrl} onShare={shareInvite} onLeave={onLeave} currentUserId={user.id} />}
        {tab === 'predictions' && (
          <PredictionsTab predPhase={predPhase} setPredPhase={setPredPhase} groupPreds={groupPreds} setGroupPreds={setGroupPreds}
            koPreds={koPreds} setKoPreds={setKoPreds} bonusPreds={bonusPreds} setBonusPreds={setBonusPreds}
            saving={saving} saveStatus={saveStatus} onSave={savePredictions}
            groupDeadlinePassed={groupDeadlinePassed} koDeadlinePassed={koDeadlinePassed} bonusDeadlinePassed={bonusDeadlinePassed}
            groupMatches={groupMatches} knockoutMatches={knockoutMatches} teamOptions={teamOptions.length ? teamOptions : ALL_TEAMS}
            wcLoading={wcLoading} groupPhase={currentGroup.phase} isAdmin={isAdmin} adminOverride={adminOverride} setAdminOverride={setAdminOverride}
            orphanGroupKeys={orphanGroupKeys} matchRefs={matchRefs}
            deadlines={{ group: currentGroup.group_deadline, knockout: currentGroup.knockout_deadline, bonus: currentGroup.bonus_deadline }} />
        )}
        {tab === 'leaderboard' && <LeaderboardTab leaderboard={leaderboard} user={user} group={currentGroup} groupMatches={groupMatches} knockoutMatches={knockoutMatches} onRefresh={handleRefresh} />}
        {tab === 'live' && <LiveTab liveData={liveData} apiStatus={apiStatus} apiError={apiError} onFetch={fetchLive} wcLoading={wcLoading} group={currentGroup} groupMatches={groupMatches} userPreds={user.predictions} onGoToPrediction={goToPrediction} />}
        {tab === 'admin' && isAdmin && <AdminTab group={currentGroup} setGroup={setCurrentGroup} refreshGroup={refreshGroup} notify={notify} groupMatches={groupMatches} knockoutMatches={knockoutMatches} wcMatches={wcMatches} userId={user.id} />}
      </div>
      {tab === 'predictions' && (
        <button type="button" className="save-fab save-fab--visible" onClick={savePredictions} aria-label="Guardar">💾 Guardar</button>
      )}
      <nav className="bottom-nav" aria-label="Navegación">
        {tabs.map(t => (
          <button key={t.id} type="button" className="bottom-nav-btn" aria-label={t.label} aria-selected={tab === t.id} onClick={() => changeTab(t.id)}>
            <span aria-hidden="true" style={{ fontSize: 18 }}>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

`

c = c.slice(0, idxStart) + newMain + c.slice(idxEnd)

// PredictionsTab extras
c = c.replace(
  'groupMatches, knockoutMatches, teamOptions, wcLoading, groupPhase, deadlines,\n}) {',
  `groupMatches, knockoutMatches, teamOptions, wcLoading, groupPhase, deadlines,
  isAdmin, adminOverride, setAdminOverride, orphanGroupKeys, matchRefs,
}) {
  const phaseLocked = isPhaseLocked(groupPhase, predPhase, isAdmin, adminOverride)
  const phaseLockMsg = getPhaseLockMessage(groupPhase, predPhase)
  const deadlineKey = predPhase === 'group' ? 'group' : predPhase === 'knockout' ? 'knockout' : 'bonus'
  const countdown = formatCountdown(msUntilDeadline(deadlines[deadlineKey]))
`
)

c = c.replace(
  '{locked && <div style={s.lockedBanner}>🔒 Plazo cerrado · Solo lectura</div>}',
  '{(locked || phaseLocked) && <div style={s.lockedBanner}>🔒 {phaseLockMsg || \'Plazo cerrado · Solo lectura\'}</div>}'
)

// only first occurrence in GroupPhasePreds - need phaseLocked passed
c = c.replace(
  '<GroupPhasePreds preds={groupPreds} setPreds={setGroupPreds} locked={groupDeadlinePassed} matches={groupMatches} />',
  '<GroupPhasePreds preds={groupPreds} setPreds={setGroupPreds} locked={groupDeadlinePassed || phaseLocked} matches={groupMatches} matchRefs={matchRefs} />'
)
c = c.replace(
  '<KnockoutPreds preds={koPreds} setPreds={setKoPreds} locked={koDeadlinePassed} matches={knockoutMatches} teamOptions={teamOptions} />',
  '<KnockoutPreds preds={koPreds} setPreds={setKoPreds} locked={koDeadlinePassed || phaseLocked} matches={knockoutMatches} teamOptions={teamOptions} matchRefs={matchRefs} />'
)

c = c.replace(
  '{countdown && (\n        <span key={i.label}',
  '{countdown && predPhase === deadlineKey && (\n        <span style={{ color: \'var(--yellow)\', fontWeight: 700 }}>Cierra en: {countdown}</span>\n      )}\n      {isAdmin && (\n        <label style={{ fontSize: 11, display: \'flex\', alignItems: \'center\', gap: 6 }}>\n          <input type="checkbox" checked={adminOverride} onChange={e => setAdminOverride(e.target.checked)} />\n          Modo organizador: editar fases cerradas\n        </label>\n      )}\n      {orphanGroupKeys > 0 && (\n        <div style={{ ...s.lockedBanner, borderColor: \'var(--yellow-border)\', color: \'var(--yellow)\' }}>\n          {orphanGroupKeys} predicción(es) con ID antiguo — se migrarán al guardar.\n        </div>\n      )}\n      {false && countdown && (\n        <span key={i.label}'
)

// GroupPhasePreds matchRefs
c = c.replace(
  'function GroupPhasePreds({ preds, setPreds, locked, matches = [] }) {',
  'function GroupPhasePreds({ preds, setPreds, locked, matches = [], matchRefs }) {'
)
c = c.replace(
  '<MatchRow\n                key={m.id}',
  `<MatchRow\n                key={m.id}\n                matchRef={el => { if (matchRefs) matchRefs.current[m.id] = el }}`
)

// Admin tab sync + csv
const adminInject = `
  const [csvPaste, setCsvPaste] = useState('')
  async function syncFromApi() {
    const { group: g, knockout: k } = finishedMatchesToResults(wcMatches)
    setResults(r => ({ ...r, group: { ...r.group, ...g }, knockout: { ...r.knockout, ...k } }))
    notify('Resultados finalizados importados de la API', 'success')
  }
  function applyCsv() {
    const parsed = parseResultsPaste(csvPaste, groupMatches)
    setResults(r => ({ ...r, group: { ...r.group, ...parsed } }))
    notify(\`Importados \${Object.keys(parsed).length} resultados\`, 'success')
  }
  async function saveGroupSecure(updates) {
    const token = getStoredWriteToken(group.id, userId)
    if (token) {
      const res = await fetch('/api/groups', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: group.id, userId, token, updates }) })
      if (!res.ok) { notify('Error al guardar', 'error'); return false }
      notify('Guardado'); const g = await refreshGroup(group.id); if (g) setGroup(g); return true
    }
    const { error } = await supabase.from('porra_groups').update(updates).eq('id', group.id)
    if (error) notify('Error', 'error'); else { notify('Guardado'); const g = await refreshGroup(group.id); if (g) setGroup(g) }
    return !error
  }
`
if (!c.includes('syncFromApi')) {
  c = c.replace(
    'function AdminTab({ group, setGroup, refreshGroup, notify, groupMatches = [], knockoutMatches = [] }) {',
    `function AdminTab({ group, setGroup, refreshGroup, notify, groupMatches = [], knockoutMatches = [], wcMatches = [], userId }) {${adminInject}`
  )
  c = c.replace(
    `async function saveDeadlines() {
    setSaving(true)
    const { error } = await supabase.from('porra_groups').update({
      group_deadline: groupDeadline || null,
      knockout_deadline: koDeadline || null,
      bonus_deadline: bonusDeadline || null,
      phase: tournamentPhase,
    }).eq('id', group.id)
    if (error) notify('Error: ' + error.message, 'error')
    else { notify('✅ Plazos guardados'); const g = await refreshGroup(group.id); if (g) setGroup(g) }
    setSaving(false)
  }`,
    `async function saveDeadlines() {
    setSaving(true)
    await saveGroupSecure({
      group_deadline: groupDeadline || null,
      knockout_deadline: koDeadline || null,
      bonus_deadline: bonusDeadline || null,
      phase: tournamentPhase,
    })
    setSaving(false)
  }`
  )
  c = c.replace(
    '<div style={s.adminNote}>\n            Resultados fase de grupos',
    `<button type="button" style={{ ...s.saveBtn, marginBottom: 8 }} onClick={syncFromApi}>🔄 Importar finalizados desde API</button>
          <textarea className="csvArea input-touch" style={s.csvArea} placeholder="Pegar CSV: id,local,visitante o local,visitante,gl,gv"
            value={csvPaste} onChange={e => setCsvPaste(e.target.value)} />
          <button type="button" style={s.inviteShareBtn} onClick={applyCsv}>Importar pegado</button>
          <div style={s.adminNote}>\n            Resultados fase de grupos`
  )
}

// Leaderboard show all breakdown items including misses
c = c.replace(
  'if (raw === 0) return',
  '/* include zero */'
)
c = c.replace(
  'breakdown.map(item => (',
  'breakdown.filter(Boolean).map(item => ('
)
c = c.replace(
  '<div style={{ ...s.pointsDetail,',
  '<div style={{ ...s.pointsDetail, opacity: item.hit ? 1 : 0.75,'
)

fs.writeFileSync('components/GroupDashboard.js', c)
console.log('main patched')
