'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { isValidEmail, normalizeEmail } from '../lib/emailUtils'
import { findParticipantsByEmail } from '../lib/participantLookup'
import { getSavedEmail, saveEmail } from '../lib/savedEmail'
import { InputActionRow } from './InputRow'
import { Icon } from './icons'
import LeagueLogo from './LeagueLogo'

export default function HomeScreen({ setScreen, setJoinCode, setJoinEmail, setJoinNewUser, notify, onRecovered }) {
  const [email, setEmail] = useState(() => getSavedEmail())
  const [loading, setLoading] = useState(false)
  const [pickList, setPickList] = useState(null)

  async function handleEmailContinue() {
    if (!email.trim()) {
      notify('Introduce tu email', 'error')
      return
    }
    if (!isValidEmail(email)) {
      notify('Introduce un email válido', 'error')
      return
    }
    const norm = normalizeEmail(email)
    saveEmail(norm)
    setLoading(true)
    setPickList(null)
    try {
      const matches = await findParticipantsByEmail(supabase, norm)
      if (matches.length === 1) {
        await onRecovered(matches[0].group_id, matches[0].id)
        setLoading(false)
        return
      }
      if (matches.length > 1) {
        setPickList(matches)
        setLoading(false)
        return
      }
      setJoinEmail(norm)
      setJoinNewUser(true)
      setJoinCode('')
      setScreen('join')
    } catch {
      notify('No se pudo comprobar el email. Inténtalo de nuevo.', 'error')
    }
    setLoading(false)
  }

  if (pickList?.length) {
    return (
      <div className="home-root app-container" style={s.root}>
        <PickGroupHero />
        <div style={s.actions} className="animate-in">
          <p style={s.pickHint}>Varios grupos con este email. Elige uno:</p>
          {pickList.map(p => (
            <button
              key={p.id}
              type="button"
              disabled={loading}
              onClick={async () => {
                setLoading(true)
                await onRecovered(p.group_id, p.id)
                setLoading(false)
              }}
              style={s.pickBtn}
            >
              <LeagueLogo
                src={p.league_logo}
                name={p.groupName}
                size={44}
                placeholder
              />
              <div style={s.pickBtnText}>
                <strong>{p.groupName}</strong>
                <span style={s.pickSub}>
                  como {p.name}
                  {p.participantCount > 0 && (
                    <> · {p.participantCount} {p.participantCount === 1 ? 'participante' : 'participantes'}</>
                  )}
                </span>
              </div>
            </button>
          ))}
          <button type="button" style={s.btnLink} onClick={() => setPickList(null)}>
            ← Cambiar email
          </button>
          <Link href="/guia" style={s.guideLink} className="on-pattern-muted">
            <Icon name="academicCap" size="sm" />
            Guía de uso
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="home-root app-container" style={s.root}>
      <PickGroupHero />

      <div style={s.actions} className="animate-in">
        <InputActionRow
          label="Tu email"
          htmlFor="home-email"
          inputProps={{
            type: 'email',
            autoComplete: 'email',
            placeholder: 'tu@email.com',
            value: email,
            onChange: e => setEmail(e.target.value),
            onKeyDown: e => e.key === 'Enter' && handleEmailContinue(),
          }}
          buttonLabel="Continuar →"
          onAction={handleEmailContinue}
          loading={loading}
          primary
        />

        <div className="on-pattern-muted" style={s.divider}><span>o</span></div>

        <button style={{ ...s.btnCreate, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => setScreen('create')}>
          <Icon name="sparkles" size="md" />
          Crear nuevo grupo
        </button>

      </div>

      <p className="on-pattern-muted" style={s.privacy}>
        Si ya tienes cuenta, entras con tu email. Si es nuevo, crearás tu perfil y luego el código del grupo.
      </p>

      <Link href="/guia" style={s.guideLink} className="on-pattern-muted">
        <Icon name="academicCap" size="sm" />
        Guía de uso — ¿Cómo funciona todo?
      </Link>

    </div>
  )
}

function PickGroupHero() {
  return (
    <div style={s.hero}>
      <img src="/logo-wc26.png" alt="FIFA World Cup 2026" style={s.logo} width={200} height={200} />
      <h1 className="home-title on-pattern" style={s.title}>PORRA<br /><span style={s.year}>MUNDIAL<br />2026</span></h1>
      <p className="on-pattern-muted" style={s.sub}>EE. UU. · Canadá · México · {new Date().getFullYear()}</p>
    </div>
  )
}

const s = {
  root: {
    maxWidth: 480, margin: '0 auto', padding: '0 16px 40px',
    position: 'relative', zIndex: 1, minHeight: '100vh',
    display: 'flex', flexDirection: 'column', gap: 20,
  },
  hero: { textAlign: 'center', paddingTop: 48, paddingBottom: 8 },
  logo: {
    display: 'block', width: 200, height: 'auto', margin: '0 auto 12px',
    filter: 'drop-shadow(0 8px 24px rgba(29, 49, 38, 0.35))',
  },
  title: { fontSize: 72, fontWeight: 900, lineHeight: 0.85, letterSpacing: 2, marginBottom: 12 },
  year: { color: 'var(--wc-lime)' },
  sub: { fontSize: 13, letterSpacing: 3, fontWeight: 600 },
  actions: { display: 'flex', flexDirection: 'column', gap: 12, animationDelay: '0.1s' },
  btnCreate: {
    background: 'linear-gradient(135deg, var(--accent-dark), var(--accent))',
    color: 'white', border: 'none', borderRadius: 14, padding: '16px 24px',
    fontSize: 17, fontWeight: 700, cursor: 'pointer', width: '100%',
    boxShadow: '0 6px 24px var(--accent-glow)', letterSpacing: 0.5,
  },
  divider: {
    textAlign: 'center', color: 'var(--muted)', fontSize: 12, fontWeight: 600, letterSpacing: 1,
  },
  pickHint: { fontSize: 13, color: '#fff', margin: '0 0 4px', lineHeight: 1.5 },
  pickBtn: {
    background: 'var(--white)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
    fontWeight: 700, fontSize: 15, display: 'flex', flexDirection: 'row', alignItems: 'center',
    gap: 12, width: '100%', boxShadow: 'var(--card-shadow)',
  },
  pickBtnText: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  pickSub: { fontSize: 13, color: 'var(--muted)', fontWeight: 500 },
  btnLink: {
    background: 'none', border: 'none', color: '#fff',
    cursor: 'pointer', fontSize: 13, padding: 8, textAlign: 'center',
  },
  privacy: { fontSize: 11, textAlign: 'center', lineHeight: 1.5, padding: '0 8px' },
  guideLink: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    padding: '12px 16px',
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
    borderRadius: 12,
    background: 'rgba(255, 255, 255, 0.14)',
    border: '1px solid rgba(255, 255, 255, 0.28)',
    transition: 'background 0.2s ease',
  },
}
