import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard'

function Search() {
  const [searchParams] = useSearchParams()

  const query = searchParams.get('q') || ''
  const categorySlug = searchParams.get('category') || ''

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedCategory, setSelectedCategory] =
    useState(categorySlug)

  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sortBy, setSortBy] = useState('newest')

  useEffect(() => {
    const loadData = async () => {
      try {
        const [productsResponse, categoriesResponse] =
          await Promise.all([
            fetch(
              'http://127.0.0.1:8000/api/products/'
            ),
            fetch(
              'http://127.0.0.1:8000/api/products/categories/'
            ),
          ])

        if (
          !productsResponse.ok ||
          !categoriesResponse.ok
        ) {
          throw new Error(
            'Failed to fetch products or categories'
          )
        }

        const productsData =
          await productsResponse.json()

        const categoriesData =
          await categoriesResponse.json()

        setProducts(productsData)
        setCategories(categoriesData)
        setLoading(false)
      } catch (error) {
        console.error('SEARCH ERROR:', error)
        setError(error.message)
        setLoading(false)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    setSelectedCategory(categorySlug)
  }, [categorySlug])

  const searchText = query.trim().toLowerCase()

  let filteredProducts = products.filter(
    (product) => {
      /* Search */
      const searchableText = `
        ${product.name || ''}
        ${product.description || ''}
        ${product.slug || ''}
        ${product.sku || ''}
        ${product.brand_name || ''}
        ${product.category_name || ''}
      `.toLowerCase()

      const matchesSearch =
        !searchText ||
        searchableText.includes(searchText)

      /* Category */
      let matchesCategory = true

      if (selectedCategory) {
        const category = categories.find(
          (item) =>
            item.slug === selectedCategory
        )

        matchesCategory =
          category &&
          product.category === category.id
      }

      /* Price */
      const productPrice = Number(
        product.discount_price || product.price
      )

      const minimum =
        minPrice === ''
          ? 0
          : Number(minPrice)

      const maximum =
        maxPrice === ''
          ? Infinity
          : Number(maxPrice)

      const matchesPrice =
        productPrice >= minimum &&
        productPrice <= maximum

      return (
        matchesSearch &&
        matchesCategory &&
        matchesPrice
      )
    }
  )

  /* Sorting */

  filteredProducts = [...filteredProducts].sort(
    (a, b) => {
      if (sortBy === 'newest') {
        return (
          new Date(b.created_at) -
          new Date(a.created_at)
        )
      }

      if (sortBy === 'oldest') {
        return (
          new Date(a.created_at) -
          new Date(b.created_at)
        )
      }

      if (sortBy === 'price-low') {
        return (
          Number(
            a.discount_price || a.price
          ) -
          Number(
            b.discount_price || b.price
          )
        )
      }

      if (sortBy === 'price-high') {
        return (
          Number(
            b.discount_price || b.price
          ) -
          Number(
            a.discount_price || a.price
          )
        )
      }

      if (sortBy === 'name') {
        return a.name.localeCompare(b.name)
      }

      return 0
    }
  )

  const clearFilters = () => {
    setSelectedCategory('')
    setMinPrice('')
    setMaxPrice('')
    setSortBy('newest')
  }

  const selectedCategoryObject =
    categories.find(
      (category) =>
        category.slug === selectedCategory
    )

  return (
    <main className="search-page">

      <div className="search-page-header">

        <h1>
          {selectedCategoryObject
            ? selectedCategoryObject.name
            : 'Search Products'}
        </h1>

        {query ? (
          <p>
            Search results for:
            <strong> "{query}"</strong>
          </p>
        ) : selectedCategoryObject ? (
          <p>
            Products in:
            <strong>
              {' '}
              {selectedCategoryObject.name}
            </strong>
          </p>
        ) : (
          <p>
            Browse all products.
          </p>
        )}

      </div>


      {/* FILTERS */}

      <div className="product-filters">

        <div className="filter-group">

          <label htmlFor="category-filter">
            Category
          </label>

          <select
            id="category-filter"
            value={selectedCategory}
            onChange={(e) =>
              setSelectedCategory(
                e.target.value
              )
            }
          >
            <option value="">
              All Categories
            </option>

            {categories.map((category) => (
              <option
                key={category.id}
                value={category.slug}
              >
                {category.name}
              </option>
            ))}
          </select>

        </div>


        <div className="filter-group">

          <label htmlFor="min-price">
            Min Price
          </label>

          <input
            id="min-price"
            type="number"
            min="0"
            placeholder="৳ Min"
            value={minPrice}
            onChange={(e) =>
              setMinPrice(e.target.value)
            }
          />

        </div>


        <div className="filter-group">

          <label htmlFor="max-price">
            Max Price
          </label>

          <input
            id="max-price"
            type="number"
            min="0"
            placeholder="৳ Max"
            value={maxPrice}
            onChange={(e) =>
              setMaxPrice(e.target.value)
            }
          />

        </div>


        <div className="filter-group">

          <label htmlFor="sort-products">
            Sort By
          </label>

          <select
            id="sort-products"
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value)
            }
          >
            <option value="newest">
              Newest
            </option>

            <option value="oldest">
              Oldest
            </option>

            <option value="price-low">
              Price: Low to High
            </option>

            <option value="price-high">
              Price: High to Low
            </option>

            <option value="name">
              Name: A to Z
            </option>

          </select>

        </div>


        <button
          type="button"
          className="clear-filters-button"
          onClick={clearFilters}
        >
          Clear Filters
        </button>

      </div>


      {loading && (
        <p>Loading products...</p>
      )}


      {error && (
        <p>
          Something went wrong: {error}
        </p>
      )}


      {!loading &&
        !error &&
        filteredProducts.length === 0 && (
          <div className="no-results">

            <h2>
              No products found
            </h2>

            <p>
              Try changing your filters.
            </p>

          </div>
        )}


      {!loading &&
        !error &&
        filteredProducts.length > 0 && (
          <>

            <p className="search-result-count">
              {filteredProducts.length}{' '}
              product(s) found
            </p>

            <div className="product-grid">

              {filteredProducts.map(
                (product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                  />
                )
              )}

            </div>

          </>
        )}

    </main>
  )
}

export default Search