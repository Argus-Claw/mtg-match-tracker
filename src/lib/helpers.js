export function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatRelativeDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return formatDate(dateStr)
}

export function getWinRate(wins, total) {
  if (total === 0) return 0
  return Math.round((wins / total) * 100)
}

export function getPlayerName(player) {
  if (player.guest_name) return player.guest_name
  if (player.profiles?.display_name) return player.profiles.display_name
  return 'Unknown Player'
}

export function getColorIdentityString(colors) {
  if (!colors || colors.length === 0) return 'Colorless'
  return colors.join('')
}

export function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}
