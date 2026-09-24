import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'

function ProductDetails() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { addToCart } = useCart()
  const { isInWishlist, toggleWishlist } = useWishlist()

  const [product, setProduct] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`http://127.0.0.1:8000/api/products/${slug}/`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Product not found')
        }

        return response.json()
      })
      .then((data) => {
        setProduct(data)

        const primaryImage =
          data.images?.find((img) => img.is_primary)?.image ||
          data.images?.[0]?.image

        setSelectedImage(primaryImage)
        setLoading(false)
      })
      .catch((error) => {
        console.error(error)
        setError(error.message)
        setLoading(false)
      })
  }, [slug])

  if (loading) {
    return <p>Loading product...</p>
  }

  if (error) {
    return <p>{error}</p>
  }

  const increaseQuantity = () => {
    const currentQuantity = Number(quantity) || 1

    if (currentQuantity < product.stock) {
      setQuantity(currentQuantity + 1)
    }
  }

  const decreaseQuantity = () => {
    const currentQuantity = Number(quantity) || 1

    if (currentQuantity > 1) {
      setQuantity(currentQuantity - 1)
    }
  }

  const handleQuantityChange = (e) => {
    const value = e.target.value

    // Allow the input to be temporarily empty
    if (value === '') {
      setQuantity('')
      return
    }

    const number = Number(value)

    // Only allow numbers within stock limit
    if (number >= 1 && number <= product.stock) {
      setQuantity(number)
    }
  }

  const handleQuantityBlur = () => {
    // If input is empty or invalid, reset to 1
    if (quantity === '' || Number(quantity) < 1) {
      setQuantity(1)
    }
  }

  const handleAddToCart = () => {
    const finalQuantity = Number(quantity) || 1

    console.log('ADDING TO CART:', product)
    console.log('QUANTITY:', finalQuantity)

    addToCart({
      ...product,
      quantity: finalQuantity,
    })

    alert(`${product.name} added to cart!`)
  }

  const handleWishlist = async () => {
    if (!localStorage.getItem('access_token')) {
      navigate('/login')
      return
    }

    try {
      await toggleWishlist(product)
    } catch (requestError) {
      console.error('WISHLIST ERROR:', requestError)
      if (requestError.status === 401) {
        navigate('/login')
      }
    }
  }

  return (
    <main className="product-details">

      {/* Product Images */}
      <div className="product-details-image-section">

        <div className="main-product-image">
          {selectedImage && (
            <img
              src={selectedImage}
              alt={product.name}
            />
          )}
        </div>

        <div className="product-thumbnails">
          {product.images?.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setSelectedImage(img.image)}
            >
              <img
                src={img.image}
                alt={img.alt_text || product.name}
              />
            </button>
          ))}
        </div>

      </div>

      {/* Product Information */}
      <div className="product-details-info">

        <div className="product-details-title-row">
          <h1>{product.name}</h1>
          <button
            type="button"
            className={`details-wishlist-button ${isInWishlist(product.id) ? 'is-active' : ''}`}
            onClick={handleWishlist}
            aria-label={isInWishlist(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}
            aria-pressed={isInWishlist(product.id)}
          >
            <span aria-hidden="true">
              {isInWishlist(product.id) ? '❤️' : '♡'}
            </span>
            <span>
              {isInWishlist(product.id)
                ? 'In Wishlist'
                : 'Add to Wishlist'}
            </span>
          </button>
        </div>

        <p className="product-details-brand">
          Brand: {product.brand_name || 'Brand'}
        </p>

        <div className="product-details-price">

          <strong>
            ৳{product.discount_price || product.price}
          </strong>

          {product.discount_percentage > 0 && (
            <>
              <del>
                ৳{product.price}
              </del>

              <span className="details-discount-badge">
                {product.discount_percentage}% OFF
              </span>
            </>
          )}

        </div>

        <p className="stock">
          Stock: {product.stock}
        </p>

        {/* Quantity */}
        <div className="quantity-selector">

          <span>Quantity:</span>

          <button
            type="button"
            onClick={decreaseQuantity}
            disabled={quantity !== '' && Number(quantity) <= 1}
          >
            −
          </button>

          <input
            type="number"
            min="1"
            max={product.stock}
            value={quantity}
            onChange={handleQuantityChange}
            onBlur={handleQuantityBlur}
          />

          <button
            type="button"
            onClick={increaseQuantity}
            disabled={
              quantity !== '' &&
              Number(quantity) >= product.stock
            }
          >
            +
          </button>

        </div>

        {/* Add To Cart */}
        <button
          type="button"
          className="add-to-cart-button"
          onClick={handleAddToCart}
          disabled={product.stock <= 0}
        >
          {product.stock > 0
            ? 'Add to Cart'
            : 'Out of Stock'}
        </button>

      </div>

    </main>
  )
}

export default ProductDetails