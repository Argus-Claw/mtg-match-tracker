import { classNames } from '../lib/helpers'
import './Button.css'

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  type = 'button',
  className,
  ...props
}) {
  return (
    <button
      type={type}
      className={classNames(
        'btn',
        `btn--${variant}`,
        `btn--${size}`,
        fullWidth && 'btn--full',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="btn__spinner" /> : children}
    </button>
  )
}
