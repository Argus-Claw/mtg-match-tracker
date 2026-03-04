import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useFriends } from '../hooks/useFriends'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Avatar from '../components/Avatar'
import LoadingSpinner from '../components/LoadingSpinner'
import './Friends.css'

export default function Friends() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const {
    friends,
    pendingReceived,
    pendingSent,
    loading,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    searchUsers,
  } = useFriends()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  async function handleSearch(e) {
    e.preventDefault()
    if (!searchQuery.trim() || searchQuery.length < 2) {
      addToast('Enter at least 2 characters to search', 'warning')
      return
    }
    setSearching(true)
    try {
      const results = await searchUsers(searchQuery)
      // Filter out existing friends and pending requests
      const friendIds = new Set([
        ...friends.map((f) => f.friend.id),
        ...pendingSent.map((f) => f.friend.id),
        ...pendingReceived.map((f) => f.friend.id),
      ])
      setSearchResults(results.filter((r) => !friendIds.has(r.id)))
    } catch (err) {
      addToast('Search failed', 'error')
    } finally {
      setSearching(false)
    }
  }

  async function handleSendRequest(userId) {
    try {
      await sendFriendRequest(userId)
      setSearchResults((prev) => prev.filter((r) => r.id !== userId))
      addToast('Friend request sent!', 'success')
    } catch (err) {
      addToast(err.message || 'Failed to send request', 'error')
    }
  }

  async function handleAccept(friendshipId) {
    try {
      await acceptFriendRequest(friendshipId)
      addToast('Friend request accepted!', 'success')
    } catch (err) {
      addToast('Failed to accept request', 'error')
    }
  }

  async function handleDecline(friendshipId) {
    try {
      await declineFriendRequest(friendshipId)
      addToast('Request declined', 'info')
    } catch (err) {
      addToast('Failed to decline request', 'error')
    }
  }

  async function handleRemove(friendshipId) {
    try {
      await removeFriend(friendshipId)
      addToast('Friend removed', 'info')
    } catch (err) {
      addToast('Failed to remove friend', 'error')
    }
  }

  if (loading) {
    return <LoadingSpinner size="lg" text="Loading friends..." />
  }

  return (
    <div className="page">
      <h1 className="page-title">Friends</h1>

      {/* Search */}
      <Card className="friends-search">
        <h3>Find Players</h3>
        <form onSubmit={handleSearch} className="friends-search-form">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by display name..."
          />
          <Button type="submit" loading={searching}>
            Search
          </Button>
        </form>

        {searchResults.length > 0 && (
          <div className="friends-list">
            {searchResults.map((result) => (
              <div key={result.id} className="friend-row">
                <div className="friend-row__info">
                  <Avatar
                    src={result.avatar_url}
                    name={result.display_name}
                    size="sm"
                  />
                  <span className="friend-row__name">{result.display_name}</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSendRequest(result.id)}
                >
                  Add Friend
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pending received requests */}
      {pendingReceived.length > 0 && (
        <Card className="friends-section">
          <h3>Friend Requests ({pendingReceived.length})</h3>
          <div className="friends-list">
            {pendingReceived.map((req) => (
              <div key={req.id} className="friend-row">
                <div className="friend-row__info">
                  <Avatar
                    src={req.friend.avatar_url}
                    name={req.friend.display_name}
                    size="sm"
                  />
                  <span className="friend-row__name">{req.friend.display_name}</span>
                </div>
                <div className="friend-row__actions">
                  <Button size="sm" onClick={() => handleAccept(req.id)}>
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDecline(req.id)}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Pending sent requests */}
      {pendingSent.length > 0 && (
        <Card className="friends-section">
          <h3>Sent Requests ({pendingSent.length})</h3>
          <div className="friends-list">
            {pendingSent.map((req) => (
              <div key={req.id} className="friend-row">
                <div className="friend-row__info">
                  <Avatar
                    src={req.friend.avatar_url}
                    name={req.friend.display_name}
                    size="sm"
                  />
                  <span className="friend-row__name">{req.friend.display_name}</span>
                </div>
                <span className="friend-row__pending">Pending</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Friends list */}
      <Card className="friends-section">
        <h3>Friends ({friends.length})</h3>
        {friends.length === 0 ? (
          <p className="friends-empty">
            No friends yet. Search for players above to add them!
          </p>
        ) : (
          <div className="friends-list">
            {friends.map((f) => (
              <div key={f.id} className="friend-row">
                <div className="friend-row__info">
                  <Avatar
                    src={f.friend.avatar_url}
                    name={f.friend.display_name}
                    size="md"
                  />
                  <span className="friend-row__name">{f.friend.display_name}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemove(f.id)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
