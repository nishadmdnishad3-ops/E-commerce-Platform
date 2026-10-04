import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { getCurrentUserId } from '../utils/auth'

const CartContext = createContext()
const GUEST_CART_KEY = 'guest_cart'

const getCartStorageKey = (userId) => userId ? `user_cart_${userId}` : GUEST_CART_KEY

const readCart = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

const writeCart = (key, cart) => {
  localStorage.setItem(key, JSON.stringify(cart))
}

const mergeCarts = (savedCart, guestCart) => {
  const merged = new Map()

  for (const item of [...savedCart, ...guestCart]) {
    if (item?.id === undefined || item?.id === null) continue
    const key = String(item.id)
    const current = merged.get(key)
    const quantity = Number(item.quantity) || 1

    merged.set(key, current
      ? { ...current, quantity: (Number(current.quantity) || 1) + quantity }
      : { ...item, quantity })
  }

  return Array.from(merged.values())
}

export function CartProvider({ children }) {
  const [initialUserId] = useState(() => getCurrentUserId())
  const [cart, setCart] = useState(() => {
    return mergeCarts(readCart(getCartStorageKey(initialUserId)), [])
  })
  const activeUserIdRef = useRef(initialUserId)
  const cartRef = useRef(cart)

  const updateCart = (update) => {
    setCart((currentCart) => {
      const nextCart = typeof update === 'function' ? update(currentCart) : update
      cartRef.current = nextCart
      return nextCart
    })
  }

  useEffect(() => {
    // The old shared key has no owner, so it cannot be safely assigned to an account.
    localStorage.removeItem('cart')

    const handleAuthChange = () => {
      const previousUserId = activeUserIdRef.current
      const nextUserId = getCurrentUserId()
      if (previousUserId === nextUserId) return

      writeCart(getCartStorageKey(previousUserId), cartRef.current)

      if (!nextUserId) {
        activeUserIdRef.current = null
        writeCart(GUEST_CART_KEY, [])
        cartRef.current = []
        setCart([])
        return
      }

      const guestCart = previousUserId ? [] : readCart(GUEST_CART_KEY)
      const nextCart = mergeCarts(readCart(getCartStorageKey(nextUserId)), guestCart)
      activeUserIdRef.current = nextUserId
      writeCart(GUEST_CART_KEY, [])
      cartRef.current = nextCart
      setCart(nextCart)
    }

    window.addEventListener('auth-change', handleAuthChange)
    return () => window.removeEventListener('auth-change', handleAuthChange)
  }, [])

  useEffect(() => {
    writeCart(getCartStorageKey(activeUserIdRef.current), cart)
    cartRef.current = cart
  }, [cart])

  // Add product to cart
  const addToCart = (product) => {
    updateCart((currentCart) => {
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
    updateCart((currentCart) =>
      currentCart.filter((item) => item.id !== productId)
    )
  }

  // Update product quantity
  const updateQuantity = (productId, quantity) => {
    if (quantity < 1) {
      return
    }

    updateCart((currentCart) =>
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
    updateCart([])
  }

  // Total number of products
  const cartCount = cart.reduce(
    (total, item) => total + (Number(item.quantity) || 0),
    0
  )

  // Total cart price
  const cartTotal = cart.reduce(
    (total, item) =>
      total +
      Number(item.discount_price || item.price) * (Number(item.quantity) || 0),
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