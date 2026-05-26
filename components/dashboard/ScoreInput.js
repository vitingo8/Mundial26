'use client'
import { forwardRef } from 'react'
import { queueScoreFocus } from '../../lib/scheduleScoreFocus'

/** Input de goles: sin flechas; al escribir un dígito puede pasar al siguiente campo */
const ScoreInput = forwardRef(function ScoreInput(
  { value, onChange, disabled, ariaLabel, onFilled, scoreSide },
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

  function shouldAdvanceAfterDigit(e) {
    if (disabled || !onFilled) return false
    if (e.key.length !== 1 || !/[0-9]/.test(e.key)) return false
    if (e.altKey || e.ctrlKey || e.metaKey) return false

    const input = e.currentTarget
    const raw = String(value ?? '').replace(/\D/g, '')
    const len = input.value?.length ?? 0
    const start = input.selectionStart ?? 0
    const end = input.selectionEnd ?? 0
    const hasSelection = start !== end
    const allSelected = hasSelection && start === 0 && end === len

    if (raw.length === 0) return true
    if (allSelected) return true
    return false
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className="schedule-score-input"
      data-score-side={scoreSide}
      value={display}
      disabled={disabled}
      aria-label={ariaLabel}
      onFocus={e => {
        requestAnimationFrame(() => e.target.select())
      }}
      onKeyDown={e => {
        if (!shouldAdvanceAfterDigit(e)) return
        queueScoreFocus(onFilled)
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
        // Respaldo si el teclado numérico no emite keydown (móvil)
        if (digits.length === 1 && prevLen === 0 && onFilled) {
          queueScoreFocus(onFilled)
        }
      }}
    />
  )
})

export default ScoreInput
