'use client'

import { rowCenter } from '../../lib/knockoutBracketTreeLayout'

const MID = 50

function pathPair(y1, y2, yTarget, side) {
  if (side === 'left') {
    return `M 0 ${y1} H ${MID} M 0 ${y2} H ${MID} M ${MID} ${y1} V ${y2} M ${MID} ${yTarget} H 100`
  }
  return `M 100 ${y1} H ${MID} M 100 ${y2} H ${MID} M ${MID} ${y1} V ${y2} M ${MID} ${yTarget} H 0`
}

function pathMerge(sourceYs, targetY, side) {
  const [y1, y2] = sourceYs
  if (side === 'left') {
    return `M 0 ${y1} H ${MID} M 0 ${y2} H ${MID} M ${MID} ${y1} V ${y2} M ${MID} ${targetY} H 100`
  }
  return `M 100 ${y1} H ${MID} M 100 ${y2} H ${MID} M ${MID} ${y1} V ${y2} M ${MID} ${targetY} H 0`
}

function pathFinalFeed(sfY, finalY, side) {
  if (sfY === finalY) {
    if (side === 'left') return `M 0 ${sfY} H 100`
    return `M 100 ${sfY} H 0`
  }
  if (side === 'left') {
    return `M 0 ${sfY} H ${MID} V ${finalY} H 100`
  }
  return `M 100 ${sfY} H ${MID} V ${finalY} H 0`
}

function pathElbow(sourceY, targetY, side) {
  if (side === 'left') {
    return `M 0 ${sourceY} H ${MID} V ${targetY} H 100`
  }
  return `M 100 ${sourceY} H ${MID} V ${targetY} H 0`
}

function segmentPath(segment, side) {
  if (segment.type === 'pair') {
    const y1 = rowCenter(segment.rows[0])
    const y2 = rowCenter(segment.rows[1])
    return pathPair(y1, y2, segment.targetY, side)
  }
  if (segment.type === 'merge') {
    return pathMerge(segment.sourceYs, segment.targetY, side)
  }
  if (segment.type === 'finalFeed') {
    return pathFinalFeed(segment.sfY, segment.finalY, side)
  }
  if (segment.type === 'elbow') {
    return pathElbow(segment.sourceY, segment.targetY, side)
  }
  return ''
}

export default function BracketConnectorLane({ lane }) {
  if (!lane?.segments?.length) return null

  return (
    <div className={`bracket-lane bracket-lane--${lane.side}`} aria-hidden="true">
      <svg
        className="bracket-lane-svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {lane.segments.map((seg, i) => (
          <path
            key={i}
            className="bracket-lane-path"
            d={segmentPath(seg, lane.side)}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  )
}
