import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard'

const PRODUCTS_URL = 'http://127.0.0.1:8000/api/products/'
const CATEGORIES_URL = 'http://127.0.0.1:8000/api/products/categories/'

function CategoryProducts() {
  const { slug } = useParams()
  const [category, setCategory] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const loadCategoryProducts = async () => {
      setLoading(true)
      setError(false)

      try {
        const [productsResponse, categoriesResponse] = await Promise.all([
          fetch(PRODUCTS_URL),
          fetch(CATEGORIES_URL),
        ])

        if (!productsResponse.ok || !categoriesResponse.ok) {
          throw new Error('Failed to load category products')
        }

        const productsData = await productsResponse.json()
        const categoriesData = await categoriesResponse.json()
        const selectedCategory = categoriesData.find(
          (item) => item.slug === slug
        )

        if (!selectedCategory) {
          setError(true)
          return
        }

        setCategory(selectedCategory)
        setProducts(
          productsData.filter(
            (product) =>
              product.is_active !== false &&
              product.category === selectedCategory.id
          )
        )
      } catch (requestError) {
        console.error('CATEGORY PRODUCTS ERROR:', requestError)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    loadCategoryProducts()
  }, [slug])

  if (loading) {
    return (
      <main className="category-products-page">
        <p className="category-products-status">Loading products...</p>
      </main>
    )
  }

  if (error || !category) {
    return (
      <main className="category-products-page">
        <section className="categories-page-empty">
          <h2>Category not found.</h2>
          <Link to="/categories" className="categories-continue-button">
            Browse Categories
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="category-products-page">
      <header className="category-products-header">
        <p className="categories-page-eyebrow">Shop by category</p>
        <h1>{category.name}</h1>
        <p>{category.description || 'Explore products in this category.'}</p>
        <span>
          {products.length} {products.length === 1 ? 'Product' : 'Products'}
        </span>
      </header>

      {products.length === 0 ? (
        <section className="categories-page-empty">
          <h2>No products available in this category.</h2>
          <Link to="/" className="categories-continue-button">
            Continue Shopping
          </Link>
        </section>
      ) : (
        <div className="product-grid category-products-grid">
          {products.map((product) => (
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

export default CategoryProducts
