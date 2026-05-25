'use client'
import { useState } from 'react'
import { SCORING } from '../lib/gameData'

export default function HomeScreen({ setScreen, setJoinCode, notify }) {
  const [code, setCode] = useState('')

  function handleJoin() {
    if (!code.trim()) { notify('Introduce un código de grupo', 'error'); return }
    setJoinCode(code.trim().toLowerCase())
    setScreen('join')
  }

  return (
    <div style={s.root}>
      <div style={s.hero}>
        <div style={s.trophyWrap}>
          <div style={s.trophy}>🏆</div>
          <div style={s.ball}>⚽</div>
        </div>
        <h1 style={s.title}>PORRA<br /><span style={s.year}>MUNDIAL<br />2026</span></h1>
        <p style={s.sub}>USA · CANADA · MEXICO · {new Date().getFullYear()}</p>
      </div>

      <div style={s.actions} className="animate-in">
        <button style={s.btnCreate} onClick={() => setScreen('create')}>
          ✨ Crear nuevo grupo
        </button>

        <div style={s.divider}><span>o únete con código</span></div>

        <div style={s.joinRow}>
          <input
            style={s.codeInput}
            placeholder="Código del grupo"
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <button style={s.btnJoin} onClick={handleJoin}>Unirse →</button>
        </div>
      </div>

      <div style={s.scoringCard} className="animate-in">
        <div style={s.cardTitle}>📋 Puntuación</div>
        <div style={s.scoreGrid}>
          <ScoreRow icon="✅" label="Resultado correcto (G/E/P)" pts={`+${SCORING.correctOutcome}`} />
          <ScoreRow icon="🎯" label="Marcador exacto (bonus)" pts={`+${SCORING.exactScore}`} />
          <ScoreRow icon="⚽" label="Máximo goleador" pts={`+${SCORING.topScorer}`} />
          <ScoreRow icon="🧤" label="Portero menos goleado" pts={`+${SCORING.topKeeper}`} />
          <ScoreRow icon="🅰️" label="Máximo asistente" pts={`+${SCORING.topAssists}`} />
          <ScoreRow icon="⭐" label="MVP del torneo" pts={`+${SCORING.mvp}`} />
        </div>
        <div style={s.weights}>
          <div style={s.weightPill}><strong>60%</strong> Porra inicial</div>
          <div style={s.weightPill}><strong>40%</strong> Eliminatorias</div>
        </div>
      </div>

      <div style={s.footer}>Mundial 2026 Porra © {new Date().getFullYear()}</div>
    </div>
  )
}

function ScoreRow({ icon, label, pts }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13,
      color: 'var(--muted)'
    }}>
      <span>{icon} {label}</span>
      <span style={{ color: 'var(--accent-dark)', fontWeight: 700, fontFamily: "'Inter', sans-serif", fontSize: 16 }}>{pts} pts</span>
    </div>
  )
}

const s = {
  root: {
    maxWidth: 480, margin: '0 auto', padding: '0 16px 40px',
    position: 'relative', zIndex: 1, minHeight: '100vh',
    display: 'flex', flexDirection: 'column', gap: 20
  },
  hero: {
    textAlign: 'center', paddingTop: 48, paddingBottom: 8,
  },
  trophyWrap: { position: 'relative', display: 'inline-block', marginBottom: 8 },
  trophy: { fontSize: 64, display: 'block' },
  ball: {
    position: 'absolute', bottom: -8, right: -16,
    fontSize: 24, animation: 'spin 8s linear infinite'
  },
  title: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 72, fontWeight: 900, lineHeight: 0.85,
    color: 'var(--text)', letterSpacing: 2, marginBottom: 12,
  },
  year: {
    color: 'var(--accent-dark)',
    textShadow: '0 4px 24px rgba(27,143,66,0.25)',
  },
  sub: {
    color: 'var(--muted)', fontSize: 13, letterSpacing: 3,
    fontWeight: 600, fontFamily: "'Inter', sans-serif"
  },
  actions: {
    display: 'flex', flexDirection: 'column', gap: 12, animationDelay: '0.1s'
  },
  btnCreate: {
    background: 'linear-gradient(135deg, var(--accent-dark), var(--accent))',
    color: 'white', border: 'none', borderRadius: 14, padding: '16px 24px',
    fontSize: 17, fontWeight: 700, cursor: 'pointer', width: '100%',
    boxShadow: '0 6px 24px var(--accent-glow)',
    fontFamily: "'Inter', sans-serif", letterSpacing: 0.5,
  },
  divider: {
    display: 'flex', alignItems: 'center', gap: 12, color: 'var(--muted)',
    fontSize: 12, fontWeight: 600, letterSpacing: 1,
    '::before': { content: '""', flex: 1, height: 1, background: 'var(--border)' },
    '::after': { content: '""', flex: 1, height: 1, background: 'var(--border)' },
    textAlign: 'center'
  },
  joinRow: { display: 'flex', gap: 8 },
  codeInput: {
    flex: 1, background: 'var(--card)', border: '1.5px solid var(--border)',
    borderRadius: 12, padding: '13px 14px', color: 'var(--text)',
    fontSize: 16, outline: 'none', letterSpacing: 2,
    textTransform: 'uppercase', boxShadow: 'var(--card-shadow)'
  },
  btnJoin: {
    background: 'var(--card2)', border: '1.5px solid var(--accent-dark)',
    color: 'var(--accent-dark)', borderRadius: 12, padding: '13px 16px',
    fontSize: 15, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
  },
  scoringCard: {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 18, padding: 20, animationDelay: '0.2s',
    boxShadow: 'var(--card-shadow)',
  },
  cardTitle: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 18, fontWeight: 800, marginBottom: 14, letterSpacing: 0.5
  },
  scoreGrid: { display: 'flex', flexDirection: 'column' },
  weights: {
    display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap'
  },
  weightPill: {
    flex: 1, textAlign: 'center', background: 'var(--accent-dim)',
    border: '1px solid var(--accent-glow)', borderRadius: 20,
    padding: '6px 12px', fontSize: 13, color: 'var(--muted)'
  },
  footer: {
    textAlign: 'center', color: 'var(--muted)', fontSize: 11,
    marginTop: 'auto', paddingTop: 20, letterSpacing: 1
  }
}
