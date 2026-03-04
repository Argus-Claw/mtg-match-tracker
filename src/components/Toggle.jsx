import './Toggle.css'

export default function Toggle({ checked, onChange, label, id }) {
  const toggleId = id || 'toggle-' + (label || '').replace(/\s+/g, '-')

  return (
    <label className="toggle" htmlFor={toggleId}>
      <input
        type="checkbox"
        id={toggleId}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="toggle__input"
      />
      <span className="toggle__track">
        <span className="toggle__thumb" />
      </span>
      {label && <span className="toggle__label">{label}</span>}
    </label>
  )
}
