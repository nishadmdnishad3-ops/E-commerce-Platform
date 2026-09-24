import { createContext, useContext, useEffect, useState } from 'react'

const WishlistContext = createContext(null)
const API_URL = 'http://127.0.0.1:8000/api/wishlist'

function getToken() {
  return localStorage.getItem('access_token')
}

function clearExpiredAuth() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('username')
  window.dispatchEvent(new Event('auth-change'))
}

async function wishlistRequest(path, options = {}) {
  const token = getToken()

  if (!token) {
    const error = new Error('Please login to use your wishlist.')
    error.status = 401
    throw error
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    const error = new Error(
      data?.error || 'Unable to update your wishlist.'
    )
    error.status = response.status
    throw error
  }

  return data
}

export function WishlistProvider({ children }) {
  const [wishlist, setWishlist] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadWishlist = async () => {
    if (!getToken()) {
      setWishlist([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await wishlistRequest('/')
      setWishlist(data)
    } catch (requestError) {
      if (requestError.status === 401) {
        setWishlist([])
        clearExpiredAuth()
      }
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWishlist()

    const handleAuthChange = () => {
      loadWishlist()
    }

    window.addEventListener('auth-change', handleAuthChange)

    return () => {
      window.removeEventListener('auth-change', handleAuthChange)
    }
  }, [])

  const addToWishlist = async (product) => {
    setError(null)

    try {
      const item = await wishlistRequest('/add/', {
        method: 'POST',
        body: JSON.stringify({ product_id: product.id }),
      })

      setWishlist((currentWishlist) => {
        const exists = currentWishlist.some(
          (wishlistItem) => wishlistItem.product.id === item.product.id
        )

        return exists
          ? currentWishlist
          : [item, ...currentWishlist]
      })

      return item
    } catch (requestError) {
      if (requestError.status === 401) {
        clearExpiredAuth()
      }
      setError(requestError.message)
      throw requestError
    }
  }

  const removeFromWishlist = async (productId) => {
    setError(null)

    try {
      await wishlistRequest(`/remove/${productId}/`, {
        method: 'DELETE',
      })

      setWishlist((currentWishlist) =>
        currentWishlist.filter(
          (item) => item.product.id !== productId
        )
      )
    } catch (requestError) {
      if (requestError.status === 401) {
        clearExpiredAuth()
      }
      setError(requestError.message)
      throw requestError
    }
  }

  const toggleWishlist = async (product) => {
    setError(null)

    try {
      const data = await wishlistRequest('/toggle/', {
        method: 'POST',
        body: JSON.stringify({ product_id: product.id }),
      })

      if (data.is_in_wishlist) {
        setWishlist((currentWishlist) => [
          data.item,
          ...currentWishlist.filter(
            (item) => item.product.id !== product.id
          ),
        ])
      } else {
        setWishlist((currentWishlist) =>
          currentWishlist.filter(
            (item) => item.product.id !== product.id
          )
        )
      }

      return data.is_in_wishlist
    } catch (requestError) {
      if (requestError.status === 401) {
        clearExpiredAuth()
      }
      setError(requestError.message)
      throw requestError
    }
  }

  const clearWishlist = () => {
    setWishlist([])
  }

  const isInWishlist = (productId) =>
    wishlist.some((item) => item.product.id === productId)

  return (
    <WishlistContext.Provider
      value={{
        wishlist,
        wishlistCount: wishlist.length,
        loading,
        error,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        isInWishlist,
        clearWishlist,
        reloadWishlist: loadWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  )
}

export function useWishlist() {
  return useContext(WishlistContext)
}
