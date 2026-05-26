'use client'
import { forwardRef } from 'react'

/** Input de goles: sin flechas; al escribir un dígito puede pasar al siguiente campo */
const ScoreInput = forwardRef(function ScoreInput(
  { value, onChange, disabled, ariaLabel, onFilled },
  ref
) {
  const hasValue = value !== '' && value !== undefined && value !== null
  const display = hasValue ? String(value) : ''

  function commit(raw) {
    const digits = raw.replace(/\D/g, '').slice(0, 2)
    if (digits === '') {
      onChange('')
      return
    }
    const n = parseInt(digits, 10)
    if (!Number.isNaN(n) && n >= 0 && n <= 20) onChange(String(n))
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className="schedule-score-input"
      value={display}
      disabled={disabled}
      aria-label={ariaLabel}
      onFocus={e => {
        requestAnimationFrame(() => e.target.select())
      }}
      onBlur={e => {
        const raw = e.target.value.replace(/\D/g, '')
        if (raw === '') {
          if (!hasValue) onChange('')
          return
        }
        commit(raw)
      }}
      onChange={e => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 2)
        const prevLen = String(value ?? '').replace(/\D/g, '').length
        onChange(digits)
        if (digits.length === 1 && prevLen === 0 && onFilled) {
          requestAnimationFrame(() => onFilled())
        }
      }}
    />
  )
})

export default ScoreInput
