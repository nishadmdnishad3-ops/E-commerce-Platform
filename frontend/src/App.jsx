import MyOrders from './pages/MyOrders'
import OrderSuccess from './pages/OrderSuccess'
import Search from './pages/Search'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
} from 'react-router-dom'

import './App.css'
import Navbar from './components/Navbar'
import Footer from './components/Footer' 
import ProductCard from './components/ProductCard'
import ProductDetails from './pages/ProductDetails'
import Login from './pages/Login'
import Register from './pages/Register'
import Wishlist from './pages/Wishlist'
import Offers from './pages/Offers'
import Categories from './pages/Categories'
import CategoryProducts from './pages/CategoryProducts'
import Contact from './pages/Contact'

function getCategoryIcon(categoryName) {
  const name = categoryName.toLowerCase()

  if (name.includes('electronic')) return '⚡'
  if (name.includes('laptop')) return '💻'
  if (name.includes('security')) return '📹'
  if (name.includes('printer')) return '🖨️'
  if (name.includes('accessor')) return '🔌'
  if (name.includes('neckband')) return '🎧'
  if (name.includes('airbud')) return '🎵'
  if (name.includes('watch')) return '⌚'
  if (name.includes('camera')) return '📷'
  if (name.includes('phone')) return '📱'

  return '🛍️'
}

const featuredCategorySeed = [
  { id: 'electronics', slug: 'electronics', name: 'Electronics' },
  { id: 'laptops', slug: 'laptops', name: 'Laptops' },
  { id: 'audio', slug: 'audio', name: 'Audio' },
  { id: 'smartphones', slug: 'smartphones', name: 'Smartphones' },
  { id: 'cameras', slug: 'cameras', name: 'Cameras' },
  { id: 'security', slug: 'security', name: 'Security' },
  { id: 'wearables', slug: 'wearables', name: 'Wearables' },
  { id: 'printers', slug: 'printers', name: 'Printers' },
  { id: 'accessories', slug: 'accessories', name: 'Accessories' },
  { id: 'gaming', slug: 'gaming', name: 'Gaming' },
  { id: 'home-office', slug: 'home-office', name: 'Home Office' },
  { id: 'networking', slug: 'networking', name: 'Networking' },
]

