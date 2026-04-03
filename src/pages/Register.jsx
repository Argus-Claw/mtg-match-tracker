import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabaseClient'
import Button from '../components/Button'
import Input from '../components/Input'
import Card from '../components/Card'
import './Auth.css'

export default function Register() {
  const { signUpWithEmail, signInWithGoogle } = useAuth()
  const { addToast } = useToast()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  function validate() {
    const errs = {}
    if (!displayName.trim()) errs.displayName = 'Display name is required'
    else if (displayName.trim().length < 2) errs.displayName = 'Display name must be at least 2 characters'
    else if (displayName.trim().length > 30) errs.displayName = 'Display name must be 30 characters or less'
    else if (!/^[a-zA-Z0-9_ -]+$/.test(displayName.trim())) errs.displayName = 'Letters, numbers, spaces, hyphens, and underscores only'
    if (!email.trim()) errs.email = 'Email is required'
    if (!password) errs.password = 'Password is required'
    else if (password.length < 6) errs.password = 'Password must be at least 6 characters'
    if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match'
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setLoading(true)
    try {
      // Check display name availability
      const { data: available, error: checkErr } = await supabase.rpc('check_display_name_available', { name: displayName.trim() })
      if (checkErr) throw checkErr
      if (!available) {
        setErrors({ displayName: 'This display name is already taken' })
        setLoading(false)
        return
      }
      await signUpWithEmail(email, password, displayName.trim())
      addToast('Account created! Check your email to confirm.', 'success')
    } catch (err) {
      addToast(err.message || 'Failed to create account', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    try {
      await signInWithGoogle()
    } catch (err) {
      addToast(err.message || 'Failed to sign in with Google', 'error')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <span className="auth-logo">⚔️</span>
          <h1>Create Account</h1>
          <p>Join the arena</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="auth-form">
            <Input
              label="Display Name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              error={errors.displayName}
              placeholder="Your name"
              autoComplete="name"
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              placeholder="At least 6 characters"
              autoComplete="new-password"
            />
            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={errors.confirmPassword}
              placeholder="Confirm your password"
              autoComplete="new-password"
            />
            <Button type="submit" fullWidth loading={loading}>
              Create Account
            </Button>
          </form>

          <div className="auth-links">
            <Link to="/login">Already have an account? Sign in</Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
