import './LoadingSpinner.css'

export default function LoadingSpinner({ size = 'md', text }) {
  return (
    <div className="spinner-container">
      <div className={`spinner spinner--${size}`} role="status">
        <span className="sr-only">Loading...</span>
      </div>
      {text && <p className="spinner-text">{text}</p>}
    </div>
  )
}
