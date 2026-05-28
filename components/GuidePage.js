'use client'

import Link from 'next/link'
import { Icon } from './icons'
import { SCORING } from '../lib/gameData'
import '../styles/guia.css'

const NAV = [
  { id: 'que-es', label: 'Qué es' },
  { id: 'empezar', label: 'Empezar' },
  { id: 'grupo', label: 'Tu grupo' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'porra', label: 'Porra' },
  { id: 'vivo', label: 'En vivo' },
  { id: 'perfil', label: 'Perfil' },
  { id: 'organizador', label: 'Organizador' },
  { id: 'puntos', label: 'Puntos' },
  { id: 'faq', label: 'Preguntas' },
]

export default function GuidePage() {
  return (
    <div className="guia-page">
      <header className="guia-hero">
        <img
          src="/logo-wc26.png"
          alt=""
          className="guia-logo"
          width={140}
          height={140}
        />
        <p className="guia-hero-badge">
          <Icon name="academicCap" size="sm" />
          Guía para jugadores
        </p>
        <h1>
          Todo lo que necesitas<br />
          <span>saber de la app</span>
        </h1>
        <p className="guia-hero-lead">
          Porra Mundial 2026 es tu quiniela privada del Mundial: predice partidos,
          compite con amigos y sigue quién va ganando — sin complicaciones.
        </p>
        <div className="guia-hero-actions">
          <Link href="/" className="guia-btn guia-btn--primary">
            <Icon name="arrowTopRightOnSquare" size="sm" />
            Ir a la app
          </Link>
          <a href="#que-es" className="guia-btn guia-btn--ghost">
            Empezar a leer
          </a>
        </div>
      </header>

      <nav className="guia-nav-wrap" aria-label="Contenido de la guía">
        <div className="guia-nav">
          {NAV.map(item => (
            <a key={item.id} href={`#${item.id}`}>
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      <main className="guia-content">
        <Section
          id="que-es"
          icon="trophy"
          title="¿Qué es Porra Mundial 2026?"
          tagline="Tu liga privada del Mundial, en el móvil o el ordenador."
        >
          <div className="guia-prose">
            <p>
              Imagina una quiniela entre amigos, compañeros de trabajo o familia: cada uno
              predice resultados del Mundial y al final gana quien más acierte. Eso es esta app.
            </p>
            <p>
              Cada <strong>grupo</strong> es independiente: un código o enlace para unirse,
              un ranking solo de vuestra gente y vuestras reglas de plazo (las marca quien crea el grupo).
            </p>
          </div>
          <div className="guia-cards">
            <FeatureCard
              icon="userGroup"
              title="Grupos privados"
              text="Solo entra quien tenga el enlace o el código. No hay cuentas públicas ni rankings globales."
            />
            <FeatureCard
              icon="arrowDownOnSquare"
              title="Funciona como app"
              text="Puedes añadirla a la pantalla de inicio del móvil y usarla como una app instalada."
            />
            <FeatureCard
              icon="signal"
              title="Resultados en vivo"
              text="Consulta marcadores reales del torneo y compáralos con lo que predijiste."
            />
          </div>
        </Section>

        <Section
          id="empezar"
          icon="sparkles"
          title="Cómo empezar"
          tagline="La pantalla de inicio: email, crear grupo o unirse."
        >
          <ol className="guia-steps">
            <li>
              <strong>Entra con tu email</strong>
              <span>
                Si ya participaste antes, la app te lleva directo a tu grupo. Si tienes varios
                grupos con el mismo email, te deja elegir cuál abrir.
              </span>
            </li>
            <li>
              <strong>¿Primera vez?</strong>
              <span>
                Tras poner el email, crearás tu perfil (nombre y, si quieres, un PIN de 4–6 dígitos)
                y luego el código del grupo al que quieres unirte.
              </span>
            </li>
            <li>
              <strong>Crear un grupo nuevo</strong>
              <span>
                Pulsa «Crear nuevo grupo», pon nombre del grupo, tu email y tu nombre. Serás el
                organizador y recibirás un código único para invitar a los demás.
              </span>
            </li>
            <li>
              <strong>Unirse con enlace</strong>
              <span>
                Si alguien te manda un enlace de invitación, al abrirlo la app ya sabe el código
                del grupo; solo Todos tu perfil si eres nuevo.
              </span>
            </li>
          </ol>
          <Tip>
            El PIN es opcional pero útil: si cambias de móvil, al volver con tu email te pedirá el PIN
            para confirmar que eres tú.
          </Tip>
        </Section>

        <Section
          id="grupo"
          icon="link"
          title="Dentro de tu grupo"
          tagline="Cabecera, invitar amigos e instalar la app."
        >
          <div className="guia-prose">
            <p>
              Cuando entras en un grupo ves su nombre y, arriba, varias acciones importantes:
            </p>
          </div>
          <div className="guia-cards">
            <FeatureCard
              icon="link"
              title="Invitar"
              text="Abre un panel con el enlace del grupo, código (#…), botón compartir, copiar y un código QR para escanear."
            />
            <FeatureCard
              icon="arrowDownOnSquare"
              title="Instalar app"
              text="En Android/Chrome puedes instalarla en un toque. En iPhone: Compartir → «Añadir a pantalla de inicio»."
            />
            <FeatureCard
              icon="user"
              title="Tu foto de perfil"
              text="El círculo de la derecha abre «Mi perfil»: nombre de equipo, escudo y datos que ves en el ranking."
            />
          </div>
          <p className="guia-prose" style={{ marginTop: '1rem' }}>
            Abajo (o arriba en pantallas grandes) tienes las secciones principales:
          </p>
          <div className="guia-tabs-demo" aria-hidden="true">
            <span className="guia-tab-pill guia-tab-pill--active">
              <Icon name="trophy" size="sm" /> Ranking
            </span>
            <span className="guia-tab-pill">
              <Icon name="clipboardList" size="sm" /> Porra
            </span>
            <span className="guia-tab-pill">
              <Icon name="signal" size="sm" /> En vivo
            </span>
            <span className="guia-tab-pill">
              <Icon name="cog6Tooth" size="sm" /> Organización
            </span>
          </div>
          <p className="guia-prose">
            La pestaña «Organización» solo la ve quien creó el grupo (el organizador).
          </p>
        </Section>

        <Section
          id="ranking"
          icon="trophy"
          title="Ranking"
          tagline="Quién va ganando y el desglose de puntos."
        >
          <div className="guia-prose">
            <p>
              Aquí ves a todos los participantes ordenados por puntos totales. Tu fila aparece
              resaltada para que la encuentres al instante.
            </p>
          </div>
          <div className="guia-cards">
            <FeatureCard
              icon="clipboardList"
              title="Vista Ranking"
              text="Lista clásica: posición, escudo/nombre y puntos totales. El primero lleva el detalle de líder."
            />
            <FeatureCard
              icon="chartBar"
              title="Vista Tabla"
              text="Desglose por tipo de acierto: G/E/P (resultado 1X2), marcador exacto, especiales y MVP."
            />
          </div>
          <Tip>
            Los puntos suben cuando el organizador publica los resultados reales de los partidos
            y las respuestas de las predicciones especiales. Hasta entonces verás ceros o pocos puntos.
          </Tip>
          <p className="guia-prose">
            Al final de la sección puedes <strong>Salir del grupo</strong>: cierra tu sesión en este
            dispositivo (no borra tu historial; puedes volver con el mismo email).
          </p>
        </Section>

        <Section
          id="porra"
          icon="clipboardList"
          title="Porra — tus predicciones"
          tagline="Donde marcas resultados y apuestas especiales."
        >
          <div className="guia-prose">
            <p>
              La porra tiene <strong>tres bloques</strong>. Cada uno tiene su plazo: cuando cierra,
              ya no puedes editar (solo leer).
            </p>
          </div>
          <div className="guia-cards">
            <FeatureCard
              icon="userGroup"
              title="Inicio (60% del peso)"
              text="Todos los partidos de la fase de grupos, bonus por acertar quién clasifica a dieciseisavos (vs la API) y tu bracket KO previsto antes de los dieciseisavos reales."
            />
            <FeatureCard
              icon="bolt"
              title="Eliminatorias (40%)"
              text="Partidos reales del Mundial desde dieciseisavos hasta la final. Puedes rellenarlos todos hasta el 28 jun 2026, 21:00 (Madrid). Los +3 y +5 del marcador solo cuentan si el cruce (equipos) coincide con tu bracket de Inicio; siempre +1 si aciertas qué selección pasa."
            />
            <FeatureCard
              icon="star"
              title="Especiales"
              text="Máximo goleador, mejor portero (solo porteros), máximo asistente y MVP del torneo."
            />
          </div>
          <div className="guia-prose" style={{ marginTop: '1rem' }}>
            <p><strong>Vistas del calendario</strong> (mismas en Porra y En vivo):</p>
          </div>
          <ul className="guia-steps" style={{ marginTop: '0.5rem' }}>
            <li>
              <strong>Día</strong>
              <span>Partidos agrupados por día de jornada.</span>
            </li>
            <li>
              <strong>Todo</strong>
              <span>Todo el calendario de la fase en una lista.</span>
            </li>
            <li>
              <strong>Clasificación</strong>
              <span>Tablas de grupos con tus goles previstos (solo fase de grupos).</span>
            </li>
          </ul>
          <Tip>
            Pulsa <strong>Guardar ahora</strong> cuando termines una tanda de predicciones.
            Si cambias de pestaña, la app intenta guardar sola, pero conviene guardar antes de cerrar.
          </Tip>
          <p className="guia-prose">
            La barra de progreso te dice cuántos partidos de grupos llevas rellenados (por ejemplo 42/72).
          </p>
        </Section>

        <Section
          id="vivo"
          icon="signal"
          title="En vivo"
          tagline="Marcadores reales y tu predicción al lado."
        >
          <div className="guia-prose">
            <p>
              Sigue el Mundial mientras se juega: resultados actualizados, estado del partido
              (programado, en juego, finalizado) y, si predijiste ese encuentro, lo que marcaste.
            </p>
            <p>
              Puedes alternar entre <strong>fase de grupos</strong> y <strong>eliminatorias</strong>,
              y usar las mismas vistas Día / Todo / Clasificación.
            </p>
            <p>
              Si tocas un partido, la app te lleva a la Porra en ese encuentro para revisar o
              Todor tu predicción (si el plazo sigue abierto).
            </p>
          </div>
          <Tip>
            Usa el botón de actualizar arriba para refrescar marcadores. Si no hay conexión con
            datos en vivo, verás los resultados que haya introducido el organizador.
          </Tip>
        </Section>

        <Section
          id="perfil"
          icon="user"
          title="Mi perfil"
          tagline="Tu identidad en el ranking."
        >
          <div className="guia-prose">
            <p>
              Personaliza cómo te ven los demás:
            </p>
          </div>
          <div className="guia-cards">
            <FeatureCard
              icon="user"
              title="Nombre de equipo"
              text="Ej. «Los Cracks FC». Aparece grande en el ranking; tu nombre real queda debajo en texto más suave."
            />
            <FeatureCard
              icon="shieldCheck"
              title="Escudo / logo"
              text="Sube una imagen (JPG o PNG). Se redimensiona sola para verse bien en la lista."
            />
          </div>
          <p className="guia-prose">
            El email y tu nombre de registro no se cambian desde aquí; sirven para recuperar la cuenta.
          </p>
        </Section>

        <Section
          id="organizador"
          icon="cog6Tooth"
          title="Si eres el organizador"
          tagline="Quien crea el grupo gestiona plazos y resultados."
        >
          <div className="guia-prose">
            <p>
              Además de jugar como cualquier otro, tienes la pestaña <strong>Organización</strong>:
            </p>
          </div>
          <div className="guia-cards">
            <FeatureCard
              icon="cog6Tooth"
              title="Configuración"
              text="Nombre del grupo, logo de la liga y fase del torneo en la que estáis."
            />
            <FeatureCard
              icon="clock"
              title="Plazos"
              text="Fecha límite para cerrar predicciones de grupos (y especiales) y otra para eliminatorias. Pasado el plazo, nadie puede editar."
            />
            <FeatureCard
              icon="trophy"
              title="Ganadores reales"
              text="Cuando termine el torneo, introduces quién fue goleador, MVP, etc., para repartir esos puntos."
            />
          </div>
          <Tip>
            El organizador puede sincronizar resultados de partidos automáticamente cuando el
            sistema lo permite; si no, puede cargarlos para que el ranking se actualice.
          </Tip>
        </Section>

        <Section
          id="puntos"
          icon="checkCircle"
          title="Cómo se suman los puntos"
          tagline="Reglas claras para saber por qué subes (o no) en el ranking."
        >
          <div className="guia-score-grid">
            <div className="guia-score-row">
              <span>Pestaña Inicio (grupos + KO previsto, antes del pitido)</span>
              <span>×60 % al total</span>
            </div>
            <div className="guia-score-row">
              <span>Eliminatorias reales (API)</span>
              <span>×40 % al total</span>
            </div>
            <div className="guia-score-row">
              <span>Especiales y MVP</span>
              <span>100 % (sin ponderar)</span>
            </div>
            <div className="guia-score-row">
              <span>Acertar ganador, empate o perdedor (G/E/P)</span>
              <span>+{SCORING.correctOutcome} pts</span>
            </div>
            <div className="guia-score-row">
              <span>Marcador exacto (bonus, suma al acertar G/E/P)</span>
              <span>+{SCORING.exactScore} pts</span>
            </div>
            <div className="guia-score-row">
              <span>Eliminatorias: G/E/P y exacto solo si el cruce coincide con tu bracket</span>
              <span>+{SCORING.correctOutcome} / +{SCORING.exactScore}</span>
            </div>
            <div className="guia-score-row">
              <span>Eliminatorias: acierto quién pasa (siempre)</span>
              <span>+{SCORING.knockoutAdvance} pt</span>
            </div>
            <div className="guia-score-row">
              <span>Clasificados a dieciseisavos (según API), por equipo que predijiste</span>
              <span>+{SCORING.groupQualifies} pt</span>
            </div>
            <div className="guia-score-row">
              <span>Además aciertas 1.º, 2.º o 3.º (mejor tercero) en su grupo</span>
              <span>+{SCORING.groupQualExactPosition} pt extra</span>
            </div>
            <div className="guia-score-row">
              <span>Máximo goleador</span>
              <span>+{SCORING.topScorer} pts</span>
            </div>
            <div className="guia-score-row">
              <span>Mejor portero</span>
              <span>+{SCORING.topKeeper} pts</span>
            </div>
            <div className="guia-score-row">
              <span>Máximo asistente</span>
              <span>+{SCORING.topAssists} pts</span>
            </div>
            <div className="guia-score-row">
              <span>MVP del torneo</span>
              <span>+{SCORING.mvp} pts</span>
            </div>
          </div>
          <div className="guia-score-total">
            <strong>Ejemplo:</strong> Predices 2-1 y el partido acaba 2-1 → llevas {SCORING.correctOutcome} pts
            (aciertas quién gana) + {SCORING.exactScore} pts (marcador exacto) ={' '}
            <strong>{SCORING.correctOutcome + SCORING.exactScore} pts</strong> en ese partido.
          </div>
          <p className="guia-prose" style={{ marginTop: '1rem' }}>
            En la tabla del ranking, <strong>G/E/P</strong> cuenta los aciertos de resultado;
            <strong> Resultado</strong> son los bonus por marcador exacto; <strong>Especial</strong> y{' '}
            <strong>MVP</strong> vienen de tus apuestas de la pestaña Especiales.
          </p>
        </Section>

        <Section id="faq" icon="academicCap" title="Preguntas frecuentes" tagline="">
          <div className="guia-faq">
            <details>
              <summary>¿Puedo estar en varios grupos?</summary>
              <p>
                Sí. Usa el mismo email: al entrar, si tienes varios grupos, la app te deja elegir
                cuál abrir.
              </p>
            </details>
            <details>
              <summary>Perdí el móvil, ¿pierdo mi porra?</summary>
              <p>
                No. Vuelve a la pantalla de inicio, pon tu email y entra de nuevo. Si pusiste PIN,
                te lo pedirá para confirmar.
              </p>
            </details>
            <details>
              <summary>¿Por qué no puedo editar mis predicciones?</summary>
              <p>
                El organizador fijó una fecha límite y ya pasó, o la fase del torneo en la que estáis
                no permite más cambios. Verás un aviso de «Plazo cerrado · Solo lectura».
              </p>
            </details>
            <details>
              <summary>¿Qué diferencia hay entre Inicio y Eliminatorias en la porra?</summary>
              <p>
                <strong>Inicio</strong> son los partidos de grupos y tu bracket calculado a partir de
                ellos. <strong>Eliminatorias</strong> son los partidos reales del cuadro final del
                Mundial, con su propio plazo y peso en la puntuación.
              </p>
            </details>
            <details>
              <summary>¿Cómo invito a más gente?</summary>
              <p>
                Dentro del grupo, pulsa «Invitar», copia el enlace o compártelo por WhatsApp, Telegram,
                etc. También puedes dictar el código del grupo (#…).
              </p>
            </details>
          </div>
        </Section>
      </main>

      <footer className="guia-footer">
        <Link href="/" className="guia-btn guia-btn--primary" style={{ marginBottom: '1rem' }}>
          Volver a la app
        </Link>
        <p>Porra Mundial 2026 · EE. UU. · Canadá · México</p>
      </footer>
    </div>
  )
}

function Section({ id, icon, title, tagline, children }) {
  return (
    <section id={id} className="guia-section" aria-labelledby={`${id}-title`}>
      <div className="guia-section-header">
        <div className="guia-section-icon" aria-hidden="true">
          <Icon name={icon} />
        </div>
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          {tagline && <p className="guia-section-tagline">{tagline}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function FeatureCard({ icon, title, text }) {
  return (
    <div className="guia-card">
      <h3>
        <Icon name={icon} size="sm" />
        {title}
      </h3>
      <p>{text}</p>
    </div>
  )
}

function Tip({ children }) {
  return (
    <div className="guia-tip" role="note">
      <span className="guia-tip-icon" aria-hidden="true">💡</span>
      <div>{children}</div>
    </div>
  )
}
