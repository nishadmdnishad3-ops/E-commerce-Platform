import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard'

const API_URL = 'http://127.0.0.1:8000/api/products/'

function Offers() {
  const [products, setProducts] = useState([])
  const [sortBy, setSortBy] = useState('highest-discount')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true)
      setError(false)

      try {
        const response = await fetch(API_URL)

        if (!response.ok) {
          throw new Error('Failed to load offers')
        }

        const data = await response.json()
        setProducts(
          data.filter(
            (product) => Number(product.discount_percentage) > 0
          )
        )
      } catch (requestError) {
        console.error('OFFERS ERROR:', requestError)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    loadProducts()
  }, [])

  const sortedProducts = useMemo(() => {
    const sorted = [...products]

    sorted.sort((firstProduct, secondProduct) => {
      const firstDiscount = Number(firstProduct.discount_percentage) || 0
      const secondDiscount = Number(secondProduct.discount_percentage) || 0
      const firstPrice = Number(
        firstProduct.discount_price || firstProduct.price
      )
      const secondPrice = Number(
        secondProduct.discount_price || secondProduct.price
      )

      if (sortBy === 'lowest-discount') {
        return firstDiscount - secondDiscount
      }

      if (sortBy === 'price-low-high') {
        return firstPrice - secondPrice
      }

      if (sortBy === 'price-high-low') {
        return secondPrice - firstPrice
      }

      if (sortBy === 'newest') {
        return new Date(secondProduct.created_at) - new Date(firstProduct.created_at)
      }

      return secondDiscount - firstDiscount
    })

    return sorted
  }, [products, sortBy])

  return (
    <main className="offers-page">
      <header className="offers-header">
        <div>
          <p className="offers-eyebrow">Save on selected products</p>
          <h1>🔥 Special Offers</h1>
          <p>Explore our latest deals and save more on selected products.</p>
        </div>

        {!loading && !error && products.length > 0 && (
          <label className="offers-sort-control">
            <span>Sort By</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="highest-discount">Highest Discount</option>
              <option value="lowest-discount">Lowest Discount</option>
              <option value="price-low-high">Price: Low to High</option>
              <option value="price-high-low">Price: High to Low</option>
              <option value="newest">Newest</option>
            </select>
          </label>
        )}
      </header>

      {loading && (
        <p className="offers-status">Loading offers...</p>
      )}

      {!loading && error && (
        <section className="offers-empty-state">
          <h2>Something went wrong while loading offers.</h2>
          <Link to="/" className="offers-continue-button">
            Continue Shopping
          </Link>
        </section>
      )}

      {!loading && !error && sortedProducts.length === 0 && (
        <section className="offers-empty-state">
          <h2>No Offers Available</h2>
          <p>Check back later for new deals.</p>
          <Link to="/" className="offers-continue-button">
            Continue Shopping
          </Link>
        </section>
      )}

      {!loading && !error && sortedProducts.length > 0 && (
        <div className="product-grid offers-product-grid">
          {sortedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
            />
          ))}
        </div>
      )}
    </main>
  )
}

export default Offers
