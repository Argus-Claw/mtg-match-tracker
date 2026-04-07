/**
 * useGameSession — real-time multiplayer game session management.
 *
 * Uses Supabase Broadcast channels for instant state sync.
 * Host is source of truth — broadcasts full state on every change + periodic heartbeat.
 * Guests send player-scoped updates that the host merges.
 *
 * Resilience features:
 * - Periodic heartbeat broadcast from host (every 5s) ensures eventual sync
 * - Guest stale detection — requests fresh state if no update received in 10s
 * - Reconnect on tab visibility change (mobile browsers kill WebSockets in background)
 * - Connection health tracking with isChannelHealthy state
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

const HEARTBEAT_INTERVAL = 5000 // Host broadcasts state every 5s
const GUEST_STALE_THRESHOLD = 12000 // Guest requests state if no update in 12s
const RECONNECT_DELAY = 2000

export function useGameSession() {
  const [sessionCode, setSessionCode] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [isMultiDevice, setIsMultiDevice] = useState(false)
  const [isHost, setIsHost] = useState(true)
  const [isChannelHealthy, setIsChannelHealthy] = useState(false)
  const [connectedPlayers, setConnectedPlayers] = useState({}) // { claimedPlayerId: { userId, displayName } }
  const [claimedPlayerId, setClaimedPlayerId] = useState(null) // guest's own claimed player
  const channelRef = useRef(null)
  const onRemoteUpdateRef = useRef(null) // callback for host to receive guest updates
  const onFullStateRef = useRef(null) // callback for guest to receive host state
  const onPlayerClaimRef = useRef(null) // callback when a player is claimed
  const reconnectTimerRef = useRef(null)
  const heartbeatTimerRef = useRef(null)
  const guestStaleTimerRef = useRef(null)
  const lastReceivedRef = useRef(0) // timestamp of last received message (guest)
  const sessionCodeRef = useRef(null) // for reconnection in visibility handler
  const isHostRef = useRef(true)
  const broadcastFullStateRef = useRef(null) // latest broadcastFullState for heartbeat
  const guestLocalStateRef = useRef(null) // guest's local player state for resync after reconnect
  const claimedPlayerIdRef = useRef(null)
  const gameGenerationRef = useRef(0) // incremented on game reset — tells guests to accept host state unconditionally
  const lastSeenGenRef = useRef(0) // guest tracks the last generation it saw

  // Register callbacks
  const setOnRemoteUpdate = useCallback((fn) => { onRemoteUpdateRef.current = fn }, [])
  const setOnFullState = useCallback((fn) => { onFullStateRef.current = fn }, [])
  const setOnPlayerClaim = useCallback((fn) => { onPlayerClaimRef.current = fn }, [])

  // Subscribe to a Supabase Broadcast channel
  const subscribeToChannel = useCallback((code, asHost) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    setIsChannelHealthy(false)

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
      lastReceivedRef.current = Date.now()
      if (!asHost && onFullStateRef.current) {
        // If the host incremented the game generation (e.g. "Run it back"),
        // clear guest local state so we accept the reset unconditionally
        if (payload._gen !== undefined && payload._gen > lastSeenGenRef.current) {
          lastSeenGenRef.current = payload._gen
          guestLocalStateRef.current = null
        }
        // Before applying host state, re-send our local state if we have pending changes
        // This handles the case where guest tapped while disconnected
        if (guestLocalStateRef.current && claimedPlayerIdRef.current) {
          const localPlayer = guestLocalStateRef.current
          const remotePlayer = payload.players?.find(p => String(p.id) === String(claimedPlayerIdRef.current))
          if (remotePlayer && localPlayer.life !== remotePlayer.life) {
            // Our local state differs — re-send our player state to host
            channel.send({
              type: 'broadcast',
              event: 'player_update',
              payload: {
                playerId: claimedPlayerIdRef.current,
                updates: {
                  life: localPlayer.life,
                  poison: localPlayer.poison,
                  energy: localPlayer.energy,
                  experience: localPlayer.experience,
                  commanderDamage: localPlayer.commanderDamage,
                },
                type: 'player_update',
              },
            })
            // Don't apply host state for our player — keep local optimistic state
            // The host will merge our update and broadcast back the corrected state
            const correctedPayload = {
              ...payload,
              players: payload.players.map(p =>
                String(p.id) === String(claimedPlayerIdRef.current) ? { ...p, ...localPlayer } : p
              ),
            }
            onFullStateRef.current(correctedPayload)
            return
          }
        }
        onFullStateRef.current(payload)
      }
    })

    // Both listen for heartbeat (guest uses it as connectivity signal)
    channel.on('broadcast', { event: 'heartbeat' }, ({ payload }) => {
      lastReceivedRef.current = Date.now()
      // Heartbeat carries full state for guests — treat same as full_state
      if (!asHost && onFullStateRef.current && payload.players) {
        // Check for game generation change (reset)
        if (payload._gen !== undefined && payload._gen > lastSeenGenRef.current) {
          lastSeenGenRef.current = payload._gen
          guestLocalStateRef.current = null
        }
        // Same resync logic as full_state
        if (guestLocalStateRef.current && claimedPlayerIdRef.current) {
          const localPlayer = guestLocalStateRef.current
          const remotePlayer = payload.players?.find(p => String(p.id) === String(claimedPlayerIdRef.current))
          if (remotePlayer && localPlayer.life !== remotePlayer.life) {
            channel.send({
              type: 'broadcast',
              event: 'player_update',
              payload: {
                playerId: claimedPlayerIdRef.current,
                updates: {
                  life: localPlayer.life,
                  poison: localPlayer.poison,
                  energy: localPlayer.energy,
                  experience: localPlayer.experience,
                  commanderDamage: localPlayer.commanderDamage,
                },
                type: 'player_update',
              },
            })
            const correctedPayload = {
              ...payload,
              players: payload.players.map(p =>
                String(p.id) === String(claimedPlayerIdRef.current) ? { ...p, ...localPlayer } : p
              ),
            }
            onFullStateRef.current(correctedPayload)
            return
          }
        }
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
        if (onRemoteUpdateRef.current) {
          onRemoteUpdateRef.current({ type: 'request_state' })
        }
      }
    })

    // Guest listens for pong (response to ping)
    channel.on('broadcast', { event: 'pong' }, () => {
      lastReceivedRef.current = Date.now()
      setIsChannelHealthy(true)
    })

    // Host listens for ping and responds with pong
    channel.on('broadcast', { event: 'ping' }, () => {
      if (asHost) {
        channel.send({ type: 'broadcast', event: 'pong', payload: {} })
      }
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setIsChannelHealthy(true)
        lastReceivedRef.current = Date.now()
        // Guest requests current state on join
        if (!asHost) {
          channel.send({ type: 'broadcast', event: 'request_state', payload: {} })
        }
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setIsChannelHealthy(false)
        // Attempt reconnect
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = setTimeout(() => {
          subscribeToChannel(code, asHost)
        }, RECONNECT_DELAY)
      }
      if (status === 'CLOSED') {
        setIsChannelHealthy(false)
      }
    })

    channelRef.current = channel
    return channel
  }, [])

  // Reconnect on tab visibility change (mobile browsers kill WebSockets in background)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && sessionCodeRef.current && channelRef.current) {
        // Check if channel is still alive by inspecting state
        const state = channelRef.current.state
        if (state !== 'joined' && state !== 'joining') {
          // Channel died while backgrounded — reconnect
          console.log('[GameSession] Tab visible, channel state:', state, '— reconnecting')
          subscribeToChannel(sessionCodeRef.current, isHostRef.current)
        } else {
          // Channel looks alive — guest should request fresh state to catch up
          if (!isHostRef.current) {
            channelRef.current.send({ type: 'broadcast', event: 'request_state', payload: {} })
          }
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [subscribeToChannel])

  // Guest: periodic stale detection — request state if no update received recently
  useEffect(() => {
    if (!isMultiDevice || isHost) {
      clearInterval(guestStaleTimerRef.current)
      return
    }
    guestStaleTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastReceivedRef.current
      if (elapsed > GUEST_STALE_THRESHOLD && channelRef.current) {
        console.log('[GameSession] Guest stale — requesting fresh state')
        channelRef.current.send({ type: 'broadcast', event: 'request_state', payload: {} })
        // Also ping to check connectivity
        channelRef.current.send({ type: 'broadcast', event: 'ping', payload: {} })
      }
    }, GUEST_STALE_THRESHOLD / 2)
    return () => clearInterval(guestStaleTimerRef.current)
  }, [isMultiDevice, isHost])

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
    sessionCodeRef.current = code
    setSessionId(data.id)
    setIsHost(true)
    isHostRef.current = true
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
    sessionCodeRef.current = session.code
    setSessionId(session.id)
    setIsHost(false)
    isHostRef.current = false
    setIsMultiDevice(true)

    subscribeToChannel(session.code, false)

    return { session, userId }
  }, [subscribeToChannel])

  // Host: broadcast full game state to all guests
  const broadcastFullState = useCallback((gameState) => {
    if (!channelRef.current || !isMultiDevice) return
    const payload = {
      ...gameState,
      connectedPlayers: connectedPlayers,
      _ts: Date.now(), // timestamp for debugging
      _gen: gameGenerationRef.current, // game generation — increments on reset
    }
    channelRef.current.send({
      type: 'broadcast',
      event: 'full_state',
      payload,
    })
    // Cache for heartbeat use
    broadcastFullStateRef.current = payload
  }, [isMultiDevice, connectedPlayers])

  // Host: periodic heartbeat broadcast — ensures guests stay synced even if change-based broadcasts are missed
  useEffect(() => {
    if (!isMultiDevice || !isHost) {
      clearInterval(heartbeatTimerRef.current)
      return
    }
    heartbeatTimerRef.current = setInterval(() => {
      if (channelRef.current && broadcastFullStateRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'heartbeat',
          payload: { ...broadcastFullStateRef.current, _ts: Date.now() },
        })
      }
    }, HEARTBEAT_INTERVAL)
    return () => clearInterval(heartbeatTimerRef.current)
  }, [isMultiDevice, isHost])

  // Host: increment game generation (called on "Run it back" / game reset)
  // Tells all guests to discard cached local state and accept host state unconditionally
  const resetGameGeneration = useCallback(() => {
    gameGenerationRef.current += 1
  }, [])

  // Guest: send a player update to host (and cache locally for resync)
  const sendPlayerUpdate = useCallback((playerId, updates) => {
    // Cache the latest state for resync after reconnect
    guestLocalStateRef.current = { ...(guestLocalStateRef.current || {}), ...updates }
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
    claimedPlayerIdRef.current = playerId

    channelRef.current.send({
      type: 'broadcast',
      event: 'player_claimed',
      payload: { playerId, userId, displayName },
    })
  }, [])

  // End session
  const endSession = useCallback(async () => {
    clearInterval(heartbeatTimerRef.current)
    clearInterval(guestStaleTimerRef.current)

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
    sessionCodeRef.current = null
    setSessionId(null)
    setIsMultiDevice(false)
    setIsChannelHealthy(false)
    setConnectedPlayers({})
    setClaimedPlayerId(null)
    broadcastFullStateRef.current = null
    clearTimeout(reconnectTimerRef.current)
  }, [isHost, sessionId, claimedPlayerId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
      clearTimeout(reconnectTimerRef.current)
      clearInterval(heartbeatTimerRef.current)
      clearInterval(guestStaleTimerRef.current)
    }
  }, [])

  return {
    sessionCode,
    sessionId,
    isMultiDevice,
    isHost,
    isChannelHealthy,
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
    resetGameGeneration,
  }
}
