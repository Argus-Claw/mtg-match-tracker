import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useGames } from '../hooks/useGames'
import { FORMATS, FORMAT_ICONS } from '../lib/constants'
import { formatDate, getPlayerName, getColorIdentityString } from '../lib/helpers'
import Card from '../components/Card'
import Button from '../components/Button'
import Select from '../components/Select'
import Input from '../components/Input'
import Modal from '../components/Modal'
import LoadingSpinner from '../components/LoadingSpinner'
import './GameHistory.css'

export default function GameHistory() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const { games, loading, fetchGames, deleteGame } = useGames()
  const [expandedId, setExpandedId] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Filters
  const [filterFormat, setFilterFormat] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterDeck, setFilterDeck] = useState('')

  function applyFilters() {
    fetchGames({
      format: filterFormat || undefined,
      dateFrom: filterFrom || undefined,
      dateTo: filterTo || undefined,
    })
  }

  function clearFilters() {
    setFilterFormat('')
    setFilterFrom('')
    setFilterTo('')
    setFilterDeck('')
    fetchGames()
  }

  const filteredGames = filterDeck
    ? games.filter((g) =>
        g.game_players.some(
          (p) =>
            p.user_id === user.id &&
            p.deck_name?.toLowerCase().includes(filterDeck.toLowerCase())
        )
      )
    : games

  async function handleDelete(gameId) {
    setDeleting(true)
    try {
      await deleteGame(gameId)
      addToast('Game deleted', 'success')
      setDeleteConfirm(null)
    } catch (err) {
      addToast(err.message || 'Failed to delete', 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <LoadingSpinner size="lg" text="Loading games..." />
  }

  return (
    <div className="page">
      <div className="dashboard-header">
        <h1 className="page-title">Game History</h1>
        <Link to="/games/new">
          <Button>New Game</Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="history-filters">
        <div className="history-filters__row">
          <Select
            label="Format"
            options={[{ value: '', label: 'All Formats' }, ...FORMATS]}
            value={filterFormat}
            onChange={(e) => setFilterFormat(e.target.value)}
          />
          <Input
            label="Deck"
            value={filterDeck}
            onChange={(e) => setFilterDeck(e.target.value)}
            placeholder="Filter by deck..."
          />
        </div>
        <div className="history-filters__row">
          <Input
            label="From"
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
          />
          <Input
            label="To"
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
          />
        </div>
        <div className="history-filters__actions">
          <Button size="sm" onClick={applyFilters}>
            Apply
          </Button>
          <Button size="sm" variant="ghost" onClick={clearFilters}>
            Clear
          </Button>
        </div>
      </Card>

      {/* Games list */}
      {filteredGames.length === 0 ? (
        <div className="empty-state">
          <h3>No games found</h3>
          <p>Try adjusting your filters or start a new game.</p>
          <Link to="/games/new">
            <Button>New Game</Button>
          </Link>
        </div>
      ) : (
        <div className="history-list">
          {filteredGames.map((game) => {
            const myPlayer = game.game_players.find((p) => p.user_id === user.id)
            const won = myPlayer?.is_winner
            const expanded = expandedId === game.id
            const isCreator = game.created_by === user.id

            return (
              <Card
                key={game.id}
                className="history-game"
                padding={false}
              >
                <button
                  className="history-game__summary"
                  onClick={() => setExpandedId(expanded ? null : game.id)}
                  aria-expanded={expanded}
                >
                  <span className={`game-row__result ${won ? 'game-row__result--win' : 'game-row__result--loss'}`}>
                    {won ? 'W' : 'L'}
                  </span>
                  <div className="history-game__info">
                    <span className="history-game__format">
                      {FORMAT_ICONS[game.format]} {game.format}
                    </span>
                    <span className="history-game__meta">
                      {formatDate(game.date)} · {game.game_players.length} players
                    </span>
                  </div>
                  {myPlayer?.deck_name && (
                    <span className="history-game__deck">{myPlayer.deck_name}</span>
                  )}
                  <span className="history-game__chevron">
                    {expanded ? '▾' : '▸'}
                  </span>
                </button>

                {expanded && (
                  <div className="history-game__details">
                    {/* Players */}
                    <div className="history-game__players">
                      <h4>Players</h4>
                      {game.game_players.map((p) => (
                        <div key={p.id} className="history-player">
                          <div className="history-player__info">
                            <span className="history-player__name">
                              {p.is_winner && '👑 '}
                              {getPlayerName(p)}
                            </span>
                            {p.deck_name && (
                              <span className="history-player__deck">
                                {p.deck_name}
                                {p.commander_name && ` — ${p.commander_name}`}
                              </span>
                            )}
                            {p.commander_colors?.length > 0 && (
                              <span className="history-player__colors">
                                {getColorIdentityString(p.commander_colors)}
                              </span>
                            )}
                          </div>
                          <div className="history-player__stats">
                            {p.ending_life != null && (
                              <span>Life: {p.starting_life} → {p.ending_life}</span>
                            )}
                            {p.kill_count > 0 && (
                              <span>Kills: {p.kill_count}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Game metadata */}
                    <div className="history-game__meta-details">
                      {game.duration_minutes && (
                        <span>Duration: {game.duration_minutes} min</span>
                      )}
                      {game.turn_count && (
                        <span>Turns: {game.turn_count}</span>
                      )}
                      {game.notes && (
                        <p className="history-game__notes">{game.notes}</p>
                      )}
                    </div>

                    {isCreator && (
                      <div className="history-game__actions">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setDeleteConfirm(game.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Delete confirmation */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Game"
      >
        <p style={{ marginBottom: '1rem' }}>
          Are you sure you want to delete this game? This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={deleting}
            onClick={() => handleDelete(deleteConfirm)}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  )
}
