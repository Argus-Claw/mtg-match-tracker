import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useFriends } from '../hooks/useFriends'
import { FORMATS, DEFAULT_LIFE } from '../lib/constants'
import Button from '../components/Button'
import Card from '../components/Card'
import Input from '../components/Input'
import Select from '../components/Select'
import ColorPicker from '../components/ColorPicker'
import GameSession from '../components/GameSession'
import './NewGame.css'

const MANA_COLORS = ['W', 'U', 'B', 'R', 'G']

function makePlayer(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    user_id: null,
    guest_name: '',
    deck_name: '',
    commander_name: '',
    commander_colors: [],
    ...overrides,
  }
}

export default function NewGame() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile } = useAuth()
  const { addToast } = useToast()
  const { friends } = useFriends()

  // Check for resume state
  const [resumeState, setResumeState] = useState(null)

  // Setup wizard state
  const [step, setStep] = useState(1)
  const [format, setFormat] = useState('Commander')
  const [players, setPlayers] = useState([
    makePlayer({ user_id: user?.id, guest_name: '' }),
    makePlayer(),
  ])

  // Game session state — once started, we show the life tracker
  const [gameStarted, setGameStarted] = useState(false)

  // Handle resume from Dashboard
  useEffect(() => {
    if (location.state?.resume) {
      try {
        const raw = localStorage.getItem('mtg-active-game')
        if (raw) {
          const saved = JSON.parse(raw)
          if (Date.now() - saved.timestamp <= 24 * 60 * 60 * 1000) {
            setResumeState(saved)
            setFormat(saved.format)
            setGameStarted(true)
            // Clear the location state to avoid re-resuming on refresh
            navigate(location.pathname, { replace: true, state: {} })
            return
          }
        }
      } catch { /* ignore parse errors */ }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isCommander = format === 'Commander' || format === 'Brawl'
  const startingLife = DEFAULT_LIFE[format] || 20

  function updatePlayer(index, field, value) {
    setPlayers(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  function addPlayer() {
    if (players.length >= 6) {
      addToast('Maximum 6 players', 'warning')
      return
    }
    setPlayers(prev => [...prev, makePlayer()])
  }

  function removePlayer(index) {
    if (players.length <= 2) return
    setPlayers(prev => prev.filter((_, i) => i !== index))
  }

  function addFriendAsPlayer(friend) {
    if (players.some(p => p.user_id === friend.id)) {
      addToast('Player already added', 'warning')
      return
    }
    if (players.length >= 6) {
      addToast('Maximum 6 players', 'warning')
      return
    }
    setPlayers(prev => [
      ...prev,
      makePlayer({ user_id: friend.id, guest_name: '' }),
    ])
  }

  function getPlayerLabel(player, index) {
    if (player.user_id === user?.id) return profile?.display_name || 'You'
    if (player.user_id) {
      const f = friends.find(fr => fr.friend.id === player.user_id)
      return f?.friend.display_name || 'Friend'
    }
    return player.guest_name || `Player ${index + 1}`
  }

  function canProceed() {
    if (step === 1) return !!format
    if (step === 2) {
      if (players.length < 2) return false
      return players.every(p => p.user_id || p.guest_name.trim())
    }
    if (step === 3) return true // decks are optional
    return false
  }

  function handleNext() {
    if (!canProceed()) {
      if (step === 2) {
        addToast('All players need a name', 'error')
      }
      return
    }
    if (step < 3) {
      setStep(step + 1)
    }
  }

  function handleStartGame() {
    if (!canProceed()) return
    setGameStarted(true)
  }

  // If game is started, render the full-screen GameSession
  if (gameStarted) {
    return (
      <GameSession
        format={resumeState?.format || format}
        startingLife={resumeState?.startingLife || startingLife}
        setupPlayers={players}
        getPlayerLabel={getPlayerLabel}
        user={user}
        friends={friends}
        onEndGame={() => navigate('/games')}
        resumeState={resumeState}
      />
    )
  }

  return (
    <div className="page">
      <h1 className="page-title">New Game</h1>

      {/* Step indicator */}
      <div className="newgame-steps">
        {[1, 2, 3].map(s => (
          <button
            key={s}
            type="button"
            className={`newgame-step ${step === s ? 'newgame-step--active' : ''} ${s < step ? 'newgame-step--done' : ''}`}
            onClick={() => s < step && setStep(s)}
          >
            <span className="newgame-step__num">{s < step ? '✓' : s}</span>
            <span className="newgame-step__label">
              {s === 1 ? 'Format' : s === 2 ? 'Players' : 'Decks'}
            </span>
          </button>
        ))}
      </div>

      {/* Step 1: Format */}
      {step === 1 && (
        <Card className="newgame-section">
          <h3>Select Format</h3>
          <div className="newgame-format-grid">
            {FORMATS.map(f => (
              <button
                key={f}
                type="button"
                className={`newgame-format-btn ${format === f ? 'newgame-format-btn--active' : ''}`}
                onClick={() => setFormat(f)}
              >
                {f}
                <span className="newgame-format-life">{DEFAULT_LIFE[f]} life</span>
              </button>
            ))}
          </div>
          <div className="newgame-nav">
            <div />
            <Button onClick={handleNext} disabled={!canProceed()}>
              Next: Players
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Players */}
      {step === 2 && (
        <Card className="newgame-section">
          <div className="newgame-section-header">
            <h3>Add Players</h3>
            <Button type="button" variant="ghost" size="sm" onClick={addPlayer}>
              + Add Player
            </Button>
          </div>

          {friends.length > 0 && (
            <div className="newgame-friends">
              <span className="input-label">Quick add friends:</span>
              <div className="newgame-friends-list">
                {friends.map(f => (
                  <button
                    key={f.friend.id}
                    type="button"
                    className="newgame-friend-chip"
                    onClick={() => addFriendAsPlayer(f.friend)}
                  >
                    + {f.friend.display_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {players.map((player, index) => (
            <div key={player.id} className="newgame-player">
              <div className="newgame-player__header">
                <span className="newgame-player__label">
                  {getPlayerLabel(player, index)}
                  {player.user_id === user?.id && (
                    <span className="newgame-player__you"> (you)</span>
                  )}
                </span>
                {players.length > 2 && player.user_id !== user?.id && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removePlayer(index)}
                  >
                    &times;
                  </Button>
                )}
              </div>
              {!player.user_id && (
                <Input
                  label="Player Name"
                  value={player.guest_name}
                  onChange={e => updatePlayer(index, 'guest_name', e.target.value)}
                  placeholder="Enter name"
                />
              )}
            </div>
          ))}

          <div className="newgame-nav">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={handleNext} disabled={!canProceed()}>
              Next: Decks
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Decks */}
      {step === 3 && (
        <Card className="newgame-section">
          <h3>Deck Setup</h3>
          <p className="newgame-hint">
            Optional — you can also edit these during the game.
          </p>

          {players.map((player, index) => (
            <div key={player.id} className="newgame-deck-card">
              <h4 className="newgame-deck-card__name">
                {getPlayerLabel(player, index)}
              </h4>
              <Input
                label="Deck Name"
                value={player.deck_name}
                onChange={e => updatePlayer(index, 'deck_name', e.target.value)}
                placeholder="e.g. Mono Red Aggro"
              />
              {isCommander && (
                <>
                  <Input
                    label="Commander"
                    value={player.commander_name}
                    onChange={e => updatePlayer(index, 'commander_name', e.target.value)}
                    placeholder="e.g. Atraxa, Praetors' Voice"
                  />
                  <ColorPicker
                    label="Commander Colors"
                    selected={player.commander_colors}
                    onChange={colors => updatePlayer(index, 'commander_colors', colors)}
                  />
                </>
              )}
            </div>
          ))}

          <div className="newgame-nav">
            <Button variant="ghost" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button onClick={handleStartGame} size="lg">
              Start Game
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
