/**
 * useGameSession — real-time multiplayer game session management.
 *
 * Uses Supabase Broadcast channels for instant state sync.
 * Host is source of truth — broadcasts full state on every change.
 * Guests send player-scoped updates that the host merges.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// Generate a 6-character alphanumeric code (no I/O/0/1 for clarity)
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function generateCode() {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return code
}

export function useGameSession() {
  const [sessionCode, setSessionCode] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [isMultiDevice, setIsMultiDevice] = useState(false)
  const [isHost, setIsHost] = useState(true)
  const [connectedPlayers, setConnectedPlayers] = useState({}) // { claimedPlayerId: { userId, displayName } }
  const [claimedPlayerId, setClaimedPlayerId] = useState(null) // guest's own claimed player
  const channelRef = useRef(null)
  const onRemoteUpdateRef = useRef(null) // callback for host to receive guest updates
  const onFullStateRef = useRef(null) // callback for guest to receive host state
  const onPlayerClaimRef = useRef(null) // callback when a player is claimed
  const reconnectTimerRef = useRef(null)

  // Register callbacks
  const setOnRemoteUpdate = useCallback((fn) => { onRemoteUpdateRef.current = fn }, [])
  const setOnFullState = useCallback((fn) => { onFullStateRef.current = fn }, [])
  const setOnPlayerClaim = useCallback((fn) => { onPlayerClaimRef.current = fn }, [])

  // Subscribe to a Supabase Broadcast channel
  const subscribeToChannel = useCallback((code, asHost) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase.channel(`game:${code}`, {
      config: { broadcast: { self: false } },
    })

    // Host listens for guest player updates
    channel.on('broadcast', { event: 'player_update' }, ({ payload }) => {
      if (asHost && onRemoteUpdateRef.current) {
        onRemoteUpdateRef.current(payload)
      }
    })

    // Guest listens for full state from host
    channel.on('broadcast', { event: 'full_state' }, ({ payload }) => {
      if (!asHost && onFullStateRef.current) {
        onFullStateRef.current(payload)
      }
    })

    // Both listen for player claim events
    channel.on('broadcast', { event: 'player_claimed' }, ({ payload }) => {
      setConnectedPlayers(prev => ({
        ...prev,
        [payload.playerId]: { userId: payload.userId, displayName: payload.displayName },
      }))
      if (onPlayerClaimRef.current) {
        onPlayerClaimRef.current(payload)
      }
    })

    // Listen for player disconnect
    channel.on('broadcast', { event: 'player_disconnected' }, ({ payload }) => {
      setConnectedPlayers(prev => {
        const next = { ...prev }
        delete next[payload.playerId]
        return next
      })
    })

    // Host broadcasts connected players list to new joiners
    channel.on('broadcast', { event: 'request_state' }, () => {
      if (asHost) {
        // Host will broadcast current state (handled by the component)
        if (onRemoteUpdateRef.current) {
          onRemoteUpdateRef.current({ type: 'request_state' })
        }
      }
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Guest requests current state on join
        if (!asHost) {
          channel.send({ type: 'broadcast', event: 'request_state', payload: {} })
        }
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        // Attempt reconnect
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = setTimeout(() => {
          subscribeToChannel(code, asHost)
        }, 2000)
      }
    })

    channelRef.current = channel
    return channel
  }, [])

  // Host: create a new session
  const createSession = useCallback(async (format, startingLife) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Must be logged in to share a game')

    const code = generateCode()

    const { data, error } = await supabase
      .from('game_sessions')
      .insert({
        code,
        host_user_id: user.id,
        format,
        starting_life: startingLife,
        game_state: {},
        status: 'active',
      })
      .select()
      .single()

    if (error) throw error

    setSessionCode(code)
    setSessionId(data.id)
    setIsHost(true)
    setIsMultiDevice(true)
    setConnectedPlayers({})

    subscribeToChannel(code, true)

    return { code, sessionId: data.id }
  }, [subscribeToChannel])

  // Guest: join a session by code
  const joinSession = useCallback(async (code) => {
    // Look up the session
    const { data: session, error } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('status', 'active')
      .single()

    if (error || !session) throw new Error('Game session not found or has ended')

    // Sign in anonymously if not authenticated
    const { data: { user } } = await supabase.auth.getUser()
    let userId = user?.id
    if (!userId) {
      const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously()
      if (anonError) throw anonError
      userId = anonData.user.id
    }

    setSessionCode(session.code)
    setSessionId(session.id)
    setIsHost(false)
    setIsMultiDevice(true)

    subscribeToChannel(session.code, false)

    return { session, userId }
  }, [subscribeToChannel])

  // Host: broadcast full game state to all guests
  const broadcastFullState = useCallback((gameState) => {
    if (!channelRef.current || !isMultiDevice) return
    channelRef.current.send({
      type: 'broadcast',
      event: 'full_state',
      payload: {
        ...gameState,
        connectedPlayers: connectedPlayers,
      },
    })
  }, [isMultiDevice, connectedPlayers])

  // Guest: send a player update to host
  const sendPlayerUpdate = useCallback((playerId, updates) => {
    if (!channelRef.current || !isMultiDevice) return
    channelRef.current.send({
      type: 'broadcast',
      event: 'player_update',
      payload: { playerId, updates, type: 'player_update' },
    })
  }, [isMultiDevice])

  // Guest: claim a player slot
  const claimPlayer = useCallback(async (playerId, displayName) => {
    if (!channelRef.current) return
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id

    setClaimedPlayerId(playerId)

    channelRef.current.send({
      type: 'broadcast',
      event: 'player_claimed',
      payload: { playerId, userId, displayName },
    })
  }, [])

  // End session
  const endSession = useCallback(async () => {
    if (channelRef.current) {
      // Notify others
      if (isHost) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'session_ended',
          payload: {},
        })
      } else if (claimedPlayerId) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'player_disconnected',
          payload: { playerId: claimedPlayerId },
        })
      }
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    // Update DB status if host
    if (isHost && sessionId) {
      await supabase
        .from('game_sessions')
        .update({ status: 'ended' })
        .eq('id', sessionId)
        .catch(() => {}) // best-effort
    }

    setSessionCode(null)
    setSessionId(null)
    setIsMultiDevice(false)
    setConnectedPlayers({})
    setClaimedPlayerId(null)
    clearTimeout(reconnectTimerRef.current)
  }, [isHost, sessionId, claimedPlayerId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
      clearTimeout(reconnectTimerRef.current)
    }
  }, [])

  return {
    sessionCode,
    sessionId,
    isMultiDevice,
    isHost,
    connectedPlayers,
    claimedPlayerId,
    createSession,
    joinSession,
    broadcastFullState,
    sendPlayerUpdate,
    claimPlayer,
    endSession,
    setOnRemoteUpdate,
    setOnFullState,
    setOnPlayerClaim,
    setConnectedPlayers,
  }
}
