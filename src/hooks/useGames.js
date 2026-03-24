import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export function useGames() {
  const { user } = useAuth()
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchGames = useCallback(async (filters = {}) => {
    if (!user) return
    setLoading(true)

    let query = supabase
      .from('games')
      .select(`
        *,
        game_players (
          *,
          profiles:user_id (display_name, avatar_url)
        )
      `)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (filters.format) {
      query = query.eq('format', filters.format)
    }
    if (filters.dateFrom) {
      query = query.gte('date', filters.dateFrom)
    }
    if (filters.dateTo) {
      query = query.lte('date', filters.dateTo)
    }

    const { data, error } = await query
    if (error) {
      console.error('Error fetching games:', error)
    } else {
      setGames(data || [])
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchGames()
  }, [fetchGames])

  async function createGame(gameData, players) {
    // Force-refresh the JWT before writing (prevents RLS failures when token expired during long games)
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError || !refreshData?.session) {
      // Refresh failed — try getSession as fallback
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) throw new Error('Session expired — please sign in again')
    }
    const currentSession = refreshData?.session || (await supabase.auth.getSession()).data.session
    const userId = currentSession?.user?.id
    if (!userId) throw new Error('Not authenticated — please sign in again')

    // Step 1: Insert game (no .select() — PostgREST applies SELECT RLS on RETURNING which breaks)
    const { error: gameInsertError } = await supabase
      .from('games')
      .insert({
        format: gameData.format,
        date: gameData.date,
        duration_minutes: gameData.duration_minutes || null,
        turn_count: gameData.turn_count || null,
        notes: gameData.notes || null,
        // created_by set automatically by DB trigger (auth.uid())
        is_complete: true,
      })

    if (gameInsertError) throw gameInsertError

    // Step 2: Fetch the game we just created using an RPC call that bypasses SELECT RLS
    const { data: game, error: gameFetchError } = await supabase
      .rpc('get_my_latest_game', { p_format: gameData.format, p_date: gameData.date })
      .single()

    if (gameFetchError) throw gameFetchError

    const playerInserts = players.map((p) => ({
      game_id: game.id,
      user_id: p.user_id || null,
      guest_name: p.guest_name || null,
      deck_name: p.deck_name || null,
      commander_name: p.commander_name || null,
      commander_colors: p.commander_colors || [],
      starting_life: p.starting_life,
      ending_life: p.ending_life ?? null,
      is_winner: p.is_winner || false,
      kill_count: p.kill_count || 0,
      commander_damage_dealt: p.commander_damage_dealt || {},
    }))

    const { error: playersError } = await supabase
      .from('game_players')
      .insert(playerInserts)

    if (playersError) throw playersError

    await fetchGames()
    return game
  }

  async function updateGame(gameId, gameData, players) {
    const { error: gameError } = await supabase
      .from('games')
      .update({
        format: gameData.format,
        date: gameData.date,
        duration_minutes: gameData.duration_minutes || null,
        turn_count: gameData.turn_count || null,
        notes: gameData.notes || null,
      })
      .eq('id', gameId)

    if (gameError) throw gameError

    // Delete existing players and re-insert
    await supabase.from('game_players').delete().eq('game_id', gameId)

    const playerInserts = players.map((p) => ({
      game_id: gameId,
      user_id: p.user_id || null,
      guest_name: p.guest_name || null,
      deck_name: p.deck_name || null,
      commander_name: p.commander_name || null,
      commander_colors: p.commander_colors || [],
      starting_life: p.starting_life,
      ending_life: p.ending_life ?? null,
      is_winner: p.is_winner || false,
      kill_count: p.kill_count || 0,
      commander_damage_dealt: p.commander_damage_dealt || {},
    }))

    const { error: playersError } = await supabase
      .from('game_players')
      .insert(playerInserts)

    if (playersError) throw playersError
    await fetchGames()
  }

  async function deleteGame(gameId) {
    const { error } = await supabase.from('games').delete().eq('id', gameId)
    if (error) throw error
    setGames((prev) => prev.filter((g) => g.id !== gameId))
  }

  return {
    games,
    loading,
    fetchGames,
    createGame,
    updateGame,
    deleteGame,
  }
}
