export const API_BASE_URL = 'http://127.0.0.1:8000'

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

function getUserIdFromToken(token) {
  if (!token) return null

  try {
    const payload = token.split('.')[1]
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    const userId = claims.user_id ?? claims.sub
    return userId === undefined || userId === null ? null : String(userId)
  } catch {
    return null
  }
}

export function getCurrentUserId() {
  const storedUserId = localStorage.getItem('user_id')
  if (storedUserId) return storedUserId

  const userId = getUserIdFromToken(localStorage.getItem('access_token'))
  if (userId) localStorage.setItem('user_id', userId)
  return userId
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
  const userId = user.id ?? payload.id ?? getUserIdFromToken(payload.access)

  localStorage.setItem('access_token', payload.access)
  localStorage.setItem('refresh_token', payload.refresh)
  localStorage.setItem('username', username)
  localStorage.setItem('user_role', role)
  if (userId !== undefined && userId !== null) {
    localStorage.setItem('user_id', String(userId))
  } else {
    localStorage.removeItem('user_id')
  }
  window.dispatchEvent(new Event('auth-change'))
  return { ...user, role, username }
}

export function clearAuthData() {
  for (const key of ['access_token', 'refresh_token', 'username', 'user_role', 'user_id', 'is_staff', 'is_superuser']) {
    localStorage.removeItem(key)
  }
  window.dispatchEvent(new Event('auth-change'))
}

export function updateStoredUsername(username) {
  localStorage.setItem('username', username)
  window.dispatchEvent(new Event('auth-change'))
}

export async function fetchWithTokenRefresh(url, options = {}) {
  const sendRequest = (accessToken) => fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const accessToken = localStorage.getItem('access_token')
  if (!accessToken) {
    clearAuthData()
    const error = new Error('Session expired. Please login again.')
    error.status = 401
    throw error
  }

  let response = await sendRequest(accessToken)
  if (response.status !== 401) return response

  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) {
    clearAuthData()
    return response
  }

  let refreshData
  try {
    const refreshResponse = await fetch(`${API_BASE_URL}/api/accounts/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    })
    refreshData = await refreshResponse.json().catch(() => ({}))
    if (!refreshResponse.ok || !refreshData.access) {
      clearAuthData()
      return response
    }
  } catch {
    clearAuthData()
    return response
  }

  localStorage.setItem('access_token', refreshData.access)
  response = await sendRequest(refreshData.access)
  if (response.status === 401) clearAuthData()
  return response
}