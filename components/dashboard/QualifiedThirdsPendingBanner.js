'use client'

import { displayTeamName } from '../../lib/teamNamesEs'
import {
  formatQualifiedThirdPendingLabel,
  formatThirdPendingQualificationLabel,
} from '../../lib/knockoutThirdSlots'

export default function QualifiedThirdsPendingBanner({
  qualifiedItems = [],
  pendingQualificationItems = [],
}) {
  const hasQualified = qualifiedItems.length > 0
  const hasPending = pendingQualificationItems.length > 0
  if (!hasQualified && !hasPending) return null

  return (
    <div className="ko-qualified-thirds-pending" role="status">
      {hasQualified && (
        <>
          <p className="ko-qualified-thirds-pending-title">Mejores terceros clasificados — rival pendiente</p>
          <ul className="ko-qualified-thirds-pending-list">
            {qualifiedItems.map(row => (
              <li key={`q-${row.group}`}>
                <span className="ko-qualified-thirds-pending-dot" aria-hidden="true" />
                {formatQualifiedThirdPendingLabel(displayTeamName(row.team))}
              </li>
            ))}
          </ul>
        </>
      )}
      {hasPending && (
        <>
          <p className={`ko-qualified-thirds-pending-title${hasQualified ? ' ko-qualified-thirds-pending-title--secondary' : ''}`}>
            Terceros pendientes de confirmación entre los 8 mejores
          </p>
          <ul className="ko-qualified-thirds-pending-list">
            {pendingQualificationItems.map(row => (
              <li key={`p-${row.group}`}>
                <span className="ko-qualified-thirds-pending-dot ko-qualified-thirds-pending-dot--amber" aria-hidden="true" />
                {formatThirdPendingQualificationLabel(displayTeamName(row.team))}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
