export function getRoleFromToken(token = localStorage.getItem('access_token')) {
  if (!token) return null

  try {
    const payload = token.split('.')[1]
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    if (claims.role) return claims.role
    if (claims.is_superuser || claims.is_staff) return 'admin'
    return 'customer'
  } catch {
    return null
  }
}

export function getCurrentRole() {
  return localStorage.getItem('user_role') || getRoleFromToken()
}

export function getRoleHome(role) {
  if (role === 'admin') return '/admin'
  if (role === 'employee') return '/employee'
  return '/'
}

export function saveAuthData(payload, usernameFallback = '') {
  const user = payload.user || payload
  const role = user.role || payload.role || getRoleFromToken(payload.access) || 'customer'
  const username = user.username || payload.username || usernameFallback || 'user'

  localStorage.setItem('access_token', payload.access)
  localStorage.setItem('refresh_token', payload.refresh)
  localStorage.setItem('username', username)
  localStorage.setItem('user_role', role)
  window.dispatchEvent(new Event('auth-change'))
  return { ...user, role, username }
}

export function clearAuthData() {
  for (const key of ['access_token', 'refresh_token', 'username', 'user_role', 'is_staff', 'is_superuser']) {
    localStorage.removeItem(key)
  }
  window.dispatchEvent(new Event('auth-change'))
}