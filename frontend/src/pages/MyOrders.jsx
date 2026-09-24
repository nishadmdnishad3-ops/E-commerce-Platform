import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const trackingStatuses = [
  'Pending',
  'Confirmed',
  'Processing',
  'Shipped',
  'Delivered',
]

const trackingLabels = {
  Pending: 'Pending Approval',
  Confirmed: 'Confirmed',
  Processing: 'Processing',
  Shipped: 'Shipped',
  Delivered: 'Delivered',
  Cancelled: 'Cancelled',
}

function OrderTracking({ status }) {
  const isCancelled = status === 'Cancelled'
  const statuses = isCancelled
    ? ['Pending', 'Cancelled']
    : trackingStatuses
  const currentIndex = trackingStatuses.indexOf(status)

  return (
    <section className="order-tracking">
      <h3>Order Tracking</h3>

      <div className="tracking-timeline">
        {statuses.map((trackingStatus, index) => {
          const isCurrent = isCancelled
            ? trackingStatus === 'Cancelled'
            : index === currentIndex
          const isCompleted = isCancelled
            ? trackingStatus === 'Pending'
            : index < currentIndex
          const state = isCurrent
            ? 'current'
            : isCompleted
              ? 'completed'
              : 'upcoming'

          return (
            <div
              className={`tracking-step ${state} ${isCancelled ? 'cancelled-flow' : ''}`}
              key={trackingStatus}
            >
              <div className="tracking-step-content">
                <span className="tracking-icon" aria-hidden="true">
                  {isCancelled && trackingStatus === 'Cancelled'
                    ? '✕'
                    : isCompleted
                      ? '✓'
                      : isCurrent
                        ? '●'
                        : '○'}
                </span>
                <span className="tracking-label">
                  {trackingLabels[trackingStatus]}
                </span>
              </div>

              {index < statuses.length - 1 && (
                <span
                  className={`tracking-line ${isCompleted ? 'completed' : ''}`}
                  aria-hidden="true"
                />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function MyOrders() {
  const navigate = useNavigate()

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    const loadOrders = async () => {
      let accessToken =
        localStorage.getItem('access_token')

      const refreshToken =
        localStorage.getItem('refresh_token')

      if (!accessToken) {
        navigate('/login')
        return
      }

      try {
        let response = await fetch(
          'http://127.0.0.1:8000/api/orders/my-orders/',
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
          }
        )

        /*
          Access token expired.
          Try to get a new access token.
        */
        if (
          response.status === 401 &&
          refreshToken
        ) {
          const refreshResponse = await fetch(
            'http://127.0.0.1:8000/api/accounts/token/refresh/',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                refresh: refreshToken,
              }),
            }
          )

          const refreshData =
            await refreshResponse.json()

          if (refreshResponse.ok) {
            accessToken =
              refreshData.access

            localStorage.setItem(
              'access_token',
              accessToken
            )

            /*
              Retry My Orders request
            */
            response = await fetch(
              'http://127.0.0.1:8000/api/orders/my-orders/',
              {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${accessToken}`,
                },
              }
            )
          } else {
            /*
              Refresh token also expired.
              Login is required.
            */
            localStorage.removeItem(
              'access_token'
            )

            localStorage.removeItem(
              'refresh_token'
            )

            localStorage.removeItem(
              'username'
            )

            window.dispatchEvent(
              new Event('auth-change')
            )

            navigate('/login')
            return
          }
        }

        const data = await response.json()

        console.log(
          'MY ORDERS STATUS:',
          response.status
        )

        console.log(
          'MY ORDERS RESPONSE:',
          data
        )

        if (!response.ok) {
          throw new Error(
            data.error ||
            data.detail ||
            'Failed to load orders.'
          )
        }

        setOrders(data)
        setLoading(false)

      } catch (error) {
        console.error(
          'MY ORDERS ERROR:',
          error
        )

        setError(error.message)
        setLoading(false)
      }
    }

    loadOrders()

  }, [navigate])

  const handleCancelOrder = async (orderId) => {
    const confirmed = window.confirm(
      'Are you sure you want to cancel this order?'
    )

    if (!confirmed) {
      return
    }

    let accessToken = localStorage.getItem('access_token')
    const refreshToken = localStorage.getItem('refresh_token')

    try {
      let response = await fetch(
        `http://127.0.0.1:8000/api/orders/${orderId}/cancel/`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (response.status === 401 && refreshToken) {
        const refreshResponse = await fetch(
          'http://127.0.0.1:8000/api/accounts/token/refresh/',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              refresh: refreshToken,
            }),
          }
        )

        const refreshData = await refreshResponse.json()

        if (refreshResponse.ok) {
          accessToken = refreshData.access
          localStorage.setItem('access_token', accessToken)

          response = await fetch(
            `http://127.0.0.1:8000/api/orders/${orderId}/cancel/`,
            {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
            }
          )
        } else {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          localStorage.removeItem('username')
          window.dispatchEvent(new Event('auth-change'))
          navigate('/login')
          return
        }
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error || data.detail || 'Failed to cancel order.'
        )
      }

      setError('')
      setSuccessMessage('Order cancelled successfully.')

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === orderId
            ? { ...order, status: data.status }
            : order
        )
      )
    } catch (error) {
      setSuccessMessage('')
      alert(error.message)
    }
  }

  if (loading) {
    return (
      <main className="my-orders-page">
        <h1>My Orders</h1>
        <p>Loading orders...</p>
      </main>
    )
  }


  if (error) {
    return (
      <main className="my-orders-page">
        <h1>My Orders</h1>

        <div className="orders-error">
          {error}
        </div>
      </main>
    )
  }


  return (
    <main className="my-orders-page">

      <div className="my-orders-header">

        <div>
          <h1>My Orders</h1>

          <p>
            View your previous orders and order details.
          </p>
        </div>

        <Link
          to="/"
          className="orders-shopping-button"
        >
          Continue Shopping
        </Link>

      </div>

      {successMessage && (
        <div className="orders-success-message">
          {successMessage}
        </div>
      )}

      {orders.length === 0 ? (

        <div className="no-orders">

          <h2>No Orders Yet</h2>

          <p>
            You have not placed any orders yet.
          </p>

          <Link
            to="/"
            className="orders-shopping-button"
          >
            Start Shopping
          </Link>

        </div>

      ) : (

        <div className="orders-list">

          {orders.map((order) => (

            <div
              className="order-card"
              key={order.id}
            >

              <div className="order-card-header">

                <div>

                  <span className="order-label">
                    Order Number
                  </span>

                  <strong>
                    {order.order_number}
                  </strong>

                </div>

                <div className="order-header-actions">
                  <div
                    className={`order-status status-${order.status.toLowerCase()}`}
                  >
                    {order.status}
                  </div>

                  {order.status !== 'Cancelled' &&
                    order.status !== 'Delivered' &&
                    order.status !== 'Shipped' && (
                      <button
                        type="button"
                        className="cancel-order-button"
                        onClick={() => handleCancelOrder(order.id)}
                      >
                        Cancel Order
                      </button>
                    )}
                </div>

              </div>

              <OrderTracking status={order.status} />


              <div className="order-card-info">

                <div>
                  <span>Date</span>

                  <strong>
                    {new Date(
                      order.created_at
                    ).toLocaleDateString()}
                  </strong>
                </div>


                <div>
                  <span>Payment</span>

                  <strong>
                    {order.payment_method}
                  </strong>
                </div>


                <div>
                  <span>Delivery</span>

                  <strong>
                    {order.delivery_method}
                  </strong>
                </div>


                <div>
                  <span>Total</span>

                  <strong>
                    ৳
                    {Number(
                      order.total
                    ).toFixed(2)}
                  </strong>
                </div>

              </div>


              <div className="order-products">

                <h3>Products</h3>

                {order.items.map((item) => (

                  <div
                    className="order-product"
                    key={item.id}
                  >

                    <div>

                      <strong>
                        {item.product_name}
                      </strong>

                      <span>
                        Quantity: {item.quantity}
                      </span>

                    </div>

                    <strong>
                      ৳
                      {Number(
                        item.subtotal
                      ).toFixed(2)}
                    </strong>

                  </div>

                ))}

              </div>


              <div className="order-card-footer">

                <span>
                  Delivery: ৳
                  {Number(
                    order.delivery_fee
                  ).toFixed(2)}
                </span>


                {Number(order.discount) > 0 && (

                  <span>
                    Discount: -৳
                    {Number(
                      order.discount
                    ).toFixed(2)}
                  </span>

                )}


                <strong>
                  Total: ৳
                  {Number(
                    order.total
                  ).toFixed(2)}
                </strong>

              </div>

            </div>

          ))}

        </div>

      )}

    </main>
  )
}

export default MyOrders