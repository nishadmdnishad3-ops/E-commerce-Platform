import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import OrderStatusBadge from '../../components/admin/OrderStatusBadge'
import { formatPrice } from '../../utils/formatPrice'

export default function AdminCustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      navigate('/login')
      return
    }

    fetch(`http://127.0.0.1:8000/api/admin/customers/${id}/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (response.status === 403) throw new Error('Admin privileges are required.')
        if (!response.ok) throw new Error('Could not load customer details.')
        return response.json()
      })
      .then(setCustomer)
      .catch((fetchError) => setError(fetchError.message))
      .finally(() => setLoading(false))
  }, [id, navigate])

  if (loading) return <div className="admin-panel-state">Loading customer...</div>
  if (error) return <div className="admin-panel-state error">{error}</div>
  if (!customer) return <div className="admin-panel-state">Customer not found.</div>

  return (
    <div className="admin-page">
      <section className="admin-card">
        <div className="admin-card-header">
          <h3>{customer.name}</h3>
          <Link to="/admin/customers" className="mini-link">Back to customers</Link>
        </div>
        <div className="order-detail-grid">
          <p><strong>Username:</strong> {customer.username}</p>
          <p><strong>Email:</strong> {customer.email || '—'}</p>
          <p><strong>Joined:</strong> {new Date(customer.date_joined).toLocaleDateString()}</p>
          <p><strong>Orders:</strong> {customer.order_count}</p>
          <p><strong>Total spent:</strong> {formatPrice(Number(customer.total_spent))}</p>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card-header"><h3>Recent orders</h3></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Order</th><th>Date</th><th>Total</th><th>Status</th><th /></tr></thead>
            <tbody>
              {customer.recent_orders.length ? customer.recent_orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.order_number}</td>
                  <td>{new Date(order.date).toLocaleDateString()}</td>
                  <td>{formatPrice(Number(order.total))}</td>
                  <td><OrderStatusBadge status={order.status} /></td>
                  <td><Link to={`/admin/orders/${order.id}`} className="mini-link">View</Link></td>
                </tr>
              )) : <tr><td colSpan="5">No orders for this customer.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
