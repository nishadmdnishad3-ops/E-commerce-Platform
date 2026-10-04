import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL, fetchWithTokenRefresh } from '../../utils/auth'

const initialForm = {
  current_password: '',
  new_password: '',
  confirm_new_password: '',
}

const getApiErrorMessage = (data) => {
  if (!data || typeof data !== 'object') return ''
  if (data.error) return Array.isArray(data.error) ? data.error.join(' ') : String(data.error)

  return Object.entries(data)
    .map(([field, errors]) => `${field.replaceAll('_', ' ')}: ${Array.isArray(errors) ? errors.join(' ') : String(errors)}`)
    .join(' ')
}

export default function AdminChangePassword() {
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
    setError('')
    setSuccess('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (form.new_password !== form.confirm_new_password) {
      setError('New password and confirmation do not match.')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetchWithTokenRefresh(`${API_BASE_URL}/api/accounts/change-password/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/login', {
            replace: true,
            state: { message: 'Session expired. Please login again.' },
          })
          return
        }
        if (response.status === 403) {
          throw new Error('You do not have permission to change this password.')
        }
        if (response.status === 400) {
          throw new Error(getApiErrorMessage(data) || 'Please check the password fields.')
        }
        if (response.status >= 500) throw new Error('Server error. Please try again.')
        throw new Error(getApiErrorMessage(data) || `Unable to change password (HTTP ${response.status}).`)
      }

      setForm(initialForm)
      setSuccess(data.message || 'Password changed successfully.')
    } catch (submitError) {
      if (submitError.status === 401) {
        navigate('/login', {
          replace: true,
          state: { message: 'Session expired. Please login again.' },
        })
        return
      }
      setError(submitError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="admin-page">
      <section className="admin-card form-card admin-password-card">
        <div className="admin-card-header"><h3>Change password</h3></div>
        <form className="admin-form" onSubmit={handleSubmit}>
          <label>
            Current Password
            <input
              type="password"
              name="current_password"
              autoComplete="current-password"
              value={form.current_password}
              onChange={handleChange}
              required
            />
          </label>
          <label>
            New Password
            <input
              type="password"
              name="new_password"
              autoComplete="new-password"
              value={form.new_password}
              onChange={handleChange}
              required
            />
          </label>
          <label>
            Confirm New Password
            <input
              type="password"
              name="confirm_new_password"
              autoComplete="new-password"
              value={form.confirm_new_password}
              onChange={handleChange}
              required
            />
          </label>
          {error ? <div className="form-error" role="alert">{error}</div> : null}
          {success ? <div className="form-success" role="status">{success}</div> : null}
          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={isSaving}>
              {isSaving ? 'Changing...' : 'Change Password'}
            </button>
            <button type="button" className="secondary-button" onClick={() => navigate('/admin')}>
              Cancel
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}