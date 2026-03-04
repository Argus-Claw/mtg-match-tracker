import { useStats } from '../hooks/useStats'
import { getWinRate } from '../lib/helpers'
import { FORMAT_ICONS, COLOR_MAP } from '../lib/constants'
import Card from '../components/Card'
import LoadingSpinner from '../components/LoadingSpinner'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import './Stats.css'

const CHART_COLORS = [
  '#818cf8', '#f472b6', '#34d399', '#fbbf24', '#f87171',
  '#60a5fa', '#a78bfa', '#fb923c', '#4ade80',
]

const MTG_COLOR_HEX = {
  W: '#F9FAF4',
  U: '#0E68AB',
  B: '#6b21a8',
  R: '#D3202A',
  G: '#00733E',
}

const tooltipStyle = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
}

export default function Stats() {
  const { stats, loading } = useStats()

  if (loading) {
    return <LoadingSpinner size="lg" text="Crunching numbers..." />
  }

  if (!stats || stats.totalGames === 0) {
    return (
      <div className="page">
        <h1 className="page-title">Stats</h1>
        <div className="empty-state">
          <h3>No stats yet</h3>
          <p>Log some games to see your statistics here.</p>
        </div>
      </div>
    )
  }

  // Prepare format data
  const formatData = Object.entries(stats.formatStats)
    .map(([name, data]) => ({
      name,
      games: data.games,
      winRate: getWinRate(data.wins, data.games),
    }))
    .sort((a, b) => b.games - a.games)

  // Prepare deck data (top 10)
  const deckData = Object.entries(stats.deckStats)
    .map(([name, data]) => ({
      name: name.length > 15 ? name.slice(0, 15) + '...' : name,
      fullName: name,
      games: data.games,
      winRate: getWinRate(data.wins, data.games),
    }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 10)

  // Prepare commander data (top 10)
  const commanderData = Object.entries(stats.commanderStats)
    .map(([name, data]) => ({
      name: name.length > 15 ? name.slice(0, 15) + '...' : name,
      fullName: name,
      games: data.games,
      winRate: getWinRate(data.wins, data.games),
      colors: data.colors,
    }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 10)

  // Prepare color data
  const colorData = Object.entries(stats.colorStats)
    .map(([code, data]) => ({
      name: COLOR_MAP[code]?.name || code,
      code,
      games: data.games,
      winRate: getWinRate(data.wins, data.games),
    }))
    .sort((a, b) => 'WUBRG'.indexOf(a.code) - 'WUBRG'.indexOf(b.code))

  // Prepare timeline data (sample every N points for performance)
  const timeline = stats.timelineData
  const step = Math.max(1, Math.floor(timeline.length / 50))
  const sampledTimeline = timeline.filter((_, i) => i % step === 0 || i === timeline.length - 1)

  return (
    <div className="page">
      <h1 className="page-title">Stats</h1>

      {/* Overview cards */}
      <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
        <Card className="stat-card">
          <span className="stat-card__label">Win Rate</span>
          <span className="stat-card__value">{stats.winRate}%</span>
        </Card>
        <Card className="stat-card">
          <span className="stat-card__label">Total Games</span>
          <span className="stat-card__value">{stats.totalGames}</span>
        </Card>
        <Card className="stat-card">
          <span className="stat-card__label">Total Wins</span>
          <span className="stat-card__value">{stats.totalWins}</span>
        </Card>
        <Card className="stat-card">
          <span className="stat-card__label">Best Streak</span>
          <span className="stat-card__value">{stats.bestStreak}</span>
        </Card>
      </div>

      {/* Win rate over time */}
      {sampledTimeline.length > 1 && (
        <Card className="stats-chart">
          <h3>Win Rate Over Time</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={sampledTimeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
                tickFormatter={(v) => {
                  const d = new Date(v + 'T00:00:00')
                  return `${d.getMonth() + 1}/${d.getDate()}`
                }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v) => [`${v}%`, 'Win Rate']}
              />
              <Line
                type="monotone"
                dataKey="winRate"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Win rate by format */}
      {formatData.length > 0 && (
        <Card className="stats-chart">
          <h3>Win Rate by Format</h3>
          <ResponsiveContainer width="100%" height={Math.max(200, formatData.length * 40)}>
            <BarChart data={formatData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                width={90}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, name, props) => [
                  `${v}% (${props.payload.games} games)`,
                  'Win Rate',
                ]}
              />
              <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                {formatData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Win rate by deck */}
      {deckData.length > 0 && (
        <Card className="stats-chart">
          <h3>Win Rate by Deck</h3>
          <ResponsiveContainer width="100%" height={Math.max(200, deckData.length * 40)}>
            <BarChart data={deckData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                width={120}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, name, props) => [
                  `${v}% (${props.payload.games} games)`,
                  props.payload.fullName,
                ]}
              />
              <Bar dataKey="winRate" fill="var(--accent)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Win rate by color identity */}
      {colorData.length > 0 && (
        <Card className="stats-chart">
          <h3>Win Rate by Color Identity</h3>
          <div className="stats-color-grid">
            {colorData.map((c) => (
              <div key={c.code} className="stats-color-card">
                <div
                  className="stats-color-pip"
                  style={{ background: MTG_COLOR_HEX[c.code] }}
                />
                <span className="stats-color-name">{c.name}</span>
                <span className="stats-color-wr">{c.winRate}%</span>
                <span className="stats-color-games">{c.games} games</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Head-to-head */}
      {stats.opponentStats.length > 0 && (
        <Card className="stats-chart">
          <h3>Head-to-Head Records</h3>
          <div className="stats-h2h">
            {stats.opponentStats.slice(0, 10).map((opp) => (
              <div key={opp.name} className="stats-h2h-row">
                <span className="stats-h2h-name">{opp.name}</span>
                <div className="stats-h2h-bar-container">
                  <div
                    className="stats-h2h-bar"
                    style={{ width: `${getWinRate(opp.wins, opp.games)}%` }}
                  />
                </div>
                <span className="stats-h2h-record">
                  {opp.wins}-{opp.games - opp.wins} ({getWinRate(opp.wins, opp.games)}%)
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Commander stats */}
      {commanderData.length > 0 && (
        <Card className="stats-chart">
          <h3>Commander Records</h3>
          <div className="stats-table">
            {commanderData.map((cmd) => (
              <div key={cmd.fullName} className="stats-table-row">
                <div>
                  <span className="stats-table-name">{cmd.fullName}</span>
                  {cmd.colors.length > 0 && (
                    <span className="stats-table-colors">
                      {cmd.colors.join('')}
                    </span>
                  )}
                </div>
                <span className="stats-table-wr">
                  {cmd.winRate}% ({cmd.games}g)
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
