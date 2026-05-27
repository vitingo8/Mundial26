'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { SCORING } from '../lib/gameData'
import { isValidEmail, normalizeEmail } from '../lib/emailUtils'
import { findParticipantsByEmail } from '../lib/participantLookup'
import { getSavedEmail, saveEmail } from '../lib/savedEmail'
import { InputActionRow } from './InputRow'
import { Icon, IconLabel } from './icons'
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

      <ScoringCard />

      <p className="on-pattern-muted" style={s.privacy}>
        Si ya tienes cuenta, entras con tu email. Si es nuevo, crearás tu perfil y luego el código del grupo.
      </p>

      <Link href="/guia" style={s.guideLink} className="on-pattern-muted">
        <Icon name="academicCap" size="sm" />
        Guía de uso — ¿Cómo funciona todo?
      </Link>

      <div style={s.footer}>Porra Mundial 2026 © {new Date().getFullYear()}</div>
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

function ScoringCard() {
  return (
    <div style={s.scoringCard} className="animate-in">
      <div style={{ ...s.cardTitle, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="clipboardList" size="md" /> Puntuación
      </div>
      <div style={s.scoreGrid}>
        <ScoreRow icon="checkCircle" label="Resultado correcto (G/E/P)" pts={`+${SCORING.correctOutcome}`} />
        <ScoreRow icon="viewfinderCircle" label="Marcador exacto (bonus)" pts={`+${SCORING.exactScore}`} />
        <ScoreRow icon="bolt" label="Eliminatorias: acierto quién pasa (empate)" pts={`+${SCORING.knockoutAdvance}`} />
        <ScoreRow icon="user" label="Máximo goleador" pts={`+${SCORING.topScorer}`} />
        <ScoreRow icon="shieldCheck" label="Portero menos goleado" pts={`+${SCORING.topKeeper}`} />
        <ScoreRow icon="arrowTrendingUp" label="Máximo asistente" pts={`+${SCORING.topAssists}`} />
        <ScoreRow icon="star" label="MVP del torneo" pts={`+${SCORING.mvp}`} />
      </div>
    </div>
  )
}

function ScoreRow({ icon, label, pts }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13,
      color: 'var(--muted)',
    }}>
      <IconLabel icon={icon} iconSize="sm">{label}</IconLabel>
      <span style={{ color: 'var(--accent-dark)', fontWeight: 700, fontSize: 16 }}>{pts} pts</span>
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
  scoringCard: {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 18, padding: 20, animationDelay: '0.2s', boxShadow: 'var(--card-shadow)',
  },
  cardTitle: { fontSize: 18, fontWeight: 800, marginBottom: 14, letterSpacing: 0.5 },
  scoreGrid: { display: 'flex', flexDirection: 'column' },
  weights: { display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  weightPill: {
    flex: 1, textAlign: 'center', background: 'var(--accent-dim)',
    border: '1px solid var(--accent-glow)', borderRadius: 20,
    padding: '6px 12px', fontSize: 13, color: 'var(--muted)',
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
  footer: {
    textAlign: 'center', color: 'var(--text-soft)', fontSize: 11,
    marginTop: 8, paddingTop: 8, letterSpacing: 1,
  },
}
