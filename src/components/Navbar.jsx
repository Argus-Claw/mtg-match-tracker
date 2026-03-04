import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import './Navbar.css'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '🏠' },
  { path: '/games/new', label: 'New Game', icon: '🎮' },
  { path: '/games', label: 'History', icon: '📋' },
  { path: '/stats', label: 'Stats', icon: '📊' },
  { path: '/friends', label: 'Friends', icon: '👥' },
]

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  if (!user) return null

  return (
    <>
      {/* Top bar */}
      <header className="topbar">
        <Link to="/" className="topbar__brand">
          <span className="topbar__icon">⚔️</span>
          <span className="topbar__title">MTG Tracker</span>
        </Link>

        <div className="topbar__actions">
          <button
            className="topbar__theme-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          <button
            className="topbar__menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            <Link to="/profile" className="topbar__profile-link" onClick={(e) => e.stopPropagation()}>
              {profile?.display_name?.[0]?.toUpperCase() || '?'}
            </Link>
          </button>
        </div>
      </header>

      {/* Desktop sidebar nav hidden on mobile — we use bottom nav on mobile */}
      <nav className="desktop-nav" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`desktop-nav__link ${
              location.pathname === item.path ? 'desktop-nav__link--active' : ''
            }`}
          >
            <span className="desktop-nav__icon">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
        <Link
          to="/profile"
          className={`desktop-nav__link ${
            location.pathname === '/profile' ? 'desktop-nav__link--active' : ''
          }`}
        >
          <span className="desktop-nav__icon">⚙️</span>
          <span>Profile</span>
        </Link>
        <button className="desktop-nav__link desktop-nav__signout" onClick={signOut}>
          <span className="desktop-nav__icon">🚪</span>
          <span>Sign Out</span>
        </button>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`bottom-nav__link ${
              location.pathname === item.path ? 'bottom-nav__link--active' : ''
            }`}
          >
            <span className="bottom-nav__icon">{item.icon}</span>
            <span className="bottom-nav__label">{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
