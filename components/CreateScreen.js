'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { uid } from '../lib/gameData'

// ─── SHARED UI ────────────────────────────────────────────────────────────────
function FormCard({ children, title, onBack }) {
  return (
    <div style={s.root}>
      <div style={s.card} className="animate-in">
        <button style={s.back} onClick={onBack}>← Volver</button>
        <h2 style={s.title}>{title}</h2>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={s.field}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  )
}

function Input(props) {
  return <input style={s.input} {...props} />
}

function Btn({ children, loading, ...props }) {
  return (
    <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} disabled={loading} {...props}>
      {loading ? <span style={s.spinner} /> : null}
      {children}
    </button>
  )
}

// ─── CREATE SCREEN ────────────────────────────────────────────────────────────
export function CreateScreen({ setScreen, notify, onCreated }) {
  const [groupName, setGroupName] = useState('')
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!groupName.trim()) { notify('Introduce el nombre del grupo', 'error'); return }
    if (!userName.trim()) { notify('Introduce tu nombre', 'error'); return }
    setLoading(true)
    try {
      const groupId = uid()
      const adminId = uid()

      // Create group
      const { error: gErr } = await supabase.from('porra_groups').insert({
        id: groupId,
        name: groupName.trim(),
        admin_id: adminId,
        phase: 'group',
        actuals: {},
        results: { group: {}, knockout: {} },
      })
      if (gErr) throw gErr

      // Create admin participant
      const { error: pErr } = await supabase.from('porra_participants').insert({
        id: adminId,
        group_id: groupId,
        name: userName.trim(),
        email: userEmail.trim() || null,
        is_admin: true,
        predictions: { group: {}, knockout: {}, bonuses: {} },
      })
      if (pErr) throw pErr

      const group = {
        id: groupId, name: groupName.trim(), admin_id: adminId,
        phase: 'group', actuals: {}, results: { group: {}, knockout: {} },
        group_deadline: null, knockout_deadline: null,
        participants: {
          [adminId]: {
            id: adminId, group_id: groupId, name: userName.trim(),
            email: userEmail.trim() || null, is_admin: true,
            predictions: { group: {}, knockout: {}, bonuses: {} }
          }
        }
      }
      notify(`¡Grupo "${groupName}" creado!`)
      onCreated(group, group.participants[adminId])
    } catch (e) {
      notify('Error creando grupo: ' + e.message, 'error')
    }
    setLoading(false)
  }

  return (
    <FormCard title="✨ Crear Grupo" onBack={() => setScreen('home')}>
      <Field label="Nombre del grupo">
        <Input placeholder="Ej: Los Cracks del Trabajo" value={groupName} onChange={e => setGroupName(e.target.value)} />
      </Field>
      <Field label="Tu nombre">
        <Input placeholder="Tu nombre o apodo" value={userName} onChange={e => setUserName(e.target.value)} />
      </Field>
      <Field label="Tu email (opcional)">
        <Input type="email" placeholder="Para identificarte" value={userEmail} onChange={e => setUserEmail(e.target.value)} />
      </Field>
      <Btn loading={loading} onClick={handleCreate}>
        Crear y entrar como Admin →
      </Btn>
      <p style={s.hint}>Se generará un código único para invitar a otros participantes</p>
    </FormCard>
  )
}

