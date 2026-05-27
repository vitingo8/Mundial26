'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { uid } from '../lib/gameData'
import { hashPin, normalizeName } from '../lib/pinUtils'
import { normalizeEmail, isValidEmail } from '../lib/emailUtils'
import { getSavedEmail, saveEmail } from '../lib/savedEmail'
import { getDefaultGroupDeadline, getDefaultBonusDeadline } from '../lib/deadlines'
import { InputRow, InputActionRow, inputRowStyles } from './InputRow'
import { Icon } from './icons'

function FormCard({ children, title, icon, onBack, showLogo }) {
  return (
    <div style={s.root}>
      <div style={s.card} className="animate-in">
        <button type="button" style={s.back} onClick={onBack}>← Volver</button>
        {showLogo && (
          <img
            src="/logo-wc26.png"
            alt="FIFA World Cup 2026"
            style={s.logo}
            width={120}
            height={120}
          />
        )}
        <h2 className="form-card-title" style={{ ...s.title, ...(showLogo ? { textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 } : { display: 'flex', alignItems: 'center', gap: 8 }) }}>
          {icon && <Icon name={icon} />}
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children, htmlFor }) {
  return (
    <div style={s.field}>
      <label style={s.label} htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  )
}

export function Input({ id, className = '', uppercase, style, ...props }) {
  return <InputRow id={id} className={className} uppercase={uppercase} style={style} {...props} />
}

export function Btn({ children, loading, ...props }) {
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
  const [userEmail, setUserEmail] = useState(() => getSavedEmail())
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!groupName.trim()) { notify('Introduce el nombre del grupo', 'error'); return }
    if (!userName.trim()) { notify('Introduce tu nombre', 'error'); return }
    if (!userEmail.trim()) { notify('Introduce tu email', 'error'); return }
    if (!isValidEmail(userEmail)) { notify('Introduce un email válido', 'error'); return }
    if (pin && pin.length < 4) { notify('El PIN debe tener al menos 4 dígitos', 'error'); return }
    const email = normalizeEmail(userEmail)
    saveEmail(email)
    setLoading(true)
    try {
      const groupId = uid()
      const adminId = uid()
      const pin_hash = await hashPin(pin)

      const defaultGroupDeadline = getDefaultGroupDeadline()
      const defaultBonusDeadline = getDefaultBonusDeadline()
      const { error: gErr } = await supabase.from('porra_groups').insert({
        id: groupId,
        name: groupName.trim(),
        admin_id: adminId,
        phase: 'group',
        group_deadline: defaultGroupDeadline,
        knockout_deadline: null,
        bonus_deadline: defaultBonusDeadline,
        actuals: {},
        results: { group: {}, knockout: {} },
      })
      if (gErr) throw gErr

      const { error: pErr } = await supabase.from('porra_participants').insert({
        id: adminId,
        group_id: groupId,
        name: userName.trim(),
        email,
        is_admin: true,
        pin_hash,
        predictions: { group: {}, knockout: {}, bonuses: {} },
      })
      if (pErr) throw pErr

      const group = {
        id: groupId,
        name: groupName.trim(),
        admin_id: adminId,
        phase: 'group',
        actuals: {},
        results: { group: {}, knockout: {} },
        group_deadline: defaultGroupDeadline,
        knockout_deadline: null,
        bonus_deadline: defaultBonusDeadline,
        participants: {
          [adminId]: {
            id: adminId,
            group_id: groupId,
            name: userName.trim(),
            email,
            is_admin: true,
            predictions: { group: {}, knockout: {}, bonuses: {} },
          },
        },
      }
      notify(`¡Grupo "${groupName}" creado!`)
      onCreated(group, group.participants[adminId])
    } catch (e) {
      notify('No se pudo crear el grupo. Inténtalo de nuevo.', 'error')
    }
    setLoading(false)
  }

  return (
    <FormCard icon="sparkles" title="Crear grupo" onBack={() => setScreen('home')}>
      <Field label="Nombre del grupo" htmlFor="create-group">
        <Input id="create-group" placeholder="Ej: Los cracks del trabajo" value={groupName} onChange={e => setGroupName(e.target.value)} />
      </Field>
      <Field label="Tu email" htmlFor="create-email">
        <Input id="create-email" type="email" autoComplete="email" placeholder="tu@email.com" value={userEmail} onChange={e => setUserEmail(e.target.value)} />
      </Field>
      <Field label="Tu nombre" htmlFor="create-name">
        <Input id="create-name" placeholder="Tu nombre o apodo" value={userName} onChange={e => setUserName(e.target.value)} />
      </Field>
      <Field label="PIN opcional (4–6 dígitos)" htmlFor="create-pin">
        <Input id="create-pin" type="password" inputMode="numeric" maxLength={6} placeholder="Protección extra al volver" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
      </Field>
      <p style={s.hint}>Tu email sirve para recuperar la cuenta si cambias de dispositivo.</p>
      <Btn loading={loading} onClick={handleCreate}>
        Crear y entrar como organizador →
      </Btn>
      <p style={s.hint}>Se generará un código único para invitar al grupo</p>
    </FormCard>
  )
}

