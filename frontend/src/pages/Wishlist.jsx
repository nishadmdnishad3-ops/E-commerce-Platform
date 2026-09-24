import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'

function Wishlist() {
  const navigate = useNavigate()
  const { addToCart } = useCart()
  const {
    wishlist,
    loading,
    error,
    removeFromWishlist,
  } = useWishlist()
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    if (!localStorage.getItem('access_token') || error?.includes('login')) {
      navigate('/login', { replace: true })
    }
  }, [error, navigate])

  const handleRemove = async (productId) => {
    setActionError('')

    try {
      await removeFromWishlist(productId)
    } catch (requestError) {
      setActionError(requestError.message)

      if (requestError.status === 401) {
        navigate('/login', { replace: true })
      }
    }
  }

  const handleAddToCart = (product) => {
    if (product.stock <= 0) {
      return
    }

    addToCart({
      ...product,
      quantity: 1,
    })
  }

  if (loading) {
    return (
      <main className="wishlist-page">
        <p>Loading your wishlist...</p>
      </main>
    )
  }

  return (
    <main className="wishlist-page">
      <div className="wishlist-header">
        <div>
          <p className="wishlist-eyebrow">Saved for later</p>
          <h1>My Wishlist</h1>
        </div>
        <span className="wishlist-total">
          {wishlist.length} {wishlist.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {(error || actionError) && (
        <p className="wishlist-error">{actionError || error}</p>
      )}

      {wishlist.length === 0 ? (
        <section className="wishlist-empty">
          <span className="wishlist-empty-icon" aria-hidden="true">♡</span>
          <h2>Your wishlist is empty</h2>
          <p>Save products here to find them quickly later.</p>
          <Link to="/" className="wishlist-shop-button">Browse Products</Link>
        </section>
      ) : (
        <div className="wishlist-list">
          {wishlist.map(({ product }) => {
            const image =
              product.images?.find((item) => item.is_primary)?.image ||
              product.images?.[0]?.image
            const hasDiscount =
              product.discount_percentage > 0 && product.discount_price

            return (
              <article className="wishlist-item" key={product.id}>
                <Link
                  to={`/product/${product.slug}`}
                  className="wishlist-item-image"
                >
                  {image && (
                    <img src={image} alt={product.name} />
                  )}
                </Link>

                <div className="wishlist-item-info">
                  <Link
                    to={`/product/${product.slug}`}
                    className="wishlist-item-title"
                  >
                    {product.name}
                  </Link>
                  <div className="wishlist-item-price">
                    <strong>৳{product.discount_price || product.price}</strong>
                    {hasDiscount && <del>৳{product.price}</del>}
                  </div>
                  <span className={product.stock > 0 ? 'wishlist-stock in-stock' : 'wishlist-stock out-of-stock'}>
                    {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                  </span>
                </div>

                <div className="wishlist-item-actions">
                  <button
                    type="button"
                    className="wishlist-cart-button"
                    onClick={() => handleAddToCart(product)}
                    disabled={product.stock <= 0}
                  >
                    Add to Cart
                  </button>
                  <Link
                    to={`/product/${product.slug}`}
                    className="wishlist-view-button"
                  >
                    View Product
                  </Link>
                  <button
                    type="button"
                    className="wishlist-remove-button"
                    onClick={() => handleRemove(product.id)}
                  >
                    Remove
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </main>
  )
}

export default Wishlist
