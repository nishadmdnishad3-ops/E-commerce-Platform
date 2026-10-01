import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API = 'http://127.0.0.1:8000/api/admin/employees/'
const emptyForm = { first_name: '', last_name: '', username: '', email: '', password: '' }

export default function AdminEmployees() {
  const [employees, setEmployees] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const loadEmployees = () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      navigate('/login')
      return
    }
    fetch(API, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (response.status === 403) throw new Error('Admin access is required.')
        if (!response.ok) throw new Error('Could not load employees.')
        return response.json()
      })
      .then(setEmployees)
      .catch((fetchError) => setError(fetchError.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadEmployees()
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify(form),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(Array.isArray(data.error) ? data.error.join(' ') : data.error || 'Could not create employee.')
      setForm(emptyForm)
      setEmployees((current) => [data, ...current])
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleEmployee = async (employee) => {
    setError('')
    try {
      const response = await fetch(`${API}${employee.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({ is_active: !employee.is_active }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not update employee.')
      setEmployees((current) => current.map((item) => item.id === data.id ? data : item))
    } catch (updateError) {
      setError(updateError.message)
    }
  }

  return (
    <div className="admin-page">
      <section className="admin-card form-card">
        <div className="admin-card-header"><h3>Create employee account</h3></div>
        <form className="admin-form" onSubmit={handleSubmit}>
          <div className="double-field">
            <label>First name<input required value={form.first_name} onChange={(event) => setForm((current) => ({ ...current, first_name: event.target.value }))} /></label>
            <label>Last name<input required value={form.last_name} onChange={(event) => setForm((current) => ({ ...current, last_name: event.target.value }))} /></label>
          </div>
          <div className="double-field">
            <label>Username<input required autoComplete="off" value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} /></label>
            <label>Email<input required type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
          </div>
          <label>Temporary password<input required type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} /></label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create employee'}</button>
        </form>
      </section>

      <section className="admin-card table-card">
        <div className="admin-card-header"><h3>Employees</h3></div>
        {loading ? <div className="admin-panel-state">Loading employees...</div> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Joined</th><th>Status</th><th /></tr></thead>
            <tbody>{employees.length ? employees.map((employee) => (
              <tr key={employee.id}>
                <td>{employee.name}</td><td>{employee.username}</td><td>{employee.email}</td>
                <td>{new Date(employee.date_joined).toLocaleDateString()}</td>
                <td>{employee.is_active ? 'Active' : 'Inactive'}</td>
                <td><button type="button" className="secondary-button" onClick={() => toggleEmployee(employee)}>{employee.is_active ? 'Deactivate' : 'Reactivate'}</button></td>
              </tr>
            )) : <tr><td colSpan="6">No employees yet.</td></tr>}</tbody>
          </table></div>
        )}
      </section>
    </div>
  )
}
