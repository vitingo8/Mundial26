'use client'

export const inputRowStyles = {
  input: {
    flex: 1,
    background: 'var(--card)',
    border: '1.5px solid var(--border)',
    borderRadius: 12,
    padding: '13px 14px',
    color: 'var(--text)',
    fontSize: 16,
    outline: 'none',
    boxShadow: 'var(--card-shadow)',
    width: '100%',
    minWidth: 0,
  },
  inputUpper: {
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  row: {
    display: 'flex',
    gap: 8,
    width: '100%',
  },
  btn: {
    background: 'var(--card2)',
    border: '1.5px solid var(--accent-dark)',
    color: 'var(--accent-dark)',
    borderRadius: 12,
    padding: '13px 16px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, var(--accent-dark), var(--accent))',
    color: 'white',
    border: 'none',
    boxShadow: '0 4px 24px var(--accent-glow)',
  },
  label: {
    fontSize: 13,
    color: 'var(--muted)',
    fontWeight: 600,
    letterSpacing: 0.3,
    marginBottom: 6,
    display: 'block',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
}

export function InputRow({ uppercase, style, className = '', ...props }) {
  return (
    <input
      className={`input-touch ${className}`.trim()}
      style={{
        ...inputRowStyles.input,
        ...(uppercase ? inputRowStyles.inputUpper : {}),
        ...style,
      }}
      {...props}
    />
  )
}

export function InputActionRow({
  label,
  htmlFor,
  inputProps = {},
  buttonLabel,
  onAction,
  loading,
  primary,
}) {
  return (
    <div style={inputRowStyles.field}>
      {label && (
        <label style={inputRowStyles.label} htmlFor={htmlFor}>
          {label}
        </label>
      )}
      <div style={inputRowStyles.row}>
        <InputRow id={htmlFor} {...inputProps} />
        <button
          type="button"
          disabled={loading}
          onClick={onAction}
          style={{
            ...inputRowStyles.btn,
            ...(primary ? inputRowStyles.btnPrimary : {}),
            opacity: loading ? 0.7 : 1,
          }}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  )
}
