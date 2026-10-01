import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import OrderStatusBadge from '../../components/admin/OrderStatusBadge'
import { formatPrice } from '../../utils/formatPrice'

const statuses = ['All', 'Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled']
const payments = ['All', 'Cash on Delivery', 'Online Payment', 'POS on Delivery']
const deliveries = ['All', 'Home Delivery', 'Store Pickup', 'Express Delivery']
const statusActions = {
  Confirmed: { label: 'Confirm Order', confirmation: 'Confirm this order?', success: 'confirmed' },
  Processing: { label: 'Start Processing', confirmation: 'Start processing this order?', success: 'moved to Processing' },
  Shipped: { label: 'Mark as Shipped', confirmation: 'Mark this order as shipped?', success: 'marked as Shipped' },
  Delivered: { label: 'Mark as Delivered', confirmation: 'Mark this order as delivered?', success: 'marked as Delivered' },
  Cancelled: { label: 'Cancel Order', confirmation: 'Are you sure you want to cancel this order?', success: 'cancelled' },
}

export default function AdminOrders({ apiPrefix = '/api/admin', routeBase = '/admin' }) {
  const [orders, setOrders] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All')
  const [payment, setPayment] = useState('All')
  const [delivery, setDelivery] = useState('All')
  const [sort, setSort] = useState('newest')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)
  const [updatingOrderId, setUpdatingOrderId] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      navigate('/login')
      return
    }

    const params = new URLSearchParams({ search, status, payment_method: payment, delivery_method: delivery, sort })
    const timeout = window.setTimeout(() => {
      setLoading(true)
      fetch(`http://127.0.0.1:8000${apiPrefix}/orders/?${params}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(async (response) => {
          if (response.status === 403) throw new Error('Admin or employee privileges are required.')
          if (!response.ok) throw new Error('Could not load orders.')
          return response.json()
        })
        .then((data) => {
          setOrders(data.results || [])
          setError('')
        })
        .catch((fetchError) => setError(fetchError.message))
        .finally(() => setLoading(false))
    }, 200)

    return () => window.clearTimeout(timeout)
  }, [search, status, payment, delivery, sort, navigate, apiPrefix])

  const handleStatusUpdate = async (order, newStatus) => {
    const action = statusActions[newStatus]
    if (!action) return

    const confirmed = window.confirm(
      `${action.confirmation}\n\nCurrent status: ${order.status}\nNew status: ${newStatus}`
    )
    if (!confirmed) return

    const token = localStorage.getItem('access_token')
    if (!token) {
      navigate('/login')
      return
    }

    setUpdatingOrderId(order.id)
    setNotice(null)
    try {
      const response = await fetch(
        `http://127.0.0.1:8000${apiPrefix}/orders/${order.id}/status/`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: newStatus }),
        }
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not update order status.')

      setOrders((currentOrders) => currentOrders.map((currentOrder) => (
        currentOrder.id === order.id
          ? { ...currentOrder, status: data.status, available_statuses: data.available_statuses || [] }
          : currentOrder
      )))
      setNotice({ type: 'success', text: `Order ${order.order_number} ${action.success} successfully.` })
    } catch (updateError) {
      setNotice({ type: 'error', text: updateError.message })
    } finally {
      setUpdatingOrderId(null)
    }
  }

  return (
    <div className="admin-page">
      {notice && <div className={`order-status-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.text}</div>}
      <div className="admin-toolbar">
        <input aria-label="Search orders" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order, customer, email, mobile" />
        <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filter by payment" value={payment} onChange={(event) => setPayment(event.target.value)}>{payments.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filter by delivery" value={delivery} onChange={(event) => setDelivery(event.target.value)}>{deliveries.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Sort orders" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="newest">Newest</option><option value="oldest">Oldest</option><option value="highest_total">Highest total</option><option value="lowest_total">Lowest total</option>
        </select>
      </div>

      {loading ? <div className="admin-panel-state">Loading orders...</div> : error ? <div className="admin-panel-state error">{error}</div> : (
        <div className="admin-card table-card"><div className="table-wrap">
          <table>
            <thead><tr><th>Order</th><th>Customer</th><th>Mobile</th><th>Date</th><th>Items</th><th>Payment</th><th>Delivery</th><th>Total</th><th>Status / Action</th><th /></tr></thead>
            <tbody>
              {orders.length ? orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.order_number}</td><td>{order.customer_name}</td><td>{order.mobile}</td><td>{new Date(order.date).toLocaleDateString()}</td><td>{order.items_count}</td><td>{order.payment_method}</td><td>{order.delivery_method}</td><td>{formatPrice(Number(order.total))}</td>
                  <td className="order-status-action-cell">
                    <OrderStatusBadge status={order.status} />
                    <div className="order-status-actions">
                      {(order.available_statuses || []).map((newStatus) => (
                        <button
                          className={`order-status-action${newStatus === 'Cancelled' ? ' cancel' : ''}`}
                          disabled={updatingOrderId !== null}
                          key={newStatus}
                          onClick={() => handleStatusUpdate(order, newStatus)}
                          type="button"
                        >
                          {updatingOrderId === order.id ? 'Updating...' : statusActions[newStatus]?.label}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td><Link className="mini-link" to={`${routeBase}/orders/${order.id}`}>View</Link></td>
                </tr>
              )) : <tr><td colSpan="10">No orders found.</td></tr>}
            </tbody>
          </table>
        </div></div>
      )}
    </div>
  )
}
