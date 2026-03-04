import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStats } from '../hooks/useStats'
import { useAuth } from '../context/AuthContext'
import Card from '../components/Card'
import Button from '../components/Button'
import LoadingSpinner from '../components/LoadingSpinner'
import { formatRelativeDate, getPlayerName, getWinRate } from '../lib/helpers'
import { FORMAT_ICONS } from '../lib/constants'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import './Dashboard.css'

const CHART_COLORS = [
  '#818cf8', '#f472b6', '#34d399', '#fbbf24', '#f87171',
  '#60a5fa', '#a78bfa', '#fb923c', '#4ade80',
]

function getActiveGame() {
  try {
    const raw = localStorage.getItem('mtg-active-game')
    if (!raw) return null
    const data = JSON.parse(raw)
    // Only show if within the last 24 hours
    if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem('mtg-active-game')
      return null
    }
    return data
  } catch {
    return null
  }
}

function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  return 'over a day ago'
}

export default function Dashboard() {
  const { profile } = useAuth()
  const { stats, loading } = useStats()
  const navigate = useNavigate()
  const [activeGame, setActiveGame] = useState(getActiveGame)

  if (loading) {
    return <LoadingSpinner size="lg" text="Loading dashboard..." />
  }

  const resumeBanner = activeGame && (
    <Card className="resume-banner" onClick={() => navigate('/games/new', { state: { resume: true } })}>
      <div className="resume-banner__content">
        <div className="resume-banner__info">
          <span className="resume-banner__title">Game in Progress</span>
          <span className="resume-banner__details">
            {FORMAT_ICONS[activeGame.format]} {activeGame.format} &middot; {activeGame.players?.length || '?'} players &middot; saved {timeAgo(activeGame.timestamp)}
          </span>
        </div>
        <Button size="sm">Resume</Button>
      </div>
    </Card>
  )

  if (!stats || stats.totalGames === 0) {
    return (
      <div className="page">
        {resumeBanner}
        <div className="dashboard-welcome">
          <h1>Welcome{profile?.display_name ? `, ${profile.display_name}` : ''}!</h1>
          <p>Start tracking your MTG games to see your stats here.</p>
          <Link to="/games/new">
            <Button size="lg">Start Your First Game</Button>
          </Link>
        </div>
      </div>
    )
  }

  const formatData = Object.entries(stats.formatStats).map(([name, data]) => ({
    name,
    value: data.games,
  }))

  return (
    <div className="page">
      {resumeBanner}

      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <Link to="/games/new">
          <Button>New Game</Button>
        </Link>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        <Card className="stat-card">
          <span className="stat-card__label">Win Rate</span>
          <span className="stat-card__value">{stats.winRate}%</span>
          <span className="stat-card__sub">
            {stats.totalWins}W / {stats.totalGames - stats.totalWins}L
          </span>
        </Card>
        <Card className="stat-card">
          <span className="stat-card__label">Games Played</span>
          <span className="stat-card__value">{stats.totalGames}</span>
        </Card>
        <Card className="stat-card">
          <span className="stat-card__label">Win Streak</span>
          <span className="stat-card__value">{stats.currentStreak}</span>
          <span className="stat-card__sub">Best: {stats.bestStreak}</span>
        </Card>
        <Card className="stat-card">
          <span className="stat-card__label">Favorite Deck</span>
          <span className="stat-card__value stat-card__value--sm">
            {stats.favoriteDeck?.name || '—'}
          </span>
          {stats.favoriteDeck && (
            <span className="stat-card__sub">
              {stats.favoriteDeck.games} games, {getWinRate(stats.favoriteDeck.wins, stats.favoriteDeck.games)}% WR
            </span>
          )}
        </Card>
      </div>

      {/* Games by format chart */}
      {formatData.length > 0 && (
        <Card className="dashboard-chart">
          <h3>Games by Format</h3>
          <div className="dashboard-chart__container">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={formatData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {formatData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="dashboard-chart__legend">
              {formatData.map((item, i) => (
                <div key={item.name} className="dashboard-chart__legend-item">
                  <span
                    className="dashboard-chart__legend-dot"
                    style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span>{FORMAT_ICONS[item.name]} {item.name}</span>
                  <span className="dashboard-chart__legend-count">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Recent games */}
      <Card className="dashboard-recent">
        <div className="dashboard-recent__header">
          <h3>Recent Games</h3>
          <Link to="/games">View All</Link>
        </div>
        <div className="dashboard-recent__list">
          {stats.recentGames.map((game) => {
            const myPlayer = game.game_players.find(
              (p) => p.user_id === profile?.id
            )
            const won = myPlayer?.is_winner
            return (
              <div key={game.id} className="game-row">
                <div className="game-row__left">
                  <span className={`game-row__result ${won ? 'game-row__result--win' : 'game-row__result--loss'}`}>
                    {won ? 'W' : 'L'}
                  </span>
                  <div>
                    <span className="game-row__format">
                      {FORMAT_ICONS[game.format]} {game.format}
                    </span>
                    {myPlayer?.deck_name && (
                      <span className="game-row__deck">{myPlayer.deck_name}</span>
                    )}
                  </div>
                </div>
                <div className="game-row__right">
                  <span className="game-row__players">
                    {game.game_players.length} players
                  </span>
                  <span className="game-row__date">
                    {formatRelativeDate(game.date)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
