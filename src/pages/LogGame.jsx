import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useGames } from '../hooks/useGames'
import { useFriends } from '../hooks/useFriends'
import { FORMATS, DEFAULT_LIFE } from '../lib/constants'
import Button from '../components/Button'
import Card from '../components/Card'
import Input, { Textarea } from '../components/Input'
import Select from '../components/Select'
import ColorPicker from '../components/ColorPicker'
import './LogGame.css'

const EMPTY_PLAYER = {
  user_id: null,
  guest_name: '',
  deck_name: '',
  commander_name: '',
  commander_colors: [],
  starting_life: 40,
  ending_life: '',
  is_winner: false,
  kill_count: 0,
  commander_damage_dealt: {},
}

export default function LogGame() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { addToast } = useToast()
  const { createGame } = useGames()
  const { friends } = useFriends()
  const [saving, setSaving] = useState(false)
  const [quickMode, setQuickMode] = useState(false)
  const [showCmdDamage, setShowCmdDamage] = useState(false)

  const [format, setFormat] = useState('Commander')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [durationMinutes, setDurationMinutes] = useState('')
  const [turnCount, setTurnCount] = useState('')
  const [notes, setNotes] = useState('')

  const [players, setPlayers] = useState([
    { ...EMPTY_PLAYER, user_id: user?.id, guest_name: '' },
    { ...EMPTY_PLAYER },
  ])

  const isCommander = format === 'Commander' || format === 'Brawl'

  useEffect(() => {
    const life = DEFAULT_LIFE[format] || 20
    setPlayers((prev) =>
      prev.map((p) => ({ ...p, starting_life: life }))
    )
  }, [format])

  function updatePlayer(index, field, value) {
    setPlayers((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  function addPlayer() {
    setPlayers((prev) => [
      ...prev,
      { ...EMPTY_PLAYER, starting_life: DEFAULT_LIFE[format] || 20 },
    ])
  }

  function removePlayer(index) {
    if (players.length <= 2) return
    setPlayers((prev) => prev.filter((_, i) => i !== index))
  }

  function setWinner(index) {
    setPlayers((prev) =>
      prev.map((p, i) => ({ ...p, is_winner: i === index }))
    )
  }

  function addFriendAsPlayer(friend) {
    const alreadyAdded = players.some((p) => p.user_id === friend.id)
    if (alreadyAdded) {
      addToast('Player already added', 'warning')
      return
    }
    setPlayers((prev) => [
      ...prev,
      {
        ...EMPTY_PLAYER,
        user_id: friend.id,
        guest_name: '',
        starting_life: DEFAULT_LIFE[format] || 20,
      },
    ])
  }

  function getPlayerLabel(player, index) {
    if (player.user_id === user?.id) return profile?.display_name || 'You'
    if (player.user_id) {
      const f = friends.find((fr) => fr.friend.id === player.user_id)
      return f?.friend.display_name || 'Friend'
    }
    return player.guest_name || `Player ${index + 1}`
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!format) {
      addToast('Please select a format', 'error')
      return
    }

    const hasWinner = players.some((p) => p.is_winner)
    if (!hasWinner && !quickMode) {
      addToast('Please select a winner', 'error')
      return
    }

    // Validate guest names for non-user players
    for (let i = 0; i < players.length; i++) {
      if (!players[i].user_id && !players[i].guest_name.trim()) {
        addToast(`Please enter a name for Player ${i + 1}`, 'error')
        return
      }
    }

    setSaving(true)
    try {
      await createGame(
        {
          format,
          date,
          duration_minutes: durationMinutes ? parseInt(durationMinutes) : null,
          turn_count: turnCount ? parseInt(turnCount) : null,
          notes: notes.trim() || null,
        },
        players.map((p) => ({
          ...p,
          guest_name: p.user_id ? null : p.guest_name.trim(),
          ending_life: p.ending_life !== '' ? parseInt(p.ending_life) : null,
        }))
      )
      addToast('Game logged!', 'success')
      navigate('/games')
    } catch (err) {
      addToast(err.message || 'Failed to save game', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Log Game</h1>

      <div className="loggame-mode-toggle">
        <Button
          variant={quickMode ? 'ghost' : 'primary'}
          size="sm"
          onClick={() => setQuickMode(false)}
        >
          Full Log
        </Button>
        <Button
          variant={quickMode ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setQuickMode(true)}
        >
          Quick Log
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Game details */}
        <Card className="loggame-section">
          <h3>Game Details</h3>
          <div className="loggame-row">
            <Select
              label="Format"
              options={FORMATS}
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            />
            <Input
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          {!quickMode && (
            <div className="loggame-row">
              <Input
                label="Duration (minutes)"
                type="number"
                min="0"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="Optional"
              />
              <Input
                label="Turn Count"
                type="number"
                min="0"
                value={turnCount}
                onChange={(e) => setTurnCount(e.target.value)}
                placeholder="Optional"
              />
            </div>
          )}
        </Card>

        {/* Players */}
        <Card className="loggame-section">
          <div className="loggame-section-header">
            <h3>Players</h3>
            <Button type="button" variant="ghost" size="sm" onClick={addPlayer}>
              + Add Player
            </Button>
          </div>

          {/* Quick add friends */}
          {friends.length > 0 && (
            <div className="loggame-friends">
              <span className="input-label">Quick add friends:</span>
              <div className="loggame-friends-list">
                {friends.map((f) => (
                  <button
                    key={f.friend.id}
                    type="button"
                    className="loggame-friend-chip"
                    onClick={() => addFriendAsPlayer(f.friend)}
                  >
                    + {f.friend.display_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {players.map((player, index) => (
            <div key={index} className="player-card">
              <div className="player-card__header">
                <span className="player-card__label">
                  {getPlayerLabel(player, index)}
                  {player.user_id === user?.id && (
                    <span className="player-card__you">(you)</span>
                  )}
                </span>
                <div className="player-card__actions">
                  <Button
                    type="button"
                    variant={player.is_winner ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setWinner(index)}
                  >
                    {player.is_winner ? '👑 Winner' : 'Set Winner'}
                  </Button>
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
              </div>

              {/* Guest name input */}
              {!player.user_id && (
                <Input
                  label="Player Name"
                  value={player.guest_name}
                  onChange={(e) => updatePlayer(index, 'guest_name', e.target.value)}
                  placeholder="Guest name"
                />
              )}

              {!quickMode && (
                <>
                  <div className="loggame-row">
                    <Input
                      label="Deck Name"
                      value={player.deck_name}
                      onChange={(e) => updatePlayer(index, 'deck_name', e.target.value)}
                      placeholder="Deck name"
                    />
                    {isCommander && (
                      <Input
                        label="Commander"
                        value={player.commander_name}
                        onChange={(e) => updatePlayer(index, 'commander_name', e.target.value)}
                        placeholder="Commander name"
                      />
                    )}
                  </div>

                  {isCommander && (
                    <ColorPicker
                      label="Commander Colors"
                      selected={player.commander_colors}
                      onChange={(colors) => updatePlayer(index, 'commander_colors', colors)}
                    />
                  )}

                  <div className="loggame-row">
                    <Input
                      label="Starting Life"
                      type="number"
                      value={player.starting_life}
                      onChange={(e) => updatePlayer(index, 'starting_life', parseInt(e.target.value) || 0)}
                    />
                    <Input
                      label="Ending Life"
                      type="number"
                      value={player.ending_life}
                      onChange={(e) => updatePlayer(index, 'ending_life', e.target.value)}
                      placeholder="Optional"
                    />
                    <Input
                      label="Kill Count"
                      type="number"
                      min="0"
                      value={player.kill_count}
                      onChange={(e) => updatePlayer(index, 'kill_count', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Commander damage section */}
          {!quickMode && isCommander && (
            <div className="loggame-cmd-damage">
              <button
                type="button"
                className="loggame-cmd-toggle"
                onClick={() => setShowCmdDamage(!showCmdDamage)}
              >
                {showCmdDamage ? '▾' : '▸'} Commander Damage Dealt
              </button>
              {showCmdDamage && (
                <div className="loggame-cmd-grid">
                  {players.map((attacker, aIdx) => (
                    <div key={aIdx} className="loggame-cmd-row">
                      <span className="loggame-cmd-name">
                        {getPlayerLabel(attacker, aIdx)} dealt:
                      </span>
                      <div className="loggame-cmd-targets">
                        {players.map((target, tIdx) => {
                          if (aIdx === tIdx) return null
                          const targetId = target.user_id || `guest-${tIdx}`
                          return (
                            <Input
                              key={tIdx}
                              label={`→ ${getPlayerLabel(target, tIdx)}`}
                              type="number"
                              min="0"
                              value={attacker.commander_damage_dealt[targetId] || ''}
                              onChange={(e) => {
                                const dmg = { ...attacker.commander_damage_dealt }
                                if (e.target.value) {
                                  dmg[targetId] = parseInt(e.target.value)
                                } else {
                                  delete dmg[targetId]
                                }
                                updatePlayer(aIdx, 'commander_damage_dealt', dmg)
                              }}
                              placeholder="0"
                            />
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Notes */}
        {!quickMode && (
          <Card className="loggame-section">
            <Textarea
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any memorable plays, combos, or notes about the game..."
            />
          </Card>
        )}

        {/* Submit */}
        <div className="loggame-submit">
          <Button type="submit" size="lg" fullWidth loading={saving}>
            Save Game
          </Button>
        </div>
      </form>
    </div>
  )
}
