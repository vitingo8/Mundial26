'use client'

import {
  AcademicCapIcon,
  ArrowDownOnSquareIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ArrowTrendingUpIcon,
  ArrowUturnLeftIcon,
  AtSymbolIcon,
  Bars3Icon,
  BoltIcon,
  BuildingLibraryIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChartBarIcon,
  CheckCircleIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  Cog6ToothIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  FireIcon,
  FlagIcon,
  KeyIcon,
  LinkIcon,
  LockClosedIcon,
  MapPinIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  ShieldCheckIcon,
  SignalIcon,
  SparklesIcon,
  StarIcon,
  TrophyIcon,
  UserGroupIcon,
  UserIcon,
  ViewfinderCircleIcon,
} from '@heroicons/react/24/outline'
import { Volleyball } from 'lucide-react'

/** @type {Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>>} */
export const ICONS = {
  academicCap: AcademicCapIcon,
  arrowDownOnSquare: ArrowDownOnSquareIcon,
  arrowPath: ArrowPathIcon,
  arrowTopRightOnSquare: ArrowTopRightOnSquareIcon,
  arrowTrendingUp: ArrowTrendingUpIcon,
  atSymbol: AtSymbolIcon,
  bars3: Bars3Icon,
  bolt: BoltIcon,
  buildingLibrary: BuildingLibraryIcon,
  calendarDays: CalendarDaysIcon,
  chevronLeft: ChevronLeftIcon,
  chevronRight: ChevronRightIcon,
  chartBar: ChartBarIcon,
  check: CheckIcon,
  checkCircle: CheckCircleIcon,
  clipboard: ClipboardDocumentIcon,
  clipboardList: ClipboardDocumentListIcon,
  clock: ClockIcon,
  cog6Tooth: Cog6ToothIcon,
  envelope: EnvelopeIcon,
  exclamationTriangle: ExclamationTriangleIcon,
  fire: FireIcon,
  flag: FlagIcon,
  goal: Volleyball,
  goalOwn: ArrowUturnLeftIcon,
  goalPenalty: FlagIcon,
  key: KeyIcon,
  link: LinkIcon,
  lockClosed: LockClosedIcon,
  mapPin: MapPinIcon,
  pauseCircle: PauseCircleIcon,
  playCircle: PlayCircleIcon,
  shieldCheck: ShieldCheckIcon,
  signal: SignalIcon,
  sparkles: SparklesIcon,
  star: StarIcon,
  trophy: TrophyIcon,
  user: UserIcon,
  userGroup: UserGroupIcon,
  viewfinderCircle: ViewfinderCircleIcon,
}

const SIZE_PX = { sm: 16, md: 20, lg: 24, xl: 28 }

/** Icono según tipo de gol (REGULAR / PENALTY / OWN). */
export function goalIconName(type) {
  if (type === 'PENALTY') return 'goalPenalty'
  if (type === 'OWN') return 'goalOwn'
  return 'goal'
}

/** Tab / nav icon keys */
export const TAB_ICONS = {
  group: 'trophy',
  predictions: 'viewfinderCircle',
  live: 'signal',
  profile: 'user',
  admin: 'cog6Tooth',
}

/** Prediction phase picker */
export const PHASE_ICONS = {
  group: 'buildingLibrary',
  knockout: 'bolt',
  bonuses: 'star',
}

/** Knockout round headers (gameData) */
export const ROUND_ICONS = {
  r32: 'bolt',
  r16: 'fire',
  qf: 'sparkles',
  sf: 'star',
  '3rd': 'trophy',
  final: 'trophy',
}

/** Bonus / scoring fields */
export const BONUS_FIELD_ICONS = {
  topScorer: 'user',
  topKeeper: 'shieldCheck',
  topAssists: 'arrowTrendingUp',
  mvp: 'star',
}

const RANK_COLORS = ['#c9a227', '#9ca3af', '#b87333']

/**
 * @param {{ name: keyof typeof ICONS | string, size?: 'sm'|'md'|'lg'|'xl'|number, className?: string, style?: React.CSSProperties }} props
 */
export function Icon({ name, size = 'md', className = '', style, ...props }) {
  const C = ICONS[name]
  if (!C) return null
  const px = typeof size === 'number' ? size : SIZE_PX[size] ?? 20
  return (
    <C
      className={`ui-icon ${className}`.trim()}
      style={{ width: px, height: px, flexShrink: 0, ...style }}
      aria-hidden={props['aria-hidden'] ?? true}
      {...props}
    />
  )
}

export function IconLabel({ icon, children, gap = 6, iconSize = 'sm' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap }}>
      <Icon name={icon} size={iconSize} />
      <span>{children}</span>
    </span>
  )
}

/** 0-based rank index → trophy colors or #n */
export function RankDisplay({ index, prefix = '' }) {
  if (index < 3) {
    return <Icon name="trophy" size="md" style={{ color: RANK_COLORS[index] }} />
  }
  return <>{prefix}{index + 1}</>
}

export function LockedBanner({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Icon name="lockClosed" size="sm" />
      <span>{children}</span>
    </div>
  )
}

export function SaveButtonLabel({ saving, children = 'Guardar' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      {saving ? <span className="dash-spinner dash-spinner--dark" /> : <Icon name="arrowDownOnSquare" size="sm" />}
      {children}
    </span>
  )
}

export function RefreshButtonLabel({ loading, children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: children ? 8 : 0 }}>
      {loading ? <span style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <Icon name="arrowPath" size="sm" />}
      {children || null}
    </span>
  )
}

export function RoundHeader({ roundId, label, icon: iconOverride }) {
  const icon = iconOverride || ROUND_ICONS[roundId] || 'trophy'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <Icon name={icon} size="sm" />
      {label}
    </span>
  )
}

const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'LIVE'])
const UPCOMING_STATUSES = new Set(['SCHEDULED', 'TIMED'])

export function MatchStatus({ status, highlight, upcoming, withChevron = false }) {
  if (highlight || status === 'IN_PLAY' || status === 'LIVE') {
    return <IconLabel icon="signal" iconSize="sm">EN JUEGO</IconLabel>
  }
  if (status === 'PAUSED') {
    return <IconLabel icon="pauseCircle" iconSize="sm">Descanso</IconLabel>
  }
  if (upcoming || UPCOMING_STATUSES.has(status)) {
    return null
  }
  if (status === 'FINISHED') {
    return (
      <span className="match-status-label-row">
        <span className="match-status-label match-status-label--finished">FT</span>
        {withChevron && (
          <Icon name="chevronRight" size={11} className="match-status-label__chevron" aria-hidden />
        )}
      </span>
    )
  }
  if (status === 'POSTPONED') {
    return <IconLabel icon="pauseCircle" iconSize="sm">Aplazado</IconLabel>
  }
  return <>{status}</>
}
