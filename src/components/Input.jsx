import { classNames } from '../lib/helpers'
import './Input.css'

export default function Input({
  label,
  error,
  className,
  id,
  ...props
}) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className={classNames('input-group', className)}>
      {label && <label htmlFor={inputId} className="input-label">{label}</label>}
      <input
        id={inputId}
        className={classNames('input-field', error && 'input-field--error')}
        {...props}
      />
      {error && <span className="input-error">{error}</span>}
    </div>
  )
}

export function Textarea({ label, error, className, id, ...props }) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className={classNames('input-group', className)}>
      {label && <label htmlFor={inputId} className="input-label">{label}</label>}
      <textarea
        id={inputId}
        className={classNames('input-field input-field--textarea', error && 'input-field--error')}
        {...props}
      />
      {error && <span className="input-error">{error}</span>}
    </div>
  )
}