function Home() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [latestProducts, setLatestProducts] = useState([])
  const [latestLoading, setLatestLoading] = useState(true)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/products/')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch products')
        }

        return response.json()
      })
      .then((data) => {
        setProducts(data)
        setLoading(false)
      })
      .catch((error) => {
        console.error(error)
        setError(error.message)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
  fetch(
    'http://127.0.0.1:8000/api/products/latest/'
  )
    .then((response) => {
      if (!response.ok) {
        throw new Error(
          'Failed to fetch latest products'
        )
      }

      return response.json()
    })
    .then((data) => {
      setLatestProducts(data)
      setLatestLoading(false)
    })
    .catch((error) => {
      console.error(
        'LATEST PRODUCTS ERROR:',
        error
      )

      setLatestLoading(false)
    })
}, [])

    useEffect(() => {
    fetch('http://127.0.0.1:8000/api/products/categories/')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch categories')
        }

        return response.json()
      })
      .then((data) => {
        const mergedCategories = [
          ...data,
          ...featuredCategorySeed,
        ].filter(
          (category, index, array) =>
            array.findIndex(
              (item) =>
                item.slug === category.slug ||
                item.name.toLowerCase() === category.name.toLowerCase()
            ) === index
        )

        setCategories(mergedCategories.slice(0, 12))
        setCategoriesLoading(false)
      })
      .catch((error) => {
        console.error(error)
        setCategoriesLoading(false)
      })
  }, [])

  const activeProductCounts = products.reduce(
    (counts, product) => {
      if (product.is_active === false) {
        return counts
      }

      const categoryId =
        typeof product.category === 'object'
          ? product.category?.id
          : product.category

      if (categoryId !== undefined && categoryId !== null) {
        counts[categoryId] = (counts[categoryId] || 0) + 1
      }

      return counts
    },
    {}
  )

  
  /*
    Products for Hero Slider
    Featured products are preferred.
    If there are no featured products,
    all products with images are used.
  */
  const featuredProducts = products.filter(
    (product) =>
      product.is_featured &&
      product.images?.length > 0
  )

  const sliderProducts =
    featuredProducts.length > 0
      ? featuredProducts
      : products.filter(
          (product) => product.images?.length > 0
        )

  /*
    Automatically change slide every 4 seconds
  */
  useEffect(() => {
    if (sliderProducts.length <= 1) {
      return
    }

    const interval = setInterval(() => {
      setCurrentSlide(
        (current) =>
          (current + 1) % sliderProducts.length
      )
    }, 4000)

    return () => clearInterval(interval)
  }, [sliderProducts.length])

  /*
    Make sure current slide is valid
  */
  useEffect(() => {
    if (
      currentSlide >= sliderProducts.length &&
      sliderProducts.length > 0
    ) {
      setCurrentSlide(0)
    }
  }, [currentSlide, sliderProducts.length])

  const nextSlide = () => {
    if (sliderProducts.length === 0) {
      return
    }

    setCurrentSlide(
      (current) =>
        (current + 1) % sliderProducts.length
    )
  }

  const previousSlide = () => {
    if (sliderProducts.length === 0) {
      return
    }

    setCurrentSlide(
      (current) =>
        (current - 1 + sliderProducts.length) %
        sliderProducts.length
    )
  }

  const goToSlide = (index) => {
    setCurrentSlide(index)
  }

  const currentProduct =
    sliderProducts[currentSlide]


  return (
    <main>

      {/* =========================
          DYNAMIC HERO SLIDER
      ========================== */}

      {!loading && !error && currentProduct && (
        <section className="hero-slider">

          <div className="hero-slider-content">

            {/* LEFT SIDE */}
            <div className="hero-slider-text">

              {/* Discount Badge */}
              <span className="hero-badge">
                {currentProduct.discount_percentage > 0
                  ? `🔥 ${currentProduct.discount_percentage}% OFF`
                  : '⭐ Featured Product'}
              </span>

              {/* Product Name */}
              <h1>
                {currentProduct.name}
              </h1>

              {/* Price */}
              <div className="hero-price">

                {currentProduct.discount_price ? (
                  <>
                    <strong>
                      ৳{currentProduct.discount_price}
                    </strong>

                    <del>
                      ৳{currentProduct.price}
                    </del>
                  </>
                ) : (
                  <strong>
                    ৳{currentProduct.price}
                  </strong>
                )}

              </div>

              {/* Shop Now */}
              <Link
                to={`/product/${currentProduct.slug}`}
                className="hero-shop-button"
              >
                Shop Now
              </Link>

            </div>


            {/* RIGHT SIDE */}
            <div className="hero-slider-image">

              {(() => {
                const image =
                  currentProduct.images?.find(
                    (img) => img.is_primary
                  )?.image ||
                  currentProduct.images?.[0]?.image

                return image ? (
                  <img
                    src={image}
                    alt={currentProduct.name}
                  />
                ) : null
              })()}

            </div>

          </div>


          {/* Previous Button */}
          {sliderProducts.length > 1 && (
            <button
              type="button"
              className="hero-arrow hero-arrow-left"
              onClick={previousSlide}
            >
              ‹
            </button>
          )}


          {/* Next Button */}
          {sliderProducts.length > 1 && (
            <button
              type="button"
              className="hero-arrow hero-arrow-right"
              onClick={nextSlide}
            >
              ›
            </button>
          )}


          {/* Slider Dots */}
          {sliderProducts.length > 1 && (
            <div className="hero-dots">

              {sliderProducts.map(
                (product, index) => (
                  <button
                    key={product.id}
                    type="button"
                    className={
                      index === currentSlide
                        ? 'hero-dot active'
                        : 'hero-dot'
                    }
                    onClick={() =>
                      goToSlide(index)
                    }
                    aria-label={`Go to slide ${
                      index + 1
                    }`}
                  />
                )
              )}

            </div>
          )}

        </section>
      )}


      {/* Loading */}
      {loading && (
        <section className="hero-loading">
          <p>Loading...</p>
        </section>
      )}


      {/* Error */}
      {error && (
        <section className="hero-loading">
          <p>
            Something went wrong: {error}
          </p>
        </section>
      )}

<section className="categories-section">
  <div className="section-heading">
    <h2>Featured Categories</h2>
  </div>

  {categoriesLoading ? (
    <p className="categories-loading">
      Loading categories...
    </p>
  ) : (
    <div className="categories-grid">
      {categories.map((category) => (
        <Link
          key={category.id}
          to={`/search?category=${category.slug}`}
          className="category-card"
        >
          <span className="category-icon">
            {getCategoryIcon(category.name)}
          </span>

          <h3>{category.name}</h3>

          <p>
            {activeProductCounts[category.id] || 0}{' '}
            {(activeProductCounts[category.id] || 0) === 1
              ? 'Product'
              : 'Products'}
          </p>
        </Link>
      ))}
    </div>
  )}
</section>

<section className="latest-products-section">

  <div className="latest-products-header">

    <h2>Latest Products</h2>

    <Link
      to="/search"
      className="view-all-products"
    >
      View All →
    </Link>

  </div>

  {latestLoading ? (
    <p className="latest-loading">
      Loading latest products...
    </p>
  ) : (
    <div className="latest-products-grid">

      {latestProducts.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
        />
      ))}

    </div>
  )}

</section>

      {/* =========================
          FEATURED PRODUCTS
      ========================== */}

      <section className="products-section">

        <h2>Featured Products</h2>

        {!loading && !error && (
          <div className="product-grid">

            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
              />
            ))}

          </div>
        )}

      </section>

    </main>
  )
}


/* =========================
   MAIN APP
========================= */

function App() {
  return (
    <BrowserRouter>

      <Navbar />

      <Routes>

        {/* Home */}
        <Route
          path="/"
          element={<Home />}
        />

        {/* Product Details */}
        <Route
          path="/product/:slug"
          element={<ProductDetails />}
        />

        {/* Cart */}
        <Route
          path="/cart"
          element={<Cart />}
        />

        {/* Checkout */}
        <Route
          path="/checkout"
          element={<Checkout />}
        />

        {/* Search */}
        <Route
          path="/search"
          element={<Search />}
        />

        {/* Offers */}
        <Route
          path="/offers"
          element={<Offers />}
        />

        {/* Categories */}
        <Route
          path="/categories"
          element={<Categories />}
        />
        <Route
          path="/category/:slug"
          element={<CategoryProducts />}
        />

        {/* Contact */}
        <Route
          path="/contact"
          element={<Contact />}
        />

        {/* Login */}
        <Route
          path="/login"
          element={<Login />}
        />

        {/* Register */}
        <Route
          path="/register"
          element={<Register />}
        />
        <Route
          path="/order-success"
          element={<OrderSuccess />}
        />
        <Route
          path="/my-orders"
          element={<MyOrders />}
        />
        <Route
          path="/wishlist"
          element={<Wishlist />}
        />

      </Routes>
     <Footer />
    </BrowserRouter>
  )
}

export default App