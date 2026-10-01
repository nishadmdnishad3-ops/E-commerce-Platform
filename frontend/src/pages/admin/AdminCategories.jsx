import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function AdminCategories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const loadCategories = () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      navigate('/login')
      return
    }

    fetch('http://127.0.0.1:8000/api/admin/categories/', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (response.status === 403) {
          throw new Error('Access denied. Admin privileges required.')
        }
        if (!response.ok) {
          throw new Error('Failed to load categories.')
        }
        return response.json()
      })
      .then((data) => {
        setCategories(data.results || data)
        setError('')
      })
      .catch((fetchError) => {
        setError(fetchError.message)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadCategories()
  }, [])

  return (
    <div className="admin-page">
      <div className="admin-toolbar admin-toolbar-right">
        <Link to="/admin/categories/add" className="primary-button">Add Category</Link>
      </div>

      {loading ? (
        <div className="admin-panel-state">Loading categories...</div>
      ) : error ? (
        <div className="admin-panel-state error">{error}</div>
      ) : (
        <div className="admin-card table-card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr><td colSpan="5">No categories found.</td></tr>
                ) : (
                  categories.map((category) => (
                    <tr key={category.id}>
                      <td>
                        {category.image ? (
                          <img src={`http://127.0.0.1:8000${category.image}`} alt={category.name} className="admin-product-thumb" />
                        ) : (
                          <span className="admin-thumb-placeholder">No image</span>
                        )}
                      </td>
                      <td>{category.name}</td>
                      <td>{category.description || '—'}</td>
                      <td>{category.is_active ? 'Active' : 'Inactive'}</td>
                      <td>
                        <Link to={`/admin/categories/edit/${category.id}`} className="mini-link">Edit</Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
