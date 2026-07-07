'use client'

import BracketMatchSlot from './BracketMatchSlot'
import BracketConnectorLane from './BracketConnectorLane'
import { lookupBracketPred } from '../../lib/knockoutBridge'
import { resolveApiRawForMatch } from '../../lib/apiMatchScores'

function SlotCell({ rowStart, rowSpan = 1, children }) {
  return (
    <div
      className="bracket-cell"
      style={{ gridRow: `${rowStart + 1} / span ${rowSpan}` }}
    >
      <div className="bracket-cell-inner">{children}</div>
    </div>
  )
}

function PairBlock({ rowStart, matches, getMatch, ...slotProps }) {
  return matches.map((n, idx) => {
    const m = getMatch(n)
    return (
      <SlotCell key={n} rowStart={rowStart + idx} rowSpan={1}>
        <BracketMatchSlot
          match={m}
          pred={lookupBracketPred(slotProps.preds, m)}
          apiRaw={m ? resolveApiRawForMatch(m, slotProps.rawById) : null}
          userPred={slotProps.userPreds?.[m?.id]}
          matchRef={el => {
            if (slotProps.matchRefs && m) slotProps.matchRefs.current[m.id] = el
          }}
          {...slotProps}
        />
      </SlotCell>
    )
  })
}

function BracketColumnGrid({ column, getMatch, ...slotProps }) {
  return (
    <div className="bracket-column-grid">
      {column.pairs?.map(pair => (
        <PairBlock
          key={pair.matches.join('-')}
          rowStart={pair.rowStart}
          matches={pair.matches}
          getMatch={getMatch}
          {...slotProps}
        />
      ))}
      {column.slots?.map(slot => {
        const m = getMatch(slot.match)
        return (
          <SlotCell key={slot.match} rowStart={slot.rowStart} rowSpan={slot.rowSpan}>
            <BracketMatchSlot
              match={m}
              pred={lookupBracketPred(slotProps.preds, m)}
              apiRaw={m ? resolveApiRawForMatch(m, slotProps.rawById) : null}
              userPred={slotProps.userPreds?.[m?.id]}
              matchRef={el => {
                if (slotProps.matchRefs && m) slotProps.matchRefs.current[m.id] = el
              }}
              {...slotProps}
            />
          </SlotCell>
        )
      })}
    </div>
  )
}

function BracketColumn({ column, getMatch, lane, ...slotProps }) {
  const { id, label } = column

  return (
    <section className={`bracket-column bracket-column--${column.side} bracket-column--${id}`} aria-label={label}>
      <header className="bracket-column-label">{label}</header>
      <div className="bracket-column-body">
        <BracketColumnGrid column={column} getMatch={getMatch} {...slotProps} />
        {lane && lane}
      </div>
    </section>
  )
}

export function BracketCenterOut({
  leftColumns,
  rightColumns,
  leftLanes,
  rightLanes,
  finalMatch,
  thirdMatch,
  getMatch,
  ...slotProps
}) {
  return (
    <div className="bracket-center-out">
      {leftColumns.map((col, i) => (
        <BracketColumn
          key={`l-${col.id}`}
          column={col}
          getMatch={getMatch}
          lane={leftLanes[i] ? <BracketConnectorLane lane={leftLanes[i]} /> : null}
          {...slotProps}
        />
      ))}

      <section className="bracket-column bracket-column--center" aria-label="Final">
        <header className="bracket-column-label">Final</header>
        <div className="bracket-column-body bracket-column-body--center">
          <div className="bracket-column-grid bracket-column-grid--center">
            <div className="bracket-center-final-cell">
              <img
                src="/icon-192.png"
                alt=""
                className="bracket-final-logo"
                width={40}
                height={40}
              />
              <BracketMatchSlot
                match={finalMatch}
                pred={lookupBracketPred(slotProps.preds, finalMatch)}
                apiRaw={finalMatch ? slotProps.rawById?.[finalMatch.id] : null}
                userPred={slotProps.userPreds?.[finalMatch?.id]}
                matchRef={el => {
                  if (slotProps.matchRefs && finalMatch) slotProps.matchRefs.current[finalMatch.id] = el
                }}
                {...slotProps}
              />
            </div>
            <div className="bracket-center-third-cell">
              <span className="bracket-center-sublabel">3.er puesto</span>
              <BracketMatchSlot
                match={thirdMatch}
                pred={lookupBracketPred(slotProps.preds, thirdMatch)}
                apiRaw={thirdMatch ? slotProps.rawById?.[thirdMatch.id] : null}
                userPred={slotProps.userPreds?.[thirdMatch?.id]}
                matchRef={el => {
                  if (slotProps.matchRefs && thirdMatch) slotProps.matchRefs.current[thirdMatch.id] = el
                }}
                {...slotProps}
              />
            </div>
          </div>
          {rightLanes[0] ? <BracketConnectorLane lane={rightLanes[0]} /> : null}
        </div>
      </section>

      {rightColumns.map((col, i) => (
        <BracketColumn
          key={`r-${col.id}`}
          column={col}
          getMatch={getMatch}
          lane={rightLanes[i + 1] ? <BracketConnectorLane lane={rightLanes[i + 1]} /> : null}
          {...slotProps}
        />
      ))}
    </div>
  )
}
