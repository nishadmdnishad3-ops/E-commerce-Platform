import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const API_URL = 'http://127.0.0.1:8000/api/products/categories/'

function getCategoryIcon(categoryName) {
  const name = categoryName.toLowerCase()

  if (name.includes('electronic')) return '⚡'
  if (name.includes('laptop')) return '💻'
  if (name.includes('smartphone') || name.includes('phone')) return '📱'
  if (name.includes('camera')) return '📷'
  if (name.includes('printer')) return '🖨️'
  if (name.includes('accessor')) return '🎧'
  if (name.includes('smart watch') || name.includes('watch')) return '⌚'

  return '🛍️'
}

function Categories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch(API_URL)

        if (!response.ok) {
          throw new Error('Failed to load categories')
        }

        setCategories(await response.json())
      } catch (requestError) {
        console.error('CATEGORIES ERROR:', requestError)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    loadCategories()
  }, [])

  return (
    <main className="categories-page">
      <header className="categories-page-header">
        <p className="categories-page-eyebrow">Find your next essential</p>
        <h1>Featured Categories</h1>
        <p>Browse our products by category.</p>
      </header>

      {loading && (
        <p className="categories-page-status">Loading categories...</p>
      )}

      {!loading && error && (
        <section className="categories-page-empty">
          <h2>Something went wrong while loading categories.</h2>
          <Link to="/" className="categories-continue-button">
            Continue Shopping
          </Link>
        </section>
      )}

      {!loading && !error && categories.length === 0 && (
        <section className="categories-page-empty">
          <h2>No categories available.</h2>
          <Link to="/" className="categories-continue-button">
            Continue Shopping
          </Link>
        </section>
      )}

      {!loading && !error && categories.length > 0 && (
        <div className="categories-page-grid">
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/category/${category.slug}`}
              className="category-page-card"
            >
              <span className="category-page-icon" aria-hidden="true">
                {getCategoryIcon(category.name)}
              </span>
              <h2>{category.name}</h2>
              <p>
                {category.product_count}{' '}
                {category.product_count === 1 ? 'Product' : 'Products'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}

export default Categories
