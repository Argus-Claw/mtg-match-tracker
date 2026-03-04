/**
 * useGameSession — scaffolding for multi-device game sessions.
 *
 * Architecture:
 * - A game_sessions table (to be created in Supabase) would store:
 *   { id, code (6-char), host_user_id, format, starting_life, status (active/ended), created_at }
 * - A game_session_players table:
 *   { id, session_id, user_id, guest_name, player_state (JSON: life, poison, energy, etc.) }
 *
 * Multi-device flow:
 * 1. Host creates a session → gets a 6-char code
 * 2. Players join via code → subscribe to Supabase Realtime channel
 * 3. Each player controls their own state, broadcasts changes
 * 4. Host can end the game → saves to games/game_players tables
 *
 * Current implementation: single-device mode only.
 * All state is managed locally in GameSession component.
 * This hook provides the interface that would be used when multi-device is enabled.
 */

import { useState, useCallback } from 'react'

export function useGameSession() {
  const [sessionCode, setSessionCode] = useState(null)
  const [isMultiDevice, setIsMultiDevice] = useState(false)
  const [isHost, setIsHost] = useState(true)

  // Generate a 6-character alphanumeric code
  const generateCode = useCallback(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 for clarity
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
  }, [])

  // Scaffold: create a new session (would insert into game_sessions table)
  const createSession = useCallback(async (/* format, startingLife */) => {
    const code = generateCode()
    setSessionCode(code)
    setIsHost(true)
    setIsMultiDevice(true)
    // TODO: Insert into game_sessions table
    // TODO: Subscribe to Supabase Realtime channel `game:${code}`
    return code
  }, [generateCode])

  // Scaffold: join an existing session by code
  const joinSession = useCallback(async (/* code */) => {
    // TODO: Look up game_sessions by code
    // TODO: Insert into game_session_players
    // TODO: Subscribe to Supabase Realtime channel `game:${code}`
    setIsHost(false)
    setIsMultiDevice(true)
  }, [])

  // Scaffold: broadcast player state change to other devices
  const broadcastUpdate = useCallback((/* playerId, updates */) => {
    // TODO: supabase.channel(`game:${sessionCode}`).send({ type: 'broadcast', event: 'player_update', payload: { playerId, updates } })
  }, [sessionCode])

  // Scaffold: end session
  const endSession = useCallback(async () => {
    // TODO: Update game_sessions status to 'ended'
    // TODO: Unsubscribe from Realtime channel
    setSessionCode(null)
    setIsMultiDevice(false)
  }, [])

  return {
    sessionCode,
    isMultiDevice,
    isHost,
    createSession,
    joinSession,
    broadcastUpdate,
    endSession,
  }
}
