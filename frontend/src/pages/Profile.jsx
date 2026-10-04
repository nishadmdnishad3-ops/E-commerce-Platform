import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { updateStoredUsername } from '../utils/auth'

export default function Profile() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', first_name: '', last_name: '', email: '', role: 'customer' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      navigate('/login')
      return
    }
    fetch('http://127.0.0.1:8000/api/accounts/profile/', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load your profile.')
        return response.json()
      })
      .then(setForm)
      .catch((fetchError) => setError(fetchError.message))
      .finally(() => setLoading(false))
  }, [navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const username = form.username.trim()
    if (!username) {
      setError('Username cannot be empty.')
      setSaved(false)
      return
    }

    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const response = await fetch('http://127.0.0.1:8000/api/accounts/profile/', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({ username, first_name: form.first_name, last_name: form.last_name }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = data.username || data.email || data.detail || 'Could not save your profile.'
        throw new Error(Array.isArray(message) ? message.join(' ') : message)
      }
      setForm(data)
      updateStoredUsername(data.username)
      setSaved(true)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main className="profile-page"><p>Loading profile...</p></main>

  return (
    <main className="profile-page">
      <section className="profile-panel">
        <h1>Your Profile</h1>
        <p className="profile-role">Role: {form.role}</p>
        <form className="admin-form" onSubmit={handleSubmit}>
          <label>
            Username
            <input
              value={form.username}
              onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
              required
              autoComplete="username"
            />
          </label>
          <div className="double-field">
            <label>First name<input value={form.first_name} onChange={(event) => setForm((current) => ({ ...current, first_name: event.target.value }))} /></label>
            <label>Last name<input value={form.last_name} onChange={(event) => setForm((current) => ({ ...current, last_name: event.target.value }))} /></label>
          </div>
          <label>
            Email
            <input type="email" value={form.email} readOnly className="profile-readonly-input" />
            <small className="profile-email-note">Locked: email cannot be changed.</small>
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          {saved ? <p className="profile-saved" role="status">Profile updated.</p> : null}
          <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
        </form>
      </section>
    </main>
  )
}
