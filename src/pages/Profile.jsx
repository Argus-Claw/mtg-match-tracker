import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabaseClient'
import { useStats } from '../hooks/useStats'
import { getWinRate } from '../lib/helpers'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Toggle from '../components/Toggle'
import Avatar from '../components/Avatar'
import LoadingSpinner from '../components/LoadingSpinner'
import './Profile.css'

export default function Profile() {
  const { user, profile, updateProfile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { addToast } = useToast()
  const { stats, loading: statsLoading } = useStats()

  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)

  async function handleSave() {
    const name = displayName.trim()
    if (!name) {
      addToast('Display name cannot be empty', 'error')
      return
    }
    if (name.length < 2) {
      addToast('Display name must be at least 2 characters', 'error')
      return
    }
    if (name.length > 30) {
      addToast('Display name must be 30 characters or less', 'error')
      return
    }
    if (!/^[a-zA-Z0-9_ -]+$/.test(name)) {
      addToast('Letters, numbers, spaces, hyphens, and underscores only', 'error')
      return
    }
    setSaving(true)
    try {
      // Check uniqueness if name changed
      if (name.toLowerCase() !== (profile?.display_name || '').toLowerCase()) {
        const { data: available, error: checkErr } = await supabase.rpc('check_display_name_available', { name })
        if (checkErr) throw checkErr
        if (!available) {
          addToast('This display name is already taken', 'error')
          setSaving(false)
          return
        }
      }
      await updateProfile({
        display_name: name,
        avatar_url: avatarUrl.trim() || null,
      })
      addToast('Profile updated!', 'success')
      setEditing(false)
    } catch (err) {
      addToast(err.message || 'Failed to update profile', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Profile</h1>

      {/* Profile card */}
      <Card className="profile-card">
        <div className="profile-header">
          <Avatar
            src={profile?.avatar_url}
            name={profile?.display_name}
            size="xl"
          />
          {!editing ? (
            <div className="profile-info">
              <h2>{profile?.display_name}</h2>
              <p className="profile-email">{user?.email}</p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setEditing(true)}
              >
                Edit Profile
              </Button>
            </div>
          ) : (
            <div className="profile-edit">
              <Input
                label="Display Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <Input
                label="Avatar URL"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
              />
              <div className="profile-edit__actions">
                <Button size="sm" loading={saving} onClick={handleSave}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(false)
                    setDisplayName(profile?.display_name || '')
                    setAvatarUrl(profile?.avatar_url || '')
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Stats summary */}
      <Card className="profile-stats">
        <h3>Your Stats</h3>
        {statsLoading ? (
          <LoadingSpinner size="sm" />
        ) : stats && stats.totalGames > 0 ? (
          <div className="profile-stats-grid">
            <div className="profile-stat">
              <span className="profile-stat__value">{stats.totalGames}</span>
              <span className="profile-stat__label">Games</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat__value">{stats.winRate}%</span>
              <span className="profile-stat__label">Win Rate</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat__value">{stats.bestStreak}</span>
              <span className="profile-stat__label">Best Streak</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat__value">
                {Object.keys(stats.formatStats).length}
              </span>
              <span className="profile-stat__label">Formats</span>
            </div>
          </div>
        ) : (
          <p className="friends-empty">No games logged yet.</p>
        )}
      </Card>

      {/* Settings */}
      <Card className="profile-settings">
        <h3>Settings</h3>
        <div className="profile-setting-row">
          <div>
            <span className="profile-setting-label">Dark Mode</span>
            <span className="profile-setting-desc">
              Toggle between light and dark theme
            </span>
          </div>
          <Toggle
            checked={theme === 'dark'}
            onChange={toggleTheme}
            id="theme-toggle"
          />
        </div>
      </Card>

      {/* Sign out */}
      <div className="profile-signout">
        <Button variant="secondary" fullWidth onClick={signOut}>
          Sign Out
        </Button>
      </div>
    </div>
  )
}
