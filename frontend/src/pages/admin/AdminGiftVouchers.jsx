import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const API_URL = 'http://127.0.0.1:8000/api/admin/gift-vouchers/'

export default function AdminGiftVouchers() {
  const [vouchers, setVouchers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const navigate = useNavigate()

  const loadVouchers = useCallback(async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      navigate('/login')
      return
    }

    try {
      const response = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.detail || data.error || 'Unable to load gift vouchers.')
      }
      setVouchers(data.results || data)
      setError('')
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    loadVouchers()
  }, [loadVouchers])

  const updateStatus = async (voucher) => {
    setBusyId(voucher.id)
    setError('')
    try {
      const response = await fetch(`${API_URL}${voucher.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({ is_active: !voucher.is_active }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.detail || data.error || 'Unable to update voucher status.')
      }
      await loadVouchers()
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusyId(null)
    }
  }

  const deleteVoucher = async (voucher) => {
    if (Number(voucher.usage_count) > 0) return
    if (!window.confirm(`Delete unused voucher ${voucher.code}?`)) return

    setBusyId(voucher.id)
    setError('')
    try {
      const response = await fetch(`${API_URL}${voucher.id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.detail || data.error || 'Unable to delete voucher.')
      }
      await loadVouchers()
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-toolbar admin-toolbar-right">
        <Link to="/admin/gift-vouchers/add" className="primary-button">+ Add Gift Voucher</Link>
      </div>

      {loading ? (
        <div className="admin-panel-state">Loading gift vouchers...</div>
      ) : error ? (
        <div className="admin-panel-state error" role="alert">{error}</div>
      ) : (
        <>
          <div className="admin-card table-card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Type</th>
                    <th>Discount</th>
                    <th>Maximum Discount</th>
                    <th>Minimum Order</th>
                    <th>Validity</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.length === 0 ? (
                    <tr><td colSpan="8">No gift vouchers found.</td></tr>
                  ) : vouchers.map((voucher) => (
                    <tr key={voucher.id}>
                      <td>{voucher.code}</td>
                      <td>{voucher.discount_type === 'percentage' ? 'Percentage' : 'Fixed'}</td>
                      <td>
                        {voucher.discount_type === 'percentage'
                          ? `${Number(voucher.discount_value).toFixed(2)}%`
                          : `৳${Number(voucher.discount_value ?? voucher.initial_balance).toFixed(2)}`}
                        {voucher.discount_type === 'fixed' && Number(voucher.remaining_balance) !== Number(voucher.initial_balance) ? (
                          <small className="voucher-balance-note">Remaining ৳{Number(voucher.remaining_balance).toFixed(2)}</small>
                        ) : null}
                      </td>
                      <td>
                        {voucher.maximum_discount_amount == null
                          ? '—'
                          : `৳${Number(voucher.maximum_discount_amount).toFixed(2)}`}
                      </td>
                      <td>৳{Number(voucher.minimum_order_amount).toFixed(2)}</td>
                      <td>{voucher.start_date} – {voucher.end_date}</td>
                      <td>
                        <span className={`voucher-status ${voucher.is_active ? 'active' : 'inactive'}`}>
                          {voucher.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="voucher-actions">
                          <Link to={`/admin/gift-vouchers/edit/${voucher.id}`} className="mini-link">Edit</Link>
                          <button
                            type="button"
                            className="voucher-action-button"
                            disabled={busyId === voucher.id}
                            onClick={() => updateStatus(voucher)}
                          >
                            {voucher.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            className="voucher-action-button"
                            disabled={busyId === voucher.id || Number(voucher.usage_count) > 0}
                            title={Number(voucher.usage_count) > 0 ? 'Redeemed vouchers cannot be deleted.' : 'Delete unused voucher'}
                            onClick={() => deleteVoucher(voucher)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </>
      )}
    </div>
  )
}
