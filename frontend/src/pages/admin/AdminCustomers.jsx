import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatPrice } from '../../utils/formatPrice'

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      navigate('/login')
      return
    }

    setLoading(true)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => fetch(`http://127.0.0.1:8000/api/admin/customers/?search=${encodeURIComponent(search)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 403) {
          throw new Error('Access denied. Admin privileges required.')
        }
        if (!response.ok) {
          throw new Error('Failed to load customers.')
        }
        return response.json()
      })
      .then((data) => {
        setCustomers(data.results || data)
        setError('')
      })
      .catch((fetchError) => {
        if (fetchError.name !== 'AbortError') setError(fetchError.message)
      })
      .finally(() => setLoading(false)), 200)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [navigate, search])

  return (
    <div className="admin-page">
      <div className="admin-toolbar">
        <input
          aria-label="Search customers"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, username, or email"
        />
      </div>
      {loading ? (
        <div className="admin-panel-state">Loading customers...</div>
      ) : error ? (
        <div className="admin-panel-state error">{error}</div>
      ) : (
        <div className="admin-card table-card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Orders</th>
                  <th>Total spent</th>
                  <th>Joined</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr><td colSpan="7">No customers found.</td></tr>
                ) : (
                  customers.map((customer) => (
                    <tr key={customer.id}>
                      <td>{customer.name}</td>
                      <td>{customer.username}</td>
                      <td>{customer.email || '—'}</td>
                      <td>{customer.order_count}</td>
                      <td>{formatPrice(Number(customer.total_spent))}</td>
                      <td>{new Date(customer.date_joined).toLocaleDateString()}</td>
                      <td><Link to={`/admin/customers/${customer.id}`} className="mini-link">View</Link></td>
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
