import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import StatCard from '../../components/admin/StatCard'

export default function EmployeeDashboard() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      navigate('/login')
      return
    }

    fetch('http://127.0.0.1:8000/api/employee/dashboard/', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (response.status === 403) throw new Error('Employee access is required.')
        if (!response.ok) throw new Error('Could not load dashboard data.')
        return response.json()
      })
      .then((data) => setStats(data.stats))
      .catch((fetchError) => setError(fetchError.message))
  }, [navigate])

  if (error) return <div className="admin-panel-state error">{error}</div>
  if (!stats) return <div className="admin-panel-state">Loading dashboard...</div>

  return (
    <div className="admin-dashboard-page">
      <div className="stats-grid">
        <StatCard label="Total orders" value={stats.total_orders} tone="blue" />
        <StatCard label="Pending" value={stats.pending_orders} tone="amber" />
        <StatCard label="Processing" value={stats.processing_orders} tone="purple" />
        <StatCard label="Shipped" value={stats.shipped_orders} tone="green" />
        <StatCard label="Active products" value={stats.total_products} tone="gray" />
      </div>
      <section className="employee-quick-links">
        <Link className="employee-quick-link" to="/employee/orders"><strong>Order queue</strong><span>Review orders and move them through fulfillment.</span></Link>
        <Link className="employee-quick-link" to="/employee/products"><strong>Product catalog</strong><span>Add products and update product information.</span></Link>
        <Link className="employee-quick-link" to="/employee/categories"><strong>Categories</strong><span>Browse the current product categories.</span></Link>
      </section>
    </div>
  )
}