// ─── JOIN SCREEN ──────────────────────────────────────────────────────────────
export function JoinScreen({
  initialCode = '',
  initialEmail = '',
  isNewParticipant = false,
  setScreen,
  notify,
  onJoined,
}) {
  const lockedEmail = initialEmail ? normalizeEmail(initialEmail) : ''
  const [code, setCode] = useState(initialCode.toUpperCase())
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState(lockedEmail || getSavedEmail())
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [groupPreview, setGroupPreview] = useState(null)
  const [checking, setChecking] = useState(false)
  const [existingMatch, setExistingMatch] = useState(null)
  const [step, setStep] = useState(() => {
    if (isNewParticipant && lockedEmail) return 'profile'
    if (initialCode && !lockedEmail) return 'email'
    if (initialCode && lockedEmail) return 'email'
    return 'profile'
  })

  async function checkCode(val) {
    const c = val.toLowerCase().trim()
    if (c.length < 6) { setGroupPreview(null); return }
    setChecking(true)
    const { data } = await supabase.from('porra_groups').select('id,name,phase').eq('id', c).single()
    setGroupPreview(data || false)
    setChecking(false)
  }

  async function findParticipantByEmail(groupId, email) {
    const { data: participants } = await supabase
      .from('porra_participants')
      .select('*')
      .eq('group_id', groupId)
    return (participants || []).find(
      p => p.email && normalizeEmail(p.email) === email
    )
  }

  async function backfillEmail(participant, email) {
    if (participant.email) return participant
    await supabase.from('porra_participants').update({ email }).eq('id', participant.id)
    return { ...participant, email }
  }

  async function loadGroupWithParticipants(groupId) {
    const { data: group } = await supabase.from('porra_groups').select('*').eq('id', groupId).single()
    const { data: participants } = await supabase.from('porra_participants').select('*').eq('group_id', groupId)
    return {
      ...group,
      participants: Object.fromEntries((participants || []).map(p => [p.id, p])),
    }
  }

  async function finishJoin(user) {
    const full = await loadGroupWithParticipants(user.group_id)
    notify(`¡Bienvenido de nuevo, ${user.name}!`)
    onJoined(full, full.participants[user.id])
  }

  useEffect(() => {
    if (initialCode) setCode(initialCode.toUpperCase())
  }, [initialCode])

  useEffect(() => {
    if (lockedEmail) setUserEmail(lockedEmail)
  }, [lockedEmail])

  async function handleEmailStep() {
    if (!userEmail.trim()) { notify('Introduce tu email', 'error'); return }
    if (!isValidEmail(userEmail)) { notify('Introduce un email válido', 'error'); return }
    const email = normalizeEmail(userEmail)
    saveEmail(email)
    const groupId = (initialCode || code).toLowerCase().trim()
    if (!groupId) {
      setStep('profile')
      return
    }
    setLoading(true)
    try {
      let existing = await findParticipantByEmail(groupId, email)
      if (existing?.pin_hash) {
        setExistingMatch(existing)
        setStep('pin')
        setLoading(false)
        return
      }
      if (existing) {
        await finishJoin(await backfillEmail(existing, email))
        setLoading(false)
        return
      }
      setUserEmail(email)
      setStep('profile')
    } catch {
      notify('No se pudo verificar el email', 'error')
    }
    setLoading(false)
  }

  function handleProfileContinue() {
    if (!userName.trim()) { notify('Introduce tu nombre', 'error'); return }
    if (pin && pin.length > 0 && pin.length < 4) {
      notify('El PIN debe tener al menos 4 dígitos', 'error')
      return
    }
    setStep('code')
    if (initialCode) checkCode(initialCode)
  }

  async function handleJoin() {
    if (!code.trim()) { notify('Introduce el código', 'error'); return }
    const email = lockedEmail || normalizeEmail(userEmail)
    saveEmail(email)
    if (!email) { notify('Introduce tu email', 'error'); return }
    if (!userName.trim()) { notify('Introduce tu nombre', 'error'); return }
    setLoading(true)
    try {
      const groupId = code.toLowerCase().trim()
      const { data: group } = await supabase.from('porra_groups').select('*').eq('id', groupId).single()
      if (!group) {
        notify('Código no encontrado', 'error')
        setLoading(false)
        return
      }

      let existing = await findParticipantByEmail(groupId, email)
      if (!existing) {
        const { data: participants } = await supabase
          .from('porra_participants')
          .select('*')
          .eq('group_id', groupId)
        const legacy = (participants || []).find(
          p => !p.email && normalizeName(p.name) === normalizeName(userName.trim())
        )
        if (legacy) existing = await backfillEmail(legacy, email)
      }

      if (existing) {
        notify('Este email ya está en el grupo. Entra desde inicio con tu email.', 'error')
        setLoading(false)
        return
      }

      if (pin && pin.length > 0 && pin.length < 4) {
        notify('El PIN debe tener al menos 4 dígitos', 'error')
        setLoading(false)
        return
      }

      const userId = uid()
      const pin_hash = await hashPin(pin)
      const { error } = await supabase.from('porra_participants').insert({
        id: userId,
        group_id: groupId,
        name: userName.trim(),
        email,
        is_admin: false,
        pin_hash,
        predictions: { group: {}, knockout: {}, bonuses: {} },
      })
      if (error) throw error

      const full = await loadGroupWithParticipants(groupId)
      notify(`¡Te has unido a "${group.name}"!`)
      onJoined(full, full.participants[userId])
    } catch {
      notify('No se pudo unir al grupo. Inténtalo de nuevo.', 'error')
    }
    setLoading(false)
  }

  async function verifyPinAndRejoin() {
    if (!existingMatch) return
    const h = await hashPin(pin)
    if (h !== existingMatch.pin_hash) {
      notify('PIN incorrecto', 'error')
      return
    }
    setLoading(true)
    await finishJoin(existingMatch)
    setLoading(false)
  }

  if (step === 'pin' && existingMatch) {
    return (
      <FormCard icon="key" title="¿Eres tú?" onBack={() => { setStep('email'); setExistingMatch(null); setPin('') }}>
        <p style={s.hint}>
          Cuenta de <strong>{existingMatch.name}</strong> ({existingMatch.email || userEmail}).
          Introduce tu PIN para continuar.
        </p>
        <Field label="PIN" htmlFor="join-pin-verify">
          <Input id="join-pin-verify" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Btn loading={loading} onClick={verifyPinAndRejoin}>Continuar →</Btn>
      </FormCard>
    )
  }

  if (step === 'email') {
    return (
      <FormCard icon="envelope" title="Tu email" showLogo onBack={() => setScreen('home')}>
        <p style={s.hint}>Primero tu email. Si ya estás en este grupo, entrarás automáticamente.</p>
        <InputActionRow
          label="Email"
          htmlFor="join-email-step"
          inputProps={{
            type: 'email',
            autoComplete: 'email',
            placeholder: 'tu@email.com',
            value: userEmail,
            onChange: e => setUserEmail(e.target.value),
            onKeyDown: e => e.key === 'Enter' && handleEmailStep(),
          }}
          buttonLabel="Continuar →"
          onAction={handleEmailStep}
          loading={loading}
          primary
        />
      </FormCard>
    )
  }

  if (step === 'profile') {
    return (
      <FormCard icon="user" title="Crear participante" showLogo onBack={() => setScreen('home')}>
        <p style={s.hint}>
          Email: <strong>{lockedEmail || userEmail}</strong>
        </p>
        <Field label="Tu nombre" htmlFor="join-name">
          <Input id="join-name" placeholder="Tu nombre o apodo" value={userName} onChange={e => setUserName(e.target.value)} />
        </Field>
        <Field label="PIN opcional (4–6 dígitos)" htmlFor="join-pin">
          <Input id="join-pin" type="password" inputMode="numeric" maxLength={6} placeholder="Protección extra al volver" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Btn loading={loading} onClick={handleProfileContinue}>
          Siguiente →
        </Btn>
      </FormCard>
    )
  }

  return (
    <FormCard icon="link" title="Unirse con código" showLogo onBack={() => setStep(isNewParticipant ? 'profile' : 'home')}>
      <p style={s.hint}>
        {lockedEmail || userEmail ? (
          <>Registrando <strong>{userName || 'tu perfil'}</strong> · {lockedEmail || userEmail}</>
        ) : (
          'Introduce el código del grupo'
        )}
      </p>
      <InputActionRow
        label="Código del grupo"
        htmlFor="join-code"
        inputProps={{
          placeholder: 'Código del grupo',
          value: code,
          uppercase: true,
          onChange: e => { setCode(e.target.value.toUpperCase()); checkCode(e.target.value) },
          onKeyDown: e => e.key === 'Enter' && handleJoin(),
          autoCapitalize: 'none',
          autoCorrect: 'off',
        }}
        buttonLabel="Unirse →"
        onAction={handleJoin}
        loading={loading}
      />
      {checking && <div style={s.checking}>Buscando grupo…</div>}
      {groupPreview && (
        <div style={{ ...s.preview, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="checkCircle" size="sm" />
          Grupo encontrado: <strong>{groupPreview.name}</strong>
        </div>
      )}
      {groupPreview === false && code.length >= 6 && (
        <div style={{ ...s.previewErr, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="exclamationTriangle" size="sm" /> Código no encontrado
        </div>
      )}
    </FormCard>
  )
}

export default CreateScreen

const s = {
  root: {
    maxWidth: 480,
    margin: '0 auto',
    padding: '20px 16px 40px',
    position: 'relative',
    zIndex: 1,
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'flex-start',
    paddingTop: 40,
  },
  card: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: '28px 24px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    boxShadow: 'var(--card-shadow)',
  },
  back: {
    background: 'var(--white)',
    border: 'none',
    color: 'var(--muted)',
    cursor: 'pointer',
    fontSize: 14,
    textAlign: 'left',
    padding: 0,
    fontWeight: 600,
  },
  logo: {
    display: 'block',
    width: 120,
    height: 'auto',
    margin: '0 auto 4px',
    filter: 'drop-shadow(0 6px 18px rgba(29, 49, 38, 0.2))',
  },
  title: {
    fontSize: 28,
    fontWeight: 900,
    color: 'var(--text)',
    margin: 0,
  },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, color: 'var(--muted)', fontWeight: 600, letterSpacing: 0.3 },
  input: {
    background: '#ffffff',
    border: '1.5px solid var(--border)',
    borderRadius: 12,
    padding: '13px 14px',
    color: 'var(--text)',
    fontSize: 15,
    outline: 'none',
    width: '100%',
    boxShadow: 'var(--card-shadow)',
  },
  btn: {
    background: 'linear-gradient(135deg, var(--accent-dark), var(--accent))',
    color: 'white',
    border: 'none',
    borderRadius: 14,
    padding: '15px 24px',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
    boxShadow: '0 4px 24px var(--accent-glow)',
    marginTop: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    background: 'var(--white)',
    border: '1.5px solid var(--border)',
    color: 'var(--muted)',
    borderRadius: 14,
    padding: '12px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
  },
  spinner: {
    width: 18,
    height: 18,
    border: '2.5px solid rgba(255,255,255,0.3)',
    borderTopColor: 'white',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
    display: 'inline-block',
  },
  hint: { fontSize: 12, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.5 },
  checking: { fontSize: 12, color: 'var(--muted)', marginTop: 4 },
  preview: {
    fontSize: 13,
    color: 'var(--green)',
    marginTop: 4,
    background: 'var(--green-dim)',
    borderRadius: 8,
    padding: '6px 10px',
  },
  previewErr: {
    fontSize: 13,
    color: 'var(--red)',
    marginTop: 4,
    background: 'var(--red-dim)',
    borderRadius: 8,
    padding: '6px 10px',
  },
}
