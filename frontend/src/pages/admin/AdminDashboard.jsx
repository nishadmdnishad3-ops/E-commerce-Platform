import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import OrderStatusBadge from '../../components/admin/OrderStatusBadge'
import StatCard from '../../components/admin/StatCard'
import { formatPrice } from '../../utils/formatPrice'

const API = 'http://127.0.0.1:8000/api/admin'

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      navigate('/login')
      return
    }

    fetch(`${API}/dashboard/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (response.status === 403) throw new Error('Admin privileges are required.')
        if (!response.ok) throw new Error('Could not load dashboard data.')
        return response.json()
      })
      .then(setData)
      .catch((fetchError) => setError(fetchError.message))
  }, [navigate])

  if (error) return <div className="admin-panel-state error">{error}</div>
  if (!data) return <div className="admin-panel-state">Loading dashboard...</div>

  const stats = data.stats
  const statCards = [
    ['Products', stats.total_products, 'blue'],
    ['Orders', stats.total_orders, 'purple'],
    ['Pending orders', stats.pending_orders, 'amber'],
    ['Processing orders', stats.processing_orders, 'orange'],
    ['Delivered orders', stats.delivered_orders, 'green'],
    ['Customers', stats.total_customers, 'gray'],
    ['Sales', formatPrice(Number(stats.total_sales || 0)), 'red'],
  ]

  return (
    <div className="admin-dashboard-page">
      <div className="stats-grid">
        {statCards.map(([label, value, tone]) => <StatCard key={label} label={label} value={value} tone={tone} />)}
      </div>

      <div className="admin-card-grid">
        <section className="admin-card">
          <div className="admin-card-header"><h3>Recent orders</h3><Link to="/admin/orders">View all</Link></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th><th /></tr></thead>
              <tbody>
                {data.recent_orders.length ? data.recent_orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.order_number}</td><td>{order.customer}</td>
                    <td>{new Date(order.date).toLocaleDateString()}</td>
                    <td>{formatPrice(Number(order.total))}</td><td><OrderStatusBadge status={order.status} /></td>
                    <td><Link className="mini-link" to={`/admin/orders/${order.id}`}>View</Link></td>
                  </tr>
                )) : <tr><td colSpan="6">No recent orders.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-card">
          <div className="admin-card-header"><h3>Recent products</h3><Link to="/admin/products">Manage</Link></div>
          <div className="recent-products-list">
            {data.recent_products.length ? data.recent_products.map((product) => (
              <div className="recent-product-item" key={product.id}>
                <div className="recent-product-image-wrap">
                  {product.image ? <img src={`http://127.0.0.1:8000${product.image}`} alt={product.name} /> : <span>No image</span>}
                </div>
                <div className="recent-product-meta"><strong>{product.name}</strong><small>{product.category}</small><span>{formatPrice(Number(product.price))}</span><small>Stock: {product.stock}</small></div>
                <Link className="mini-link" to={`/admin/products/edit/${product.id}`}>Edit</Link>
              </div>
            )) : <p>No recent products.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
