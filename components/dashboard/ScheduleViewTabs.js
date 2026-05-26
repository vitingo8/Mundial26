'use client'

const VIEW_OPTIONS = [
  { id: 'daily', label: 'Diaria' },
  { id: 'full', label: 'Completa' },
  { id: 'groups', label: 'Clasificación' },
]

export default function ScheduleViewTabs({ value, onChange, showGroups = true }) {
  const options = showGroups
    ? VIEW_OPTIONS
    : VIEW_OPTIONS.filter(o => o.id !== 'groups')

  return (
    <div className="schedule-view-tabs" role="tablist" aria-label="Vista del calendario">
      {options.map(opt => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={value === opt.id}
          className={`schedule-view-tab${value === opt.id ? ' schedule-view-tab--active' : ''}`}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
