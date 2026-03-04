import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export function useFriends() {
  const { user } = useAuth()
  const [friends, setFriends] = useState([])
  const [pendingReceived, setPendingReceived] = useState([])
  const [pendingSent, setPendingSent] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchFriends = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const { data, error } = await supabase
      .from('friendships')
      .select(`
        *,
        requester:requester_id (id, display_name, avatar_url),
        addressee:addressee_id (id, display_name, avatar_url)
      `)

    if (error) {
      console.error('Error fetching friends:', error)
      setLoading(false)
      return
    }

    const accepted = []
    const received = []
    const sent = []

    for (const f of data || []) {
      if (f.status === 'accepted') {
        const friend =
          f.requester_id === user.id ? f.addressee : f.requester
        accepted.push({ ...f, friend })
      } else if (f.status === 'pending') {
        if (f.addressee_id === user.id) {
          received.push({ ...f, friend: f.requester })
        } else {
          sent.push({ ...f, friend: f.addressee })
        }
      }
    }

    setFriends(accepted)
    setPendingReceived(received)
    setPendingSent(sent)
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchFriends()
  }, [fetchFriends])

  async function sendFriendRequest(addresseeId) {
    const { error } = await supabase.from('friendships').insert({
      requester_id: user.id,
      addressee_id: addresseeId,
    })
    if (error) throw error
    await fetchFriends()
  }

  async function acceptFriendRequest(friendshipId) {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId)
    if (error) throw error
    await fetchFriends()
  }

  async function declineFriendRequest(friendshipId) {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
    if (error) throw error
    await fetchFriends()
  }

  async function removeFriend(friendshipId) {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
    if (error) throw error
    await fetchFriends()
  }

  async function searchUsers(query) {
    if (!query || query.length < 2) return []
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .ilike('display_name', `%${query}%`)
      .neq('id', user.id)
      .limit(10)
    if (error) throw error
    return data || []
  }

  return {
    friends,
    pendingReceived,
    pendingSent,
    loading,
    fetchFriends,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    searchUsers,
  }
}
