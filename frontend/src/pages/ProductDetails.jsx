import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'
import { formatPrice } from '../utils/formatPrice'

const emptyRatings = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }

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
  const [reviews, setReviews] = useState([])
  const [reviewLoading, setReviewLoading] = useState(true)
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState('')
  const [reviewEligibility, setReviewEligibility] = useState({
    can_review: false,
    reason: 'not_authenticated',
  })
  const [reviewEligibilityLoading, setReviewEligibilityLoading] = useState(false)
  const [reviewSummary, setReviewSummary] = useState({
    average_rating: null,
    review_count: 0,
    rating_counts: emptyRatings,
  })
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    review: '',
  })
  const [editingReviewId, setEditingReviewId] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isLoggedIn = Boolean(localStorage.getItem('access_token'))
  const currentUsername = localStorage.getItem('username')
  const currentUserReview = reviews.find((review) => review.username === currentUsername)

  const fetchReviews = async (productId) => {
    setReviewLoading(true)

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/products/${productId}/reviews/`)

      if (!response.ok) {
        throw new Error('Unable to load reviews.')
      }

      const data = await response.json()
      setReviews(data.results || [])
      setReviewSummary({
        average_rating: data.average_rating ?? null,
        review_count: data.review_count ?? 0,
        rating_counts: data.rating_counts || emptyRatings,
      })
    } catch (fetchError) {
      console.error('REVIEW FETCH ERROR:', fetchError)
      setReviewError('Unable to load reviews right now.')
    } finally {
      setReviewLoading(false)
    }
  }

  const fetchReviewEligibility = async (productId) => {
    if (!localStorage.getItem('access_token')) {
      setReviewEligibility({ can_review: false, reason: 'not_authenticated' })
      return
    }

    setReviewEligibilityLoading(true)

    try {
      const accessToken = localStorage.getItem('access_token')
      const response = await fetch(
        `http://127.0.0.1:8000/api/products/${productId}/reviews/eligibility/`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setReviewEligibility({
          can_review: false,
          reason: data.reason || 'not_purchased',
        })
        return
      }

      setReviewEligibility({
        can_review: Boolean(data.can_review),
        reason: data.reason || 'not_purchased',
      })
    } catch (eligibilityError) {
      console.error('REVIEW ELIGIBILITY ERROR:', eligibilityError)
      setReviewEligibility({ can_review: false, reason: 'not_purchased' })
    } finally {
      setReviewEligibilityLoading(false)
    }
  }

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

        if (data.id) {
          fetchReviews(data.id)
          fetchReviewEligibility(data.id)
        }
      })
      .catch((fetchError) => {
        console.error(fetchError)
        setError(fetchError.message)
        setLoading(false)
      })
  }, [slug])

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

    if (value === '') {
      setQuantity('')
      return
    }

    const number = Number(value)

    if (number >= 1 && number <= product.stock) {
      setQuantity(number)
    }
  }

  const handleQuantityBlur = () => {
    if (quantity === '' || Number(quantity) < 1) {
      setQuantity(1)
    }
  }

  const handleAddToCart = () => {
    const finalQuantity = Number(quantity) || 1

    addToCart({
      ...product,
      quantity: finalQuantity,
    })

    window.alert(`${product.name} added to cart!`)
  }

  const handleBuyNow = () => {
    const finalQuantity = Number(quantity) || 1

    navigate('/checkout', {
      state: {
        buyNowItems: [
          {
            ...product,
            quantity: finalQuantity,
          },
        ],
      },
    })
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

  const handleReviewSubmit = async (event) => {
    event.preventDefault()

    if (!isLoggedIn) {
      setReviewError('Please login to write a review.')
      return
    }

    if (!reviewForm.rating || reviewForm.rating < 1 || reviewForm.rating > 5) {
      setReviewError('Please select a valid rating.')
      return
    }

    if (!reviewForm.review.trim()) {
      setReviewError('Review cannot be empty.')
      return
    }

    setReviewError('')
    setIsSubmitting(true)

    try {
      const accessToken = localStorage.getItem('access_token')
      const method = editingReviewId ? 'PATCH' : 'POST'
      const url = editingReviewId
        ? `http://127.0.0.1:8000/api/products/reviews/${editingReviewId}/`
        : `http://127.0.0.1:8000/api/products/${product.id}/reviews/`

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          rating: Number(reviewForm.rating),
          review: reviewForm.review.trim(),
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.detail ||
          data.non_field_errors?.[0] ||
          'Unable to submit review.'
        )
      }

      setReviewSuccess(
        editingReviewId
          ? '✓ Review updated successfully!'
          : '✓ Review submitted successfully!'
      )
      setReviewForm({ rating: 5, review: '' })
      setEditingReviewId(null)
      await fetchReviews(product.id)
    } catch (submitError) {
      setReviewError(submitError.message || 'Unable to submit review.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteReview = async (reviewId) => {
    const confirmed = window.confirm('Are you sure you want to delete your review?')
    if (!confirmed) {
      return
    }

    try {
      const accessToken = localStorage.getItem('access_token')
      const response = await fetch(
        `http://127.0.0.1:8000/api/products/reviews/${reviewId}/`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Unable to delete review.')
      }

      setReviewSuccess('✓ Review deleted successfully!')
      setReviewForm({ rating: 5, review: '' })
      setEditingReviewId(null)
      await fetchReviews(product.id)
    } catch (deleteError) {
      setReviewError(deleteError.message || 'Unable to delete review.')
    }
  }

  const renderStars = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return '☆☆☆☆☆'
    }

    const safeValue = Math.max(0, Math.min(5, Number(value)))
    const filledStars = Math.round(safeValue)
    return `${'★'.repeat(filledStars)}${'☆'.repeat(5 - filledStars)}`
  }

  if (loading) {
    return <p>Loading product...</p>
  }

  if (error) {
    return <p>{error}</p>
  }

  const hasDiscount =
    Number(product.discount_percentage) > 0 &&
    product.discount_price !== null &&
    product.discount_price !== undefined

  return (
    <main className="product-details">
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
            {formatPrice(hasDiscount ? product.discount_price : product.price)}
          </strong>

          {hasDiscount && (
            <>
              <del>{formatPrice(product.price)}</del>
              <span className="details-discount-badge">
                {product.discount_percentage}% OFF
              </span>
            </>
          )}
        </div>

        <div className="product-stock-status">
          <p className="stock">Stock: {product.stock} units</p>
          <span className={product.stock > 0 ? 'in-stock' : 'out-of-stock'}>
            {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
          </span>
        </div>

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
            disabled={quantity !== '' && Number(quantity) >= product.stock}
          >
            +
          </button>
        </div>

        <button
          type="button"
          className="add-to-cart-button"
          onClick={handleAddToCart}
          disabled={product.stock <= 0}
        >
          {product.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
        </button>

        <button
          type="button"
          className="buy-now-details-button"
          onClick={handleBuyNow}
          disabled={product.stock <= 0}
        >
          Buy Now
        </button>
      </div>

      <section className="product-description">
        <h2>Product Description</h2>
        <p>{product.description}</p>
      </section>

      <section className="product-reviews-section">
        <div className="product-review-summary">
          <h2>Customer Reviews</h2>

          {reviewSummary.review_count > 0 ? (
            <>
              <div className="review-main-score">
                <span className="review-stars-large">
                  {renderStars(reviewSummary.average_rating)}
                </span>
                <strong>{Number(reviewSummary.average_rating).toFixed(1)} / 5</strong>
              </div>
              <p>Based on {reviewSummary.review_count} reviews</p>

              {[5, 4, 3, 2, 1].map((star) => {
                const count = reviewSummary.rating_counts?.[star] || 0
                const percentage =
                  reviewSummary.review_count > 0
                    ? (count / reviewSummary.review_count) * 100
                    : 0

                return (
                  <div className="review-bar-row" key={star}>
                    <span>{star} ★</span>
                    <div className="review-bar-track">
                      <div
                        className="review-bar-fill"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span>{count}</span>
                  </div>
                )
              })}
            </>
          ) : (
            <p>No reviews yet.</p>
          )}
        </div>

        <div className="product-review-list">
          {reviewSuccess && (
            <div className="review-success-message" role="status">
              <span aria-hidden="true">✓</span>
              <span>{reviewSuccess}</span>
            </div>
          )}

          {reviewError && (
            <p className="review-error-message">{reviewError}</p>
          )}

          {!isLoggedIn ? (
            <div className="login-to-review">
              <p>Please login to write a review.</p>
              <button type="button" onClick={() => navigate('/login')}>
                Login
              </button>
            </div>
          ) : reviewEligibilityLoading ? (
            <p>Checking review eligibility...</p>
          ) : currentUserReview && !editingReviewId ? (
            <div className="user-review-box">
              <h3>Your Review</h3>
              <div className="review-stars-large">
                {renderStars(currentUserReview.rating)}
              </div>
              <p className="user-review-text">"{currentUserReview.review}"</p>
              <div className="review-action-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setEditingReviewId(currentUserReview.id)
                    setReviewForm({
                      rating: currentUserReview.rating,
                      review: currentUserReview.review,
                    })
                    setReviewError('')
                    setReviewSuccess('')
                  }}
                >
                  Edit Review
                </button>

                <button
                  type="button"
                  className="danger-button"
                  onClick={() => handleDeleteReview(currentUserReview.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ) : reviewEligibility.reason === 'not_purchased' ? (
            <div className="login-to-review">
              <p>Only customers who purchased this product can leave a review.</p>
            </div>
          ) : reviewEligibility.reason === 'not_delivered' ? (
            <div className="login-to-review">
              <p>Your review option will be available after your order is delivered.</p>
            </div>
          ) : reviewEligibility.reason === 'already_reviewed' ? (
            <div className="user-review-box">
              <h3>Your Review</h3>
              <div className="review-stars-large">
                {renderStars(currentUserReview?.rating || 0)}
              </div>
              <p className="user-review-text">"{currentUserReview?.review || ''}"</p>
            </div>
          ) : (
            <form onSubmit={handleReviewSubmit} className="review-form">
              <h3>{editingReviewId ? 'Edit Review' : 'Write a Review'}</h3>

              <label>
                Rating:
                <div className="star-picker">
                  {[5, 4, 3, 2, 1].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={reviewForm.rating >= value ? 'star active' : 'star'}
                      onClick={() => setReviewForm({ ...reviewForm, rating: value })}
                      aria-label={`Rate ${value} star${value > 1 ? 's' : ''}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </label>

              <label htmlFor="review-text">Review:</label>
              <textarea
                id="review-text"
                rows="5"
                value={reviewForm.review}
                onChange={(event) =>
                  setReviewForm({ ...reviewForm, review: event.target.value })
                }
                placeholder="Write your review here..."
                required
              />

              <button type="submit" className="submit-review-button" disabled={isSubmitting}>
                {isSubmitting
                  ? editingReviewId
                    ? 'Saving Changes...'
                    : 'Submitting...'
                  : editingReviewId
                    ? 'Save Changes'
                    : 'Submit Review'}
              </button>
            </form>
          )}

          {reviewLoading ? (
            <p>Loading reviews...</p>
          ) : (
            reviews.map((review) => (
              <article className="single-review" key={review.id}>
                <div className="single-review-header">
                  <span className="review-stars-small">
                    {renderStars(review.rating)}
                  </span>
                  <div>
                    <strong>{review.username}</strong>
                    <p>
                      {new Date(review.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                <p className="single-review-text">{review.review}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  )
}

export default ProductDetails