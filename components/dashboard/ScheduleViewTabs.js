'use client'

const VIEW_OPTIONS = [
  { id: 'daily', label: 'Día' },
  { id: 'full', label: 'Todo' },
  { id: 'groups', label: 'Clasificación', groupOnly: true },
  { id: 'bracket', label: 'Bracket', bracketOnly: true },
]

export default function ScheduleViewTabs({ value, onChange, showGroups = true, showBracket = false }) {
  const options = VIEW_OPTIONS.filter(o => {
    if (o.groupOnly && !showGroups) return false
    if (o.bracketOnly && !showBracket) return false
    return true
  })

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
