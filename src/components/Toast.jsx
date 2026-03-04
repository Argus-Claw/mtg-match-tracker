import { useToast } from '../context/ToastContext'

export default function Toast() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.type}`}>
          <span>{toast.message}</span>
          <button onClick={() => removeToast(toast.id)} aria-label="Dismiss">
            &times;
          </button>
        </div>
      ))}
    </div>
  )
}
