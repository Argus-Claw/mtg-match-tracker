import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useGameSession } from '../hooks/useGameSession'
import GameSession from '../components/GameSession'
import LoadingSpinner from '../components/LoadingSpinner'
import './JoinGame.css'

export default function JoinGame() {
  const { sessionCode } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [gameState, setGameState] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
  const [playerName, setPlayerName] = useState('')

  const gameSession = useGameSession()

  // Join the session on mount
  useEffect(() => {
    let mounted = true
    async function join() {
      try {
        const { session: sess } = await gameSession.joinSession(sessionCode)
        if (mounted) setSession(sess)
      } catch (err) {
        if (mounted) setError(err.message)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    join()
    return () => { mounted = false }
  }, [sessionCode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for full state from host
  useEffect(() => {
    gameSession.setOnFullState((payload) => {
      setGameState(payload)
      // If we're already claimed, we stay in game view
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle claiming a player
  const handleClaim = async () => {
    if (!selectedPlayerId) return
    setClaiming(true)
    try {
      const name = playerName.trim() || gameState.players?.find(p => p.id === selectedPlayerId)?.name || 'Guest'
      await gameSession.claimPlayer(selectedPlayerId, name)
      setClaimed(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setClaiming(false)
    }
  }

  if (loading) {
    return (
      <div className="join-game">
        <div className="join-game__loading">
          <LoadingSpinner />
          <p>Connecting to game...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="join-game">
        <div className="join-game__error">
          <h2>Unable to Join</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/')} className="join-game__home-btn">Go Home</button>
        </div>
      </div>
    )
  }

  // Waiting for host to send initial state
  if (!gameState || !gameState.players) {
    return (
      <div className="join-game">
        <div className="join-game__loading">
          <LoadingSpinner />
          <p>Waiting for host...</p>
          <span className="join-game__code">Game: {sessionCode}</span>
        </div>
      </div>
    )
  }

  // Player selection screen (before claiming)
  if (!claimed) {
    const alreadyClaimed = gameState.connectedPlayers || {}
    return (
      <div className="join-game">
        <div className="join-game__select">
          <h2>Join Game</h2>
          <p className="join-game__format">{session?.format} &middot; {gameState.players?.length} players</p>
          <p className="join-game__hint">Tap your name to join as that player. If you disconnected, tap your slot to rejoin.</p>

          <div className="join-game__players">
            {gameState.players?.map(p => {
              const isClaimed = !!alreadyClaimed[p.id]
              const isSelected = selectedPlayerId === p.id
              return (
                <button
                  key={p.id}
                  className={`join-game__player ${isSelected ? 'join-game__player--selected' : ''} ${isClaimed ? 'join-game__player--claimed' : ''}`}
                  onClick={() => setSelectedPlayerId(p.id)}
                >
                  <span className="join-game__player-name">{p.name}</span>
                  <span className="join-game__player-life">{p.life} life</span>
                  {isClaimed && !isSelected && <span className="join-game__player-tag">Active</span>}
                  {isSelected && <span className="join-game__player-tag join-game__player-tag--you">You</span>}
                </button>
              )
            })}
          </div>

          {selectedPlayerId && (
            <button
              className="join-game__claim-btn"
              onClick={handleClaim}
              disabled={claiming}
            >
              {claiming ? 'Joining...' : 'Join Game'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // Claimed — render the game view as a guest
  return (
    <GameSession
      format={session.format}
      startingLife={session.starting_life}
      setupPlayers={[]}
      getPlayerLabel={() => ''}
      user={null}
      friends={[]}
      onEndGame={() => {
        gameSession.endSession()
        navigate('/')
      }}
      // Multiplayer props
      multiplayerSession={gameSession}
      guestClaimedPlayerId={gameSession.claimedPlayerId}
      initialRemoteState={gameState}
    />
  )
}
