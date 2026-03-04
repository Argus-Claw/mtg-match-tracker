import { classNames } from '../lib/helpers'
import './Select.css'

export default function Select({
  label,
  options,
  error,
  className,
  placeholder,
  id,
  ...props
}) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className={classNames('input-group', className)}>
      {label && <label htmlFor={inputId} className="input-label">{label}</label>}
      <select
        id={inputId}
        className={classNames('select-field', error && 'select-field--error')}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => {
          const value = typeof opt === 'string' ? opt : opt.value
          const label = typeof opt === 'string' ? opt : opt.label
          return (
            <option key={value} value={value}>
              {label}
            </option>
          )
        })}
      </select>
      {error && <span className="input-error">{error}</span>}
    </div>
  )
}
