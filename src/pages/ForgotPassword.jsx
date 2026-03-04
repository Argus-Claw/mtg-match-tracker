import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Button from '../components/Button'
import Input from '../components/Input'
import Card from '../components/Card'
import './Auth.css'

export default function ForgotPassword() {
  const { resetPassword } = useAuth()
  const { addToast } = useToast()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) {
      addToast('Please enter your email', 'error')
      return
    }
    setLoading(true)
    try {
      await resetPassword(email)
      setSent(true)
      addToast('Reset link sent! Check your email.', 'success')
    } catch (err) {
      addToast(err.message || 'Failed to send reset link', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <span className="auth-logo">🔑</span>
          <h1>Reset Password</h1>
          <p>We&apos;ll send you a reset link</p>
        </div>

        <Card>
          {sent ? (
            <div className="auth-success">
              <h3>Check your email</h3>
              <p>
                We sent a password reset link to <strong>{email}</strong>.
                Click the link in the email to reset your password.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
              <Button type="submit" fullWidth loading={loading}>
                Send Reset Link
              </Button>
            </form>
          )}

          <div className="auth-links" style={{ justifyContent: 'center', marginTop: '1.25rem' }}>
            <Link to="/login">Back to sign in</Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