// ─── JOIN SCREEN ──────────────────────────────────────────────────────────────
export function JoinScreen({ initialCode = '', setScreen, notify, onJoined }) {
  const [code, setCode] = useState(initialCode.toUpperCase())
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [groupPreview, setGroupPreview] = useState(null)
  const [checking, setChecking] = useState(false)

  async function checkCode(val) {
    const c = val.toLowerCase().trim()
    if (c.length < 6) { setGroupPreview(null); return }
    setChecking(true)
    const { data } = await supabase.from('porra_groups').select('id,name,phase').eq('id', c).single()
    setGroupPreview(data || false)
    setChecking(false)
  }

  async function handleJoin() {
    if (!code.trim()) { notify('Introduce el código', 'error'); return }
    if (!userName.trim()) { notify('Introduce tu nombre', 'error'); return }
    setLoading(true)
    try {
      const groupId = code.toLowerCase().trim()
      const { data: group } = await supabase.from('porra_groups').select('*').eq('id', groupId).single()
      if (!group) { notify('Código no encontrado', 'error'); setLoading(false); return }

      const userId = uid()
      const { error } = await supabase.from('porra_participants').insert({
        id: userId,
        group_id: groupId,
        name: userName.trim(),
        email: userEmail.trim() || null,
        is_admin: false,
        predictions: { group: {}, knockout: {}, bonuses: {} },
      })
      if (error) throw error

      const { data: participants } = await supabase.from('porra_participants').select('*').eq('group_id', groupId)
      const full = {
        ...group,
        participants: Object.fromEntries(participants.map(p => [p.id, p]))
      }
      notify(`¡Te has unido a "${group.name}"!`)
      onJoined(full, full.participants[userId])
    } catch (e) {
      notify('Error uniéndote: ' + e.message, 'error')
    }
    setLoading(false)
  }

  return (
    <FormCard title="🔗 Unirse al Grupo" onBack={() => setScreen('home')}>
      <Field label="Código del grupo">
        <Input
          placeholder="Código de 7 caracteres"
          value={code}
          style={{ ...s.input, textTransform: 'uppercase', letterSpacing: 3 }}
          onChange={e => { setCode(e.target.value.toUpperCase()); checkCode(e.target.value) }}
          autoCapitalize="none" autoCorrect="off"
        />
        {checking && <div style={s.checking}>Buscando grupo...</div>}
        {groupPreview && (
          <div style={s.preview}>
            ✅ Grupo encontrado: <strong>{groupPreview.name}</strong>
          </div>
        )}
        {groupPreview === false && code.length >= 6 && (
          <div style={s.previewErr}>⚠️ Código no encontrado</div>
        )}
      </Field>
      <Field label="Tu nombre">
        <Input placeholder="Tu nombre o apodo" value={userName} onChange={e => setUserName(e.target.value)} />
      </Field>
      <Field label="Tu email (opcional)">
        <Input type="email" placeholder="Para identificarte" value={userEmail} onChange={e => setUserEmail(e.target.value)} />
      </Field>
      <Btn loading={loading} onClick={handleJoin}>
        Unirme al grupo →
      </Btn>
    </FormCard>
  )
}

export default CreateScreen

const s = {
  root: {
    maxWidth: 480, margin: '0 auto', padding: '20px 16px 40px',
    position: 'relative', zIndex: 1, minHeight: '100vh',
    display: 'flex', alignItems: 'flex-start', paddingTop: 40
  },
  card: {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 20, padding: '28px 24px', width: '100%',
    display: 'flex', flexDirection: 'column', gap: 18
  },
  back: {
    background: 'transparent', border: 'none', color: 'var(--muted)',
    cursor: 'pointer', fontSize: 14, textAlign: 'left', padding: 0, fontWeight: 600
  },
  title: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 28, fontWeight: 900, color: 'var(--text)', margin: 0
  },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, color: 'var(--muted)', fontWeight: 600, letterSpacing: 0.3 },
  input: {
    background: 'var(--bg)', border: '1.5px solid var(--border)',
    borderRadius: 12, padding: '13px 14px', color: 'var(--text)',
    fontSize: 15, outline: 'none', width: '100%',
  },
  btn: {
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    color: 'white', border: 'none', borderRadius: 14, padding: '15px 24px',
    fontSize: 16, fontWeight: 700, cursor: 'pointer', width: '100%',
    boxShadow: '0 4px 24px var(--accent-glow)', marginTop: 4,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5
  },
  spinner: {
    width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.3)',
    borderTopColor: 'white', borderRadius: '50%',
    animation: 'spin 0.7s linear infinite', display: 'inline-block'
  },
  hint: { fontSize: 12, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.5 },
  checking: { fontSize: 12, color: 'var(--muted)', marginTop: 4 },
  preview: {
    fontSize: 13, color: 'var(--green)', marginTop: 4,
    background: 'rgba(16,185,129,0.08)', borderRadius: 8, padding: '6px 10px'
  },
  previewErr: {
    fontSize: 13, color: 'var(--red)', marginTop: 4,
    background: 'rgba(239,68,68,0.08)', borderRadius: 8, padding: '6px 10px'
  }
}
