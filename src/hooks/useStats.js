import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { getWinRate } from '../lib/helpers'

export function useStats() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const computeStats = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const { data: games, error } = await supabase
      .from('games')
      .select(`
        *,
        game_players (
          *,
          profiles:user_id (id, display_name)
        )
      `)
      .order('date', { ascending: true })

    if (error) {
      console.error('Error fetching stats:', error)
      setLoading(false)
      return
    }

    const allGames = games || []
    let totalGames = 0
    let totalWins = 0
    const formatStats = {}
    const deckStats = {}
    const commanderStats = {}
    const colorStats = {}
    const opponentStats = {}
    const timelineData = []
    let currentStreak = 0
    let bestStreak = 0

    for (const game of allGames) {
      const myPlayer = game.game_players.find((p) => p.user_id === user.id)
      if (!myPlayer) continue

      totalGames++
      const won = myPlayer.is_winner

      if (won) {
        totalWins++
        currentStreak++
        if (currentStreak > bestStreak) bestStreak = currentStreak
      } else {
        currentStreak = 0
      }

      // Format stats
      if (!formatStats[game.format]) {
        formatStats[game.format] = { games: 0, wins: 0 }
      }
      formatStats[game.format].games++
      if (won) formatStats[game.format].wins++

      // Deck stats
      if (myPlayer.deck_name) {
        if (!deckStats[myPlayer.deck_name]) {
          deckStats[myPlayer.deck_name] = { games: 0, wins: 0 }
        }
        deckStats[myPlayer.deck_name].games++
        if (won) deckStats[myPlayer.deck_name].wins++
      }

      // Commander stats
      if (myPlayer.commander_name) {
        if (!commanderStats[myPlayer.commander_name]) {
          commanderStats[myPlayer.commander_name] = {
            games: 0,
            wins: 0,
            colors: myPlayer.commander_colors || [],
          }
        }
        commanderStats[myPlayer.commander_name].games++
        if (won) commanderStats[myPlayer.commander_name].wins++
      }

      // Color identity stats
      if (myPlayer.commander_colors) {
        for (const color of myPlayer.commander_colors) {
          if (!colorStats[color]) {
            colorStats[color] = { games: 0, wins: 0 }
          }
          colorStats[color].games++
          if (won) colorStats[color].wins++
        }
      }

      // Opponent stats (head-to-head)
      for (const player of game.game_players) {
        if (player.user_id === user.id || !player.user_id) continue
        const oppName = player.profiles?.display_name || 'Unknown'
        const oppId = player.user_id
        if (!opponentStats[oppId]) {
          opponentStats[oppId] = { name: oppName, games: 0, wins: 0 }
        }
        opponentStats[oppId].games++
        if (won) opponentStats[oppId].wins++
      }

      // Timeline
      timelineData.push({
        date: game.date,
        won: won ? 1 : 0,
        totalWins,
        totalGames,
        winRate: getWinRate(totalWins, totalGames),
      })
    }

    // Find favorite deck
    let favoriteDeck = null
    let maxDeckGames = 0
    for (const [name, data] of Object.entries(deckStats)) {
      if (data.games > maxDeckGames) {
        maxDeckGames = data.games
        favoriteDeck = { name, ...data }
      }
    }

    // Sort opponents by games played
    const opponentList = Object.values(opponentStats)
      .sort((a, b) => b.games - a.games)

    setStats({
      totalGames,
      totalWins,
      winRate: getWinRate(totalWins, totalGames),
      currentStreak,
      bestStreak,
      formatStats,
      deckStats,
      commanderStats,
      colorStats,
      opponentStats: opponentList,
      timelineData,
      favoriteDeck,
      recentGames: allGames.slice(-10).reverse(),
    })

    setLoading(false)
  }, [user])

  useEffect(() => {
    computeStats()
  }, [computeStats])

  return { stats, loading, refreshStats: computeStats }
}
