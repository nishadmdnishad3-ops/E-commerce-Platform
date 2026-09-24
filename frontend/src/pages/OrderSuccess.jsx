import { Link, useLocation } from 'react-router-dom'

function OrderSuccess() {
  const location = useLocation()

  const order = location.state?.order

  if (!order) {
    return (
      <main className="order-success-page">
        <div className="order-success-card">
          <h1>Order Not Found</h1>
          <p>
            We could not find the order information.
          </p>

          <Link
            to="/"
            className="order-success-button"
          >
            Continue Shopping
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="order-success-page">
      <div className="order-success-card">

        <div className="success-icon">
          ✓
        </div>

        <h1>Order Confirmed!</h1>

        <p className="success-message">
          Thank you for your order. Your order has been
          successfully placed.
        </p>

        <div className="order-success-details">

          <div className="success-row">
            <span>Order Number</span>
            <strong>{order.order_number}</strong>
          </div>

          <div className="success-row">
            <span>Payment Method</span>
            <strong>{order.payment_method}</strong>
          </div>

          <div className="success-row">
            <span>Delivery Method</span>
            <strong>{order.delivery_method}</strong>
          </div>

          <div className="success-row">
            <span>Order Status</span>
            <strong>{order.status}</strong>
          </div>

          <div className="success-row total-row">
            <span>Total</span>
            <strong>
              ৳{Number(order.total).toFixed(2)}
            </strong>
          </div>

        </div>

        <div className="order-success-actions">

          <Link
            to="/"
            className="order-success-button"
          >
            Continue Shopping
          </Link>

        </div>

      </div>
    </main>
  )
}

export default OrderSuccess