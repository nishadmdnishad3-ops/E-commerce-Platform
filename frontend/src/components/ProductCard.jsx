import { Link,useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'

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

      {/* Product Image */}
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

        {/* Discount Badge */}
        {hasDiscount && (
          <span className="product-discount-badge">
            {product.discount_percentage}% OFF
          </span>
        )}
      </Link>

      {/* Product Information */}
      <div className="product-info">

        {/* Product Name */}
        <Link
          to={`/product/${product.slug}`}
          className="product-title"
        >
          <h3>{product.name}</h3>
        </Link>

        {/* Price */}
        <div className="price">

          {hasDiscount ? (
            <>
              <span className="discount-price">
                ৳{product.discount_price}
              </span>

              <span className="old-price">
                ৳{product.price}
              </span>
            </>
          ) : (
            <span className="discount-price">
              ৳{product.price}
            </span>
          )}

        </div>

        {/* Buy Now */}
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