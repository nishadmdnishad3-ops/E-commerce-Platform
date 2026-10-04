import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const API_URL = 'http://127.0.0.1:8000/api/admin/gift-vouchers/'

const emptyForm = {
  code: '',
  discount_type: 'fixed',
  discount_value: '',
  maximum_discount_amount: '',
  minimum_order_amount: '0',
  start_date: '',
  end_date: '',
  is_active: true,
}

export default function GiftVoucherForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyForm)
  const [voucher, setVoucher] = useState(null)
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [balanceLocked, setBalanceLocked] = useState(false)

  useEffect(() => {
    if (!editing) return
    const token = localStorage.getItem('access_token')
    if (!token) {
      navigate('/login')
      return
    }

    fetch(`${API_URL}${id}/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.detail || data.error || 'Unable to load gift voucher.')
        setVoucher(data)
        setBalanceLocked(Number(data.usage_count) > 0)
        setForm({
          code: data.code || '',
          discount_type: data.discount_type || 'fixed',
          discount_value: data.discount_value ?? data.initial_balance ?? '',
          maximum_discount_amount: data.maximum_discount_amount || '',
          minimum_order_amount: data.minimum_order_amount || '0',
          start_date: data.start_date || '',
          end_date: data.end_date || '',
          is_active: Boolean(data.is_active),
        })
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false))
  }, [editing, id, navigate])

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      minimum_order_amount: form.minimum_order_amount,
      start_date: form.start_date,
      end_date: form.end_date,
      is_active: form.is_active,
    }
    if (!editing || !balanceLocked) {
      payload.discount_value = form.discount_value
      payload.maximum_discount_amount = form.discount_type === 'percentage'
        ? form.maximum_discount_amount || null
        : null
    }

    try {
      const response = await fetch(editing ? `${API_URL}${id}/` : API_URL, {
        method: editing ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.detail || data.error || 'Unable to save gift voucher.')
      navigate('/admin/gift-vouchers')
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="admin-page"><div className="admin-panel-state">Loading gift voucher...</div></div>

  return (
    <div className="admin-page">
      <div className="admin-card form-card">
        <div className="admin-card-header">
          <h3>{editing ? 'Edit Gift Voucher' : 'Add Gift Voucher'}</h3>
        </div>

        <form onSubmit={handleSubmit} className="admin-form">
          <label>
            Voucher Code
            <input name="code" value={form.code} onChange={handleChange} maxLength="50" required />
          </label>

          <div className="double-field">
            <label>
              Discount Type
              <select
                name="discount_type"
                value={form.discount_type}
                onChange={handleChange}
                disabled={balanceLocked}
              >
                <option value="fixed">Fixed Amount</option>
                <option value="percentage">Percentage</option>
              </select>
            </label>
            <label>
              {form.discount_type === 'percentage' ? 'Discount Percentage (%)' : 'Discount Amount'}
              <input
                name="discount_value"
                type="number"
                min={form.discount_type === 'percentage' ? '0.01' : '0'}
                max={form.discount_type === 'percentage' ? '100' : undefined}
                step="0.01"
                value={form.discount_value}
                onChange={handleChange}
                readOnly={balanceLocked}
                required
              />
            </label>
          </div>

          {form.discount_type === 'percentage' ? (
            <label>
              Maximum Discount Amount (optional)
              <input
                name="maximum_discount_amount"
                type="number"
                min="0"
                step="0.01"
                value={form.maximum_discount_amount}
                onChange={handleChange}
                readOnly={balanceLocked}
              />
            </label>
          ) : null}

          <div className="double-field">
            <label>
              Minimum Order Amount
              <input
                name="minimum_order_amount"
                type="number"
                min="0"
                step="0.01"
                value={form.minimum_order_amount}
                onChange={handleChange}
                required
              />
            </label>
          </div>

          {balanceLocked ? (
            <p className="voucher-safety-note">
              This voucher has redemption history. Its discount type, value, and maximum discount cannot be changed.
              {voucher.discount_type === 'fixed' ? ` Remaining balance: ৳${Number(voucher.remaining_balance).toFixed(2)}.` : ''}
            </p>
          ) : null}

          <div className="double-field">
            <label>
              Start Date
              <input name="start_date" type="date" value={form.start_date} onChange={handleChange} required />
            </label>
            <label>
              End Date
              <input name="end_date" type="date" value={form.end_date} onChange={handleChange} required />
            </label>
          </div>

          <label className="checkbox-row">
            <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
            Active
          </label>

          {error ? <div className="form-error" role="alert">{error}</div> : null}

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Voucher'}
            </button>
            <button type="button" className="secondary-button" onClick={() => navigate('/admin/gift-vouchers')}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
