import { COLORS } from '../lib/constants'
import './ColorPicker.css'

export default function ColorPicker({ selected = [], onChange, label }) {
  function toggleColor(code) {
    if (selected.includes(code)) {
      onChange(selected.filter((c) => c !== code))
    } else {
      onChange([...selected, code])
    }
  }

  return (
    <div className="color-picker">
      {label && <span className="input-label">{label}</span>}
      <div className="color-picker__options" role="group" aria-label="Commander colors">
        {COLORS.map((color) => (
          <button
            key={color.code}
            type="button"
            className={`color-pip color-pip--${color.code.toLowerCase()} ${
              selected.includes(color.code) ? 'color-pip--selected' : ''
            }`}
            onClick={() => toggleColor(color.code)}
            aria-pressed={selected.includes(color.code)}
            aria-label={color.name}
            title={color.name}
          >
            {color.symbol}
          </button>
        ))}
      </div>
    </div>
  )
}
