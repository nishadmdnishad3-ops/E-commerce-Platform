const statusClasses = {
  Pending: 'status-pending',
  Confirmed: 'status-confirmed',
  Processing: 'status-processing',
  Shipped: 'status-shipped',
  Delivered: 'status-delivered',
  Cancelled: 'status-cancelled',
}

export default function OrderStatusBadge({ status }) {
  return <span className={`order-status-badge ${statusClasses[status] || 'status-default'}`}>{status}</span>
}
