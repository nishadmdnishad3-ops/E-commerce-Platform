import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'

function Checkout() {
  const location = useLocation()
  const navigate = useNavigate()

  const {
    cart,
    removeFromCart,
  } = useCart()

  const navigationSelectedItems =
    location.state?.selectedItems

  const checkoutItems =
    Array.isArray(navigationSelectedItems) &&
    navigationSelectedItems.length > 0
      ? navigationSelectedItems
      : cart

  const checkoutTotal = checkoutItems.reduce(
    (total, item) =>
      total +
      Number(item.discount_price || item.price) * item.quantity,
    0
  )

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    address: '',
    upazila: '',
    district: 'Dhaka - City',
    mobile: '',
    email: '',
    comment: '',
  })

  const [paymentMethod, setPaymentMethod] = useState(
    'Cash on Delivery'
  )

  const [deliveryMethod, setDeliveryMethod] = useState(
    'Home Delivery'
  )

  const [coupon, setCoupon] = useState('')
  const [couponApplied, setCouponApplied] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState({})

  if (checkoutItems.length === 0) {
    return (
      <main className="checkout-empty">
        <h1>Your Cart is Empty</h1>
        <p>Add some products before going to checkout.</p>

        <button
          type="button"
          onClick={() => navigate('/')}
        >
          Continue Shopping
        </button>
      </main>
    )
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target

    setFormData((current) => ({
      ...current,
      [name]: value,
    }))

    const message = validateField(name, value)

    setErrors((currentErrors) => {
      const nextErrors = { ...currentErrors }

      if (message) {
        nextErrors[name] = message
      } else {
        delete nextErrors[name]
      }

      return nextErrors
    })
  }

  const validateField = (field, value) => {
    const trimmedValue = value.trim()

    if (!trimmedValue) {
      return 'This field is required.'
    }

    if (
      field === 'email' &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)
    ) {
      return 'Enter a valid email address.'
    }

    if (
      field === 'mobile' &&
      !/^[0-9+\-\s()]{7,}$/.test(trimmedValue)
    ) {
      return 'Enter a valid mobile number.'
    }

    return ''
  }

  const validateForm = () => {
    const nextErrors = {}
    const requiredFields = [
      'firstName',
      'lastName',
      'address',
      'upazila',
      'district',
      'mobile',
      'email',
    ]

    requiredFields.forEach((field) => {
      const message = validateField(field, formData[field])

      if (message) {
        nextErrors[field] = message
      }
    })

    if (!paymentMethod) {
      nextErrors.payment_method = 'Select a payment method.'
    }

    if (!deliveryMethod) {
      nextErrors.delivery_method = 'Select a delivery method.'
    }

    if (!termsAccepted) {
      nextErrors.terms = 'You must accept the terms and conditions.'
    }

    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      const firstError = Object.keys(nextErrors)[0]
      const fieldName = {
        payment_method: 'payment',
        delivery_method: 'delivery',
        terms: 'terms',
      }[firstError] || firstError

      document.querySelector(`[name="${fieldName}"]`)?.focus()
      return false
    }

    return true
  }

  const getDeliveryFee = () => {
    if (deliveryMethod === 'Store Pickup') {
      return 0
    }

    if (deliveryMethod === 'Express Delivery') {
      return 120
    }

    return 70
  }

  const deliveryFee = getDeliveryFee()

  const discountAmount = couponApplied
    ? checkoutTotal * 0.05
    : 0

  const finalTotal =
    checkoutTotal -
    discountAmount +
    deliveryFee

  const handleCoupon = () => {
    if (!coupon.trim()) {
      alert('Please enter a coupon code.')
      return
    }

    if (coupon.trim().toUpperCase() === 'TECH5') {
      setCouponApplied(true)
      alert('Coupon applied! You received 5% discount.')
    } else {
      setCouponApplied(false)
      alert('Invalid coupon code.')
    }
  }

  const handleConfirmOrder = async (e) => {
    e.preventDefault()

    if (isSubmitting) {
      return
    }

  if (!validateForm()) {
    return
  }

  if (checkoutItems.length === 0) {
    alert('Your cart is empty.')
    return
  }

  const token = localStorage.getItem('access_token')

  if (!token) {
    alert('Please login before placing an order.')
    navigate('/login')
    return
  }

  setIsSubmitting(true)

  try {
    const orderData = {
      first_name: formData.firstName,
      last_name: formData.lastName,
      address: formData.address,
      upazila: formData.upazila,
      district: formData.district,
      mobile: formData.mobile,
      email: formData.email,
      comment: formData.comment,

      payment_method: paymentMethod,
      delivery_method: deliveryMethod,

      coupon: coupon.trim().toUpperCase(),

      items: checkoutItems.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
      })),
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }

      const response = await fetch(
        'http://127.0.0.1:8000/api/orders/create/',
        {
          method: 'POST',
          headers,
          body: JSON.stringify(orderData),
        }
      )

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.detail ||
        'Failed to create order.'
      )
    }

    checkoutItems.forEach((item) => {
      removeFromCart(item.id)
    })

    navigate('/order-success', {
  state: {
    order: {
      order_number: data.order_number,
      payment_method: paymentMethod,
      delivery_method: deliveryMethod,
      total: data.total,
      status: data.status,
          },
        },
      })
  } catch (error) {
    console.error('ORDER ERROR:', error)

    alert(
      error.message ||
      'Something went wrong while creating the order.'
    )
  } finally {
    setIsSubmitting(false)
  }
 }
  return (
    <main className="checkout-page">

      <form
        className="checkout-layout"
        onSubmit={handleConfirmOrder}
        noValidate
      >

        {/* LEFT SIDE */}
        <div className="checkout-left">

          {/* Shipping & Billing */}
          <section className="checkout-card">

            <div className="checkout-section-title">
              <span>▣</span>
              <h2>Shipping & Billing</h2>
            </div>

            <div className="checkout-divider"></div>

            <div className="checkout-form-grid">

              {/* First Name */}
              <div className="checkout-field">
                <label>
                  First Name <span className="required-star">*</span>
                </label>

                <input
                  type="text"
                  name="firstName"
                  placeholder="First Name*"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className={errors.firstName ? 'field-error' : ''}
                  required
                />
                {errors.firstName && (
                  <span className="field-error-message">
                    {errors.firstName}
                  </span>
                )}
              </div>

              {/* Last Name */}
              <div className="checkout-field">
                <label>
                  Last Name <span className="required-star">*</span>
                </label>

                <input
                  type="text"
                  name="lastName"
                  placeholder="Last Name*"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className={errors.lastName ? 'field-error' : ''}
                  required
                />
                {errors.lastName && (
                  <span className="field-error-message">
                    {errors.lastName}
                  </span>
                )}
              </div>

              {/* Address */}
              <div className="checkout-field full-width">
                <label>
                  Address <span className="required-star">*</span>
                </label>

                <input
                  type="text"
                  name="address"
                  placeholder="Address*"
                  value={formData.address}
                  onChange={handleInputChange}
                  className={errors.address ? 'field-error' : ''}
                  required
                />
                {errors.address && (
                  <span className="field-error-message">
                    {errors.address}
                  </span>
                )}
              </div>

              {/* Upazila */}
              <div className="checkout-field">
                <label>
                  Upazila/Thana <span className="required-star">*</span>
                </label>

                <input
                  type="text"
                  name="upazila"
                  placeholder="Upazila/Thana*"
                  value={formData.upazila}
                  onChange={handleInputChange}
                  className={errors.upazila ? 'field-error' : ''}
                  required
                />
                {errors.upazila && (
                  <span className="field-error-message">
                    {errors.upazila}
                  </span>
                )}
              </div>

              {/* District */}
              <div className="checkout-field">
                <label>
                  District <span className="required-star">*</span>
                </label>

                <select
                  name="district"
                  value={formData.district}
                  onChange={handleInputChange}
                  className={errors.district ? 'field-error' : ''}
                >
                  <option>Dhaka - City</option>
                  <option>Dhaka - Outside City</option>
                  <option>Gazipur</option>
                  <option>Narayanganj</option>
                  <option>Chattogram</option>
                  <option>Sylhet</option>
                  <option>Rajshahi</option>
                  <option>Khulna</option>
                  <option>Barishal</option>
                  <option>Rangpur</option>
                  <option>Mymensingh</option>
                  <option>Comilla</option>
                  <option>Other</option>
                </select>
                {errors.district && (
                  <span className="field-error-message">
                    {errors.district}
                  </span>
                )}
              </div>

              {/* Mobile */}
              <div className="checkout-field">
                <label>
                  Mobile <span className="required-star">*</span>
                </label>

                <input
                  type="tel"
                  name="mobile"
                  placeholder="Telephone*"
                  value={formData.mobile}
                  onChange={handleInputChange}
                  className={errors.mobile ? 'field-error' : ''}
                  required
                />
                {errors.mobile && (
                  <span className="field-error-message">
                    {errors.mobile}
                  </span>
                )}
              </div>

              {/* Email */}
              <div className="checkout-field">
                <label>
                  E-Mail <span className="required-star">*</span>
                </label>

                <input
                  type="email"
                  name="email"
                  placeholder="E-Mail*"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={errors.email ? 'field-error' : ''}
                  required
                />
                {errors.email && (
                  <span className="field-error-message">
                    {errors.email}
                  </span>
                )}
              </div>

              {/* Comment */}
              <div className="checkout-field full-width">
                <label>
                  Comment
                </label>

                <textarea
                  name="comment"
                  placeholder="Any special requirement/instruction for us?"
                  value={formData.comment}
                  onChange={handleInputChange}
                />
              </div>

            </div>

          </section>


          {/* Bottom Section */}
          <div className="checkout-bottom-grid">

            {/* Payment */}
            <section
              className={`checkout-card payment-card ${errors.payment_method ? 'section-error' : ''}`}
            >

              <div className="checkout-section-title">
                <span>▣</span>
                <h2>Payment Method</h2>
              </div>

              <div className="checkout-divider"></div>

              <p className="checkout-help-text">
                Select a payment method
              </p>

              <label className="radio-option">
                <input
                  type="radio"
                  name="payment"
                  value="Cash on Delivery"
                  checked={
                    paymentMethod === 'Cash on Delivery'
                  }
                  onChange={(e) => {
                    setPaymentMethod(e.target.value)
                    setErrors((currentErrors) => {
                      const nextErrors = { ...currentErrors }
                      delete nextErrors.payment_method
                      return nextErrors
                    })
                  }}
                />

                <span>Cash on Delivery</span>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  name="payment"
                  value="Online Payment"
                  checked={
                    paymentMethod === 'Online Payment'
                  }
                  onChange={(e) => {
                    setPaymentMethod(e.target.value)
                    setErrors((currentErrors) => {
                      const nextErrors = { ...currentErrors }
                      delete nextErrors.payment_method
                      return nextErrors
                    })
                  }}
                />

                <span>Online Payment</span>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  name="payment"
                  value="POS on Delivery"
                  checked={
                    paymentMethod === 'POS on Delivery'
                  }
                  onChange={(e) => {
                    setPaymentMethod(e.target.value)
                    setErrors((currentErrors) => {
                      const nextErrors = { ...currentErrors }
                      delete nextErrors.payment_method
                      return nextErrors
                    })
                  }}
                />

                <span>POS on Delivery</span>
              </label>

              <div className="payment-note">
                <strong>Payment Selected:</strong>
                <span>{paymentMethod}</span>
              </div>

              {errors.payment_method && (
                <span className="section-error-message">
                  {errors.payment_method}
                </span>
              )}

            </section>


            {/* Delivery */}
            <section
              className={`checkout-card delivery-card ${errors.delivery_method ? 'section-error' : ''}`}
            >

              <div className="checkout-section-title">
                <span>▣</span>
                <h2>Delivery Method</h2>
              </div>

              <div className="checkout-divider"></div>

              <p className="checkout-help-text">
                Select a delivery method
              </p>

              <label className="radio-option">
                <input
                  type="radio"
                  name="delivery"
                  value="Home Delivery"
                  checked={
                    deliveryMethod === 'Home Delivery'
                  }
                  onChange={(e) => {
                    setDeliveryMethod(e.target.value)
                    setErrors((currentErrors) => {
                      const nextErrors = { ...currentErrors }
                      delete nextErrors.delivery_method
                      return nextErrors
                    })
                  }}
                />

                <span>
                  Home Delivery - 70৳
                </span>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  name="delivery"
                  value="Store Pickup"
                  checked={
                    deliveryMethod === 'Store Pickup'
                  }
                  onChange={(e) => {
                    setDeliveryMethod(e.target.value)
                    setErrors((currentErrors) => {
                      const nextErrors = { ...currentErrors }
                      delete nextErrors.delivery_method
                      return nextErrors
                    })
                  }}
                />

                <span>
                  Store Pickup - 0৳
                </span>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  name="delivery"
                  value="Express Delivery"
                  checked={
                    deliveryMethod === 'Express Delivery'
                  }
                  onChange={(e) => {
                    setDeliveryMethod(e.target.value)
                    setErrors((currentErrors) => {
                      const nextErrors = { ...currentErrors }
                      delete nextErrors.delivery_method
                      return nextErrors
                    })
                  }}
                />

                <span>
                  Express Delivery - 120৳
                </span>
              </label>

            </section>

          </div>

        </div>


        {/* RIGHT SIDE */}
        <aside className="checkout-right">

          <section className="checkout-card order-summary">

            <div className="checkout-section-title">
              <span>▤</span>
              <h2>Order Summary</h2>
            </div>

            <div className="checkout-divider"></div>

            {/* Coupon */}
            <div className="coupon-box">

              <h3>Get Some Extra</h3>

              <p>
                Use coupon/voucher
              </p>

              <div className="coupon-buttons">
                <button
                  type="button"
                  className="coupon-type active"
                >
                  ▣ Coupon
                </button>

                <button
                  type="button"
                  className="coupon-type"
                  disabled
                >
                  Gift Voucher
                </button>
              </div>

              <div className="coupon-input-row">

                <input
                  type="text"
                  placeholder="Promo / Coupon Code"
                  value={coupon}
                  onChange={(e) =>
                    setCoupon(e.target.value)
                  }
                />

                <button
                  type="button"
                  onClick={handleCoupon}
                >
                  Apply
                </button>

              </div>

              {couponApplied && (
                <p className="coupon-success">
                  ✓ TECH5 applied successfully
                </p>
              )}

            </div>


            {/* Summary */}
            <div className="summary-lines">

              <div className="summary-row">
                <span>Sub-Total:</span>

                <strong>
                  ৳{checkoutTotal.toFixed(2)}
                </strong>
              </div>

              {couponApplied && (
                <div className="summary-row discount-row">
                  <span>Discount:</span>

                  <strong>
                    -৳{discountAmount.toFixed(2)}
                  </strong>
                </div>
              )}

              <div className="summary-row">
                <span>
                  {deliveryMethod === 'Store Pickup'
                    ? 'Store Pickup:'
                    : 'Delivery:'}
                </span>

                <strong>
                  ৳{deliveryFee.toFixed(2)}
                </strong>
              </div>

              <div className="summary-total">
                <span>Total:</span>

                <strong>
                  ৳{finalTotal.toFixed(2)}
                </strong>
              </div>

            </div>


            {/* Terms */}
            <label
              className={`terms-option ${errors.terms ? 'terms-error' : ''}`}
            >

              <input
                type="checkbox"
                name="terms"
                checked={termsAccepted}
                onChange={(e) => {
                  setTermsAccepted(e.target.checked)

                  if (e.target.checked) {
                    setErrors((currentErrors) => {
                      const nextErrors = { ...currentErrors }
                      delete nextErrors.terms
                      return nextErrors
                    })
                  }
                }}
              />

              <span>
                I have read and agree to the{' '}
                <a href="#terms">
                  Terms and Conditions
                </a>
                ,{' '}
                <a href="#privacy">
                  Privacy Policy
                </a>{' '}
                and{' '}
                <a href="#refund">
                  Refund and Return Policy
                </a>
              </span>

            </label>

            {errors.terms && (
              <span className="section-error-message">
                {errors.terms}
              </span>
            )}


            {/* Confirm */}
            {Object.keys(errors).length > 0 && (
              <p className="checkout-validation-summary">
                Please fill in all required fields.
              </p>
            )}
            <button
              type="submit"
              className="confirm-order-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Processing Order...' : 'Confirm Order'}
            </button>

          </section>

        </aside>

      </form>

    </main>
  )
}

export default Checkout