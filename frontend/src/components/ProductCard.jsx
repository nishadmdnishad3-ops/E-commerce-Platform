import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'
import { formatPrice } from '../utils/formatPrice'

function ProductCard({ product }) {
  const { addToCart } = useCart()
  const { isInWishlist, toggleWishlist } = useWishlist()
  const navigate = useNavigate()

  const image =
    product.images?.find((img) => img.is_primary)?.image ||
    product.images?.[0]?.image

  const hasDiscount =
    product.discount_percentage > 0 &&
    product.discount_price

  const renderStars = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return '☆☆☆☆☆'
    }

    const safeValue = Math.max(0, Math.min(5, Number(value)))
    const filledStars = Math.round(safeValue)
    return `${'★'.repeat(filledStars)}${'☆'.repeat(5 - filledStars)}`
  }

  const handleBuyNow = () => {
    addToCart({
      ...product,
      quantity: 1,
    })

    navigate('/checkout')
  }

  const handleWishlist = async (event) => {
    event.preventDefault()
    event.stopPropagation()

    if (!localStorage.getItem('access_token')) {
      navigate('/login')
      return
    }

    try {
      await toggleWishlist(product)
    } catch (error) {
      console.error('WISHLIST ERROR:', error)
      if (error.status === 401) {
        navigate('/login')
      }
    }
  }

  return (
    <div className="product-card">

      <button
        type="button"
        className={`wishlist-heart-button ${isInWishlist(product.id) ? 'is-active' : ''}`}
        onClick={handleWishlist}
        aria-label={isInWishlist(product.id) ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
        aria-pressed={isInWishlist(product.id)}
      >
        {isInWishlist(product.id) ? '❤️' : '♡'}
      </button>

      <Link
        to={`/product/${product.slug}`}
        className="product-image"
      >
        {image && (
          <img
            src={image}
            alt={product.name}
          />
        )}

        {hasDiscount && (
          <span className="product-discount-badge">
            {product.discount_percentage}% OFF
          </span>
        )}
      </Link>

      <div className="product-info">

        <Link
          to={`/product/${product.slug}`}
          className="product-title"
        >
          <h3>{product.name}</h3>
        </Link>

        <div className="price">

          {hasDiscount ? (
            <>
              <span className="discount-price">
                {formatPrice(product.discount_price)}
              </span>

              <span className="old-price">
                {formatPrice(product.price)}
              </span>
            </>
          ) : (
            <span className="discount-price">
              {formatPrice(product.price)}
            </span>
          )}

        </div>

        {product.review_count > 0 ? (
          <div className="product-card-rating">
            <span className="product-card-stars">
              {renderStars(product.average_rating)}
            </span>
            <span>
              {Number(product.average_rating).toFixed(1)} ({product.review_count})
            </span>
          </div>
        ) : (
          <div className="product-card-rating empty">
            No reviews yet
          </div>
        )}

        <button
          type="button"
          className="buy-now-button"
          onClick={handleBuyNow}
        >
          Buy Now
        </button>

      </div>

    </div>
  )
}

export default ProductCard