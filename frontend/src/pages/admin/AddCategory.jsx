import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function AddCategory() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    description: '',
    is_active: true,
    image: null,
  })
  const [error, setError] = useState('')

  const handleChange = (event) => {
    const { name, value, type, checked, files } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'file' ? files[0] : value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const token = localStorage.getItem('access_token')

    const payload = new FormData()
    payload.append('name', form.name)
    payload.append('description', form.description)
    payload.append('is_active', form.is_active ? 'true' : 'false')
    if (form.image) payload.append('image', form.image)

    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/categories/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: payload,
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.detail || data.error || 'Unable to create category.')
      }

      navigate('/admin/categories')
    } catch (submitError) {
      setError(submitError.message)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-card form-card">
        <div className="admin-card-header">
          <h3>Add Category</h3>
        </div>

        <form onSubmit={handleSubmit} className="admin-form">
          <label>
            Category name
            <input name="name" value={form.name} onChange={handleChange} required />
          </label>

          <label>
            Description
            <textarea name="description" rows="5" value={form.description} onChange={handleChange} />
          </label>

          <label>
            Category image
            <input type="file" name="image" accept="image/*" onChange={handleChange} />
          </label>

          <label className="checkbox-row">
            <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
            Active category
          </label>

          {error ? <div className="form-error">{error}</div> : null}

          <div className="form-actions">
            <button type="submit" className="primary-button">Save Category</button>
            <button type="button" className="secondary-button" onClick={() => navigate('/admin/categories')}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
