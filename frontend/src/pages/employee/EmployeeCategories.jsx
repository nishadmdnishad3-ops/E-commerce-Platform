import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function EmployeeCategories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      navigate('/login')
      return
    }

    fetch('http://127.0.0.1:8000/api/employee/categories/', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (response.status === 403) throw new Error('Employee access is required.')
        if (!response.ok) throw new Error('Could not load categories.')
        return response.json()
      })
      .then(setCategories)
      .catch((fetchError) => setError(fetchError.message))
      .finally(() => setLoading(false))
  }, [navigate])

  if (loading) return <div className="admin-panel-state">Loading categories...</div>
  if (error) return <div className="admin-panel-state error">{error}</div>

  return (
    <div className="admin-card table-card"><div className="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Products</th><th>Status</th></tr></thead>
        <tbody>{categories.length ? categories.map((category) => (
          <tr key={category.id}><td>{category.name}</td><td>{category.product_count}</td><td>{category.is_active ? 'Active' : 'Inactive'}</td></tr>
        )) : <tr><td colSpan="3">No categories found.</td></tr>}</tbody>
      </table>
    </div></div>
  )
}
