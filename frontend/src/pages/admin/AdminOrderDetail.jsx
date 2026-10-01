import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import OrderStatusBadge from '../../components/admin/OrderStatusBadge'
import { formatPrice } from '../../utils/formatPrice'

const statusTransitionMap = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Processing', 'Cancelled'],
  Processing: ['Shipped'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
}

const employeeStatusTransitions = {
  Pending: ['Confirmed'],
  Confirmed: ['Processing'],
  Processing: ['Shipped'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
}

export default function AdminOrderDetail({ apiPrefix = '/api/admin', routeBase = '/admin', employeeMode = false }) {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState(false)
  const navigate = useNavigate()

  const fetchOrder = () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      navigate('/login')
      return
    }

    fetch(`http://127.0.0.1:8000${apiPrefix}/orders/${id}/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        if (response.status === 403) {
          throw new Error('Access denied. Admin privileges required.')
        }
        if (!response.ok) {
          throw new Error('Failed to load order details.')
        }
        return response.json()
      })
      .then((data) => {
        setOrder(data)
        setError('')
      })
      .catch((fetchError) => {
        setError(fetchError.message)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchOrder()
  }, [id, apiPrefix, navigate])

  const updateStatus = async (nextStatus) => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    setUpdating(true)

    try {
      const response = await fetch(`http://127.0.0.1:8000${apiPrefix}/orders/${id}/status/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || data.detail || 'Unable to update order status.')
      }

      setOrder((prev) => ({ ...prev, status: nextStatus }))
    } catch (fetchError) {
      setError(fetchError.message)
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return <div className="admin-panel-state">Loading order details...</div>
  if (error) return <div className="admin-panel-state error">{error}</div>
  if (!order) return <div className="admin-panel-state">Order not found.</div>

  return (
    <div className="admin-page order-detail-page">
      <div className="admin-card order-meta-card">
        <div className="admin-card-header">
          <h3>Order {order.order_number}</h3>
          <div className="order-header-actions">
            <Link className="mini-link" to={`${routeBase}/orders`}>Back to orders</Link>
            <OrderStatusBadge status={order.status} />
          </div>
        </div>

        <div className="order-detail-grid">
          <div>
            <p><strong>Customer:</strong> {order.customer.name}</p>
            <p><strong>Email:</strong> {order.customer.email}</p>
            <p><strong>Mobile:</strong> {order.customer.mobile}</p>
          </div>
          <div>
            <p><strong>Payment:</strong> {order.payment_method}</p>
            <p><strong>Delivery:</strong> {order.delivery_method}</p>
            <p><strong>Address:</strong> {order.shipping.address}, {order.shipping.upazila}, {order.shipping.district}</p>
          </div>
        </div>

        <div className="order-totals">
          <span>Subtotal: {formatPrice(Number(order.subtotal))}</span>
          <span>Discount: {formatPrice(Number(order.discount))}</span>
          <span>Delivery: {formatPrice(Number(order.delivery_fee))}</span>
          <strong>Total: {formatPrice(Number(order.total))}</strong>
        </div>
        {order.comment ? <p><strong>Customer note:</strong> {order.comment}</p> : null}

        <div className="status-action-row">
          {(employeeMode ? employeeStatusTransitions : statusTransitionMap)[order.status]?.length ? (
            (employeeMode ? employeeStatusTransitions : statusTransitionMap)[order.status].map((nextStatus) => (
              <button key={nextStatus} type="button" className="primary-button" onClick={() => updateStatus(nextStatus)} disabled={updating}>
                Mark as {nextStatus}
              </button>
            ))
          ) : (
            <span className="status-note">No further status changes available.</span>
          )}
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Products</h3>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.product_name}</td>
                  <td>{item.quantity}</td>
                  <td>{formatPrice(Number(item.price))}</td>
                  <td>{formatPrice(Number(item.subtotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
