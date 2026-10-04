import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL, fetchWithTokenRefresh } from '../../utils/auth'

export default function AdminProfile() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let isActive = true

    const loadProfile = async () => {
      try {
        const response = await fetchWithTokenRefresh(`${API_BASE_URL}/api/accounts/profile/`)
        if (response.status === 401) {
          navigate('/login', {
            replace: true,
            state: { message: 'Session expired. Please login again.' },
          })
          return
        }
        if (!response.ok) throw new Error('Unable to load profile.')

        const data = await response.json()
        if (data.role !== 'admin') {
          navigate(data.role === 'employee' ? '/employee' : '/', { replace: true })
          return
        }
        if (isActive) setProfile(data)
      } catch (loadError) {
        if (loadError.status === 401) {
          navigate('/login', {
            replace: true,
            state: { message: 'Session expired. Please login again.' },
          })
          return
        }
        if (isActive) setError(loadError.message)
      }
    }

    loadProfile()
    return () => {
      isActive = false
    }
  }, [navigate])

  if (error) return <div className="admin-panel-state error">{error}</div>
  if (!profile) return <div className="admin-panel-state">Loading profile...</div>

  const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username

  return (
    <div className="admin-page">
      <section className="admin-card admin-profile-card">
        <div className="admin-card-header">
          <h3>Profile information</h3>
        </div>
        <dl className="admin-profile-details">
          <div><dt>Name</dt><dd>{name}</dd></div>
          <div><dt>Username</dt><dd>{profile.username}</dd></div>
          <div><dt>Email</dt><dd>{profile.email || 'Not provided'}</dd></div>
          <div><dt>Role</dt><dd>{profile.role}</dd></div>
        </dl>
      </section>
    </div>
  )
}