import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'

function Cart() {
  const {
    cart,
    removeFromCart,
    updateQuantity,
  } = useCart()

  const navigate = useNavigate()
  const [selectedItemIds, setSelectedItemIds] = useState(
    () => cart.map((item) => item.id)
  )
  const [selectionError, setSelectionError] = useState('')

  useEffect(() => {
    const cartIds = new Set(cart.map((item) => item.id))

    setSelectedItemIds((currentIds) =>
      currentIds.filter((id) => cartIds.has(id))
    )
  }, [cart])

  if (cart.length === 0) {
    return (
      <main className="cart-page">
        <h1>Your Cart</h1>
        <p>Your cart is empty.</p>
      </main>
    )
  }

  const handleCheckout = () => {
    const selectedItems = cart.filter((item) =>
      selectedItemIds.includes(item.id)
    )

    if (selectedItems.length === 0) {
      setSelectionError(
        'Please select at least one product to proceed to checkout.'
      )
      return
    }

    setSelectionError('')
    navigate('/checkout', {
      state: {
        selectedItems,
      },
    })
  }

  const toggleItemSelection = (productId) => {
    setSelectionError('')
    setSelectedItemIds((currentIds) =>
      currentIds.includes(productId)
        ? currentIds.filter((id) => id !== productId)
        : [...currentIds, productId]
    )
  }

  const allItemsSelected =
    cart.length > 0 && selectedItemIds.length === cart.length

  const toggleSelectAll = () => {
    setSelectionError('')
    setSelectedItemIds(
      allItemsSelected ? [] : cart.map((item) => item.id)
    )
  }

  const selectedItems = cart.filter((item) =>
    selectedItemIds.includes(item.id)
  )

  const selectedCartTotal = selectedItems.reduce(
    (total, item) =>
      total +
      Number(item.discount_price || item.price) * item.quantity,
    0
  )

  return (
    <main className="cart-page">

      <h1>Your Cart</h1>

      <div className="cart-container">

        {/* Cart Items */}
        <div className="cart-items">

          <label className="cart-select-all">
            <input
              type="checkbox"
              checked={allItemsSelected}
              onChange={toggleSelectAll}
            />
            <span>Select All</span>
          </label>

          {cart.map((item) => {

            const price = Number(
              item.discount_price || item.price
            )

            return (
              <div
                className="cart-item"
                key={item.id}
              >

                <label className="cart-item-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedItemIds.includes(item.id)}
                    onChange={() => toggleItemSelection(item.id)}
                    aria-label={`Select ${item.name}`}
                  />
                </label>

                <div className="cart-item-image">

                  {item.images?.[0]?.image && (
                    <img
                      src={item.images[0].image}
                      alt={item.name}
                    />
                  )}

                </div>

                <div className="cart-item-info">

                  <h2>{item.name}</h2>

                  <p>
                    Price: ৳{price.toFixed(2)}
                  </p>

                  <div className="cart-quantity">

                    <button
                      type="button"
                      onClick={() =>
                        updateQuantity(
                          item.id,
                          item.quantity - 1
                        )
                      }
                      disabled={item.quantity <= 1}
                    >
                      −
                    </button>

                    <span>
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        updateQuantity(
                          item.id,
                          item.quantity + 1
                        )
                      }
                      disabled={
                        item.quantity >= item.stock
                      }
                    >
                      +
                    </button>

                  </div>

                  <p>
                    Subtotal: ৳
                    {(price * item.quantity).toFixed(2)}
                  </p>

                  <button
                    type="button"
                    className="remove-cart-button"
                    onClick={() => {
                      setSelectedItemIds((currentIds) =>
                        currentIds.filter((id) => id !== item.id)
                      )
                      removeFromCart(item.id)
                    }}
                  >
                    Remove
                  </button>

                </div>

              </div>
            )
          })}

        </div>


        {/* Cart Summary */}
        <div className="cart-summary">

          <h2>Cart Summary</h2>

          {selectionError && (
            <p className="cart-selection-error">
              {selectionError}
            </p>
          )}

          <div className="cart-selected-count">
            Selected: {selectedItems.length}{' '}
            {selectedItems.length === 1 ? 'item' : 'items'}
          </div>

          <div className="cart-total">

            <span>Total:</span>

            <strong>
              ৳{selectedCartTotal.toFixed(2)}
            </strong>

          </div>

          <button
            type="button"
            className="checkout-button"
            onClick={handleCheckout}
          >
            Proceed to Checkout
          </button>

        </div>

      </div>

    </main>
  )
}

export default Cart