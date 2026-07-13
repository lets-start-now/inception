/** A user's avatar: their uploaded photo if they have one, otherwise a
 *  gradient initial. Used everywhere a user is represented (sidebar, topbar,
 *  leaderboard, admin panel, profile page) so the fallback stays consistent. */
export default function Avatar({ username, avatarUrl, size = 36, square = false, fallbackClassName, className = '' }) {
  const shape = square ? 'rounded-2xl' : 'rounded-full'
  const style = { width: size, height: size }

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={username ?? 'User'}
        style={style}
        className={`${shape} object-cover shrink-0 ${className}`}
      />
    )
  }

  return (
    <div
      style={{ ...style, fontSize: Math.round(size * 0.42) }}
      className={`${shape} flex items-center justify-center font-semibold text-white shrink-0 ${
        fallbackClassName || 'bg-gradient-to-br from-accent-500 to-accent-700'
      } ${className}`}
    >
      {username?.[0]?.toUpperCase() ?? '?'}
    </div>
  )
}
