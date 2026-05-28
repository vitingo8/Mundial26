'use client'

/** Badge +1 / +2 junto al nombre en clasificación de grupos. */
export default function QualificationPtsBadge({ entry }) {
  if (!entry?.total) return null

  const exact = entry.exactPts > 0
  const title = exact
    ? `+${entry.qualifiesPts} clasifica a dieciseisavos · +${entry.exactPts} posición exacta (${entry.predictedPosition}.º previsto, ${entry.actualPosition}.º real)`
    : `+${entry.qualifiesPts} clasifica (previsto ${entry.predictedPosition}.º, real ${entry.actualPosition}.º)`

  return (
    <span className="gs-qual-pts" title={title} aria-label={title}>
      +{entry.total}
    </span>
  )
}
