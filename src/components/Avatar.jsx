import './Avatar.css'

export default function Avatar({ src, name, size = 'md' }) {
  const initials = (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        className={`avatar avatar--${size}`}
      />
    )
  }

  return (
    <div className={`avatar avatar--${size} avatar--initials`} aria-label={name}>
      {initials}
    </div>
  )
}
