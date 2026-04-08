/**
 * useGameSession — real-time multiplayer game session management.
 *
 * Server-authoritative architecture:
 * - Host writes game state to game_sessions.game_state in Supabase (single write path)
 * - ALL clients derive displayed state from postgres_changes on game_sessions (DB is source of truth)
 * - Guests send player-scoped updates to host via broadcast; host merges and persists to DB
 * - Guests NEVER broadcast their local state back — they only READ from DB changes
 *
 * Flow: client makes change → host writes to DB → postgres_changes delivers to all → all re-render
 *
 * Resilience features:
 * - Guest fetches state from DB on join, reconnect, and stale detection
 * - Periodic heartbeat ping from host for connectivity detection
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

const HEARTBEAT_INTERVAL = 5000 // Host pings every 5s for connectivity detection
const GUEST_STALE_THRESHOLD = 12000 // Guest fetches from DB if no update in 12s
const RECONNECT_DELAY = 2000
const DB_WRITE_DEBOUNCE = 80 // Debounce DB writes for rapid taps

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
  const onFullStateRef = useRef(null) // callback for guest to receive authoritative state
  const onPlayerClaimRef = useRef(null) // callback when a player is claimed
  const reconnectTimerRef = useRef(null)
  const heartbeatTimerRef = useRef(null)
  const guestStaleTimerRef = useRef(null)
  const lastReceivedRef = useRef(0) // timestamp of last received message (guest)
  const sessionCodeRef = useRef(null) // for reconnection in visibility handler
  const sessionIdRef = useRef(null) // for DB writes
  const isHostRef = useRef(true)
  const connectedPlayersRef = useRef({}) // ref mirror for use in async/debounced callbacks
  const dbWriteTimerRef = useRef(null) // debounce timer for DB writes
  const claimedPlayerIdRef = useRef(null)
  const gameGenerationRef = useRef(0) // incremented on game reset
  const lastLocalTapAtRef = useRef(0) // timestamp of last guest optimistic tap

  // Keep connectedPlayers ref in sync with state
  useEffect(() => { connectedPlayersRef.current = connectedPlayers }, [connectedPlayers])

  // Register callbacks
  const setOnRemoteUpdate = useCallback((fn) => { onRemoteUpdateRef.current = fn }, [])
  const setOnFullState = useCallback((fn) => { onFullStateRef.current = fn }, [])
  const setOnPlayerClaim = useCallback((fn) => { onPlayerClaimRef.current = fn }, [])

  // Fetch current game state from DB (used by guest on join/reconnect/stale)
  const fetchGameState = useCallback(async (code) => {
    try {
      const { data, error } = await supabase
        .from('game_sessions')
        .select('game_state')
        .eq('code', code)
        .single()
      if (!error && data?.game_state?.players && onFullStateRef.current) {
        lastReceivedRef.current = Date.now()
        onFullStateRef.current(data.game_state)
      }
    } catch (err) {
      console.error('[GameSession] Failed to fetch state from DB:', err)
    }
  }, [])

  // Subscribe to a Supabase channel (broadcast for events + postgres_changes for state)
  const subscribeToChannel = useCallback((code, asHost) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    setIsChannelHealthy(false)

    const channel = supabase.channel(`game:${code}`, {
      config: { broadcast: { self: false } },
    })

    // --- DB-driven state sync (guests only) ---
    // Guests receive authoritative state via postgres_changes on game_sessions.
    // This is the ONLY path by which guests update game state — no broadcast state pushes.
    if (!asHost) {
      channel.on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_sessions',
        filter: `code=eq.${code}`,
      }, (payload) => {
        lastReceivedRef.current = Date.now()
        const gameState = payload.new.game_state
        if (gameState?.players && onFullStateRef.current) {
          onFullStateRef.current(gameState)
        }
      })
    }

    // --- Broadcast: guest sends player updates to host ---
    channel.on('broadcast', { event: 'player_update' }, ({ payload }) => {
      if (asHost && onRemoteUpdateRef.current) {
        onRemoteUpdateRef.current(payload)
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

    // Guest listens for heartbeat as connectivity signal
    channel.on('broadcast', { event: 'heartbeat' }, () => {
      lastReceivedRef.current = Date.now()
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
        // Guest: fetch current state from DB (replaces request_state broadcast)
        if (!asHost) {
          fetchGameState(code)
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
  }, [fetchGameState])

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
        } else if (!isHostRef.current) {
          // Channel looks alive — guest fetches fresh state from DB to catch up
          fetchGameState(sessionCodeRef.current)
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [subscribeToChannel, fetchGameState])

  // Guest: periodic stale detection — fetch state from DB if no update received recently
  useEffect(() => {
    if (!isMultiDevice || isHost) {
      clearInterval(guestStaleTimerRef.current)
      return
    }
    guestStaleTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastReceivedRef.current
      if (elapsed > GUEST_STALE_THRESHOLD) {
        console.log('[GameSession] Guest stale — fetching state from DB')
        if (sessionCodeRef.current) fetchGameState(sessionCodeRef.current)
        // Also ping to check connectivity
        if (channelRef.current) {
          channelRef.current.send({ type: 'broadcast', event: 'ping', payload: {} })
        }
      }
    }, GUEST_STALE_THRESHOLD / 2)
    return () => clearInterval(guestStaleTimerRef.current)
  }, [isMultiDevice, isHost, fetchGameState])

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
    sessionIdRef.current = data.id
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
    sessionIdRef.current = session.id
    setIsHost(false)
    isHostRef.current = false
    setIsMultiDevice(true)

    subscribeToChannel(session.code, false)

    return { session, userId }
  }, [subscribeToChannel])

  // Host: rejoin an existing session (for resume after page reload)
  const rejoinSession = useCallback(async (sessionId, sessionCode) => {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('status', 'active')
      .single()

    if (error || !data) {
      return { ok: false, reason: 'not_found' }
    }

    // Check if session is too old (>12 hours)
    const sessionAge = Date.now() - new Date(data.created_at).getTime()
    if (sessionAge > 12 * 60 * 60 * 1000) {
      return { ok: false, reason: 'too_old' }
    }

    setSessionCode(sessionCode)
    sessionCodeRef.current = sessionCode
    setSessionId(sessionId)
    sessionIdRef.current = sessionId
    setIsHost(true)
    isHostRef.current = true
    setIsMultiDevice(true)

    subscribeToChannel(sessionCode, true)

    return { ok: true, session: data }
  }, [subscribeToChannel])

  // Host: persist game state to DB (single write path — replaces broadcastFullState)
  // All connected guests receive the update via postgres_changes subscription.
  const persistGameState = useCallback((gameState) => {
    const sid = sessionIdRef.current
    if (!sid) return

    clearTimeout(dbWriteTimerRef.current)
    dbWriteTimerRef.current = setTimeout(() => {
      const payload = {
        ...gameState,
        connectedPlayers: connectedPlayersRef.current,
        _gen: gameGenerationRef.current,
        _ts: Date.now(),
      }
      supabase
        .from('game_sessions')
        .update({ game_state: payload })
        .eq('id', sid)
        .then(({ error }) => {
          if (error) console.error('[GameSession] DB write failed:', error)
        })
    }, DB_WRITE_DEBOUNCE)
  }, [])

  // Host: periodic heartbeat ping — connectivity signal for guests (no state payload)
  useEffect(() => {
    if (!isMultiDevice || !isHost) {
      clearInterval(heartbeatTimerRef.current)
      return
    }
    heartbeatTimerRef.current = setInterval(() => {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'heartbeat',
          payload: { _ts: Date.now() },
        })
      }
    }, HEARTBEAT_INTERVAL)
    return () => clearInterval(heartbeatTimerRef.current)
  }, [isMultiDevice, isHost])

  // Host: increment game generation (called on "Run it back" / game reset)
  const resetGameGeneration = useCallback(() => {
    gameGenerationRef.current += 1
  }, [])

  // Guest: send a player update to host via broadcast
  // No local state caching — guest accepts DB state as authoritative
  const sendPlayerUpdate = useCallback((playerId, updates) => {
    if (!channelRef.current || !isMultiDevice) return
    lastLocalTapAtRef.current = Date.now()
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
    clearTimeout(dbWriteTimerRef.current)

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
    sessionIdRef.current = null
    setIsMultiDevice(false)
    setIsChannelHealthy(false)
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
      clearInterval(heartbeatTimerRef.current)
      clearInterval(guestStaleTimerRef.current)
      clearTimeout(dbWriteTimerRef.current)
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
    rejoinSession,
    persistGameState,
    sendPlayerUpdate,
    claimPlayer,
    endSession,
    setOnRemoteUpdate,
    setOnFullState,
    setOnPlayerClaim,
    setConnectedPlayers,
    resetGameGeneration,
    lastLocalTapAtRef,
  }
}
