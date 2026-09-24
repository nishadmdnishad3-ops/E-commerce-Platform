import { createContext, useContext, useEffect, useState } from 'react'

const CartContext = createContext()

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    const savedCart = localStorage.getItem('cart')

    return savedCart ? JSON.parse(savedCart) : []
  })

  // Save cart whenever cart changes
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart))
  }, [cart])

  // Add product to cart
  const addToCart = (product) => {
    setCart((currentCart) => {
      const existingProduct = currentCart.find(
        (item) => item.id === product.id
      )

      const quantityToAdd = product.quantity || 1

      if (existingProduct) {
        return currentCart.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + quantityToAdd,
              }
            : item
        )
      }

      return [
        ...currentCart,
        {
          ...product,
          quantity: quantityToAdd,
        },
      ]
    })
  }

  // Remove product from cart
  const removeFromCart = (productId) => {
    setCart((currentCart) =>
      currentCart.filter((item) => item.id !== productId)
    )
  }

  // Update product quantity
  const updateQuantity = (productId, quantity) => {
    if (quantity < 1) {
      return
    }

    setCart((currentCart) =>
      currentCart.map((item) =>
        item.id === productId
          ? {
              ...item,
              quantity,
            }
          : item
      )
    )
  }

  // Clear entire cart
  const clearCart = () => {
    setCart([])
  }

  // Total number of products
  const cartCount = cart.reduce(
    (total, item) => total + item.quantity,
    0
  )

  // Total cart price
  const cartTotal = cart.reduce(
    (total, item) =>
      total +
      Number(item.discount_price || item.price) * item.quantity,
    0
  )

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartCount,
        cartTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}