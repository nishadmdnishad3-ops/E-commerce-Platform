import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

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
        body: JSON.stringify({ first_name: form.first_name, last_name: form.last_name, email: form.email }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.email || 'Could not save your profile.')
      setForm(data)
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
          <label>Username<input value={form.username} readOnly /></label>
          <div className="double-field">
            <label>First name<input value={form.first_name} onChange={(event) => setForm((current) => ({ ...current, first_name: event.target.value }))} /></label>
            <label>Last name<input value={form.last_name} onChange={(event) => setForm((current) => ({ ...current, last_name: event.target.value }))} /></label>
          </div>
          <label>Email<input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
          {error ? <p className="form-error">{error}</p> : null}
          {saved ? <p className="profile-saved" role="status">Profile updated.</p> : null}
          <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
        </form>
      </section>
    </main>
  )
}
