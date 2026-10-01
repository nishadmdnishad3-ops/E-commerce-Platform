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
  useLocation,
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
import AdminLayout from './components/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminOrders from './pages/admin/AdminOrders'
import AdminOrderDetail from './pages/admin/AdminOrderDetail'
import AdminProducts from './pages/admin/AdminProducts'
import AddProduct from './pages/admin/AddProduct'
import EditProduct from './pages/admin/EditProduct'
import AdminCategories from './pages/admin/AdminCategories'
import AddCategory from './pages/admin/AddCategory'
import EditCategory from './pages/admin/EditCategory'
import AdminCustomers from './pages/admin/AdminCustomers'
import AdminCustomerDetail from './pages/admin/AdminCustomerDetail'
import AdminEmployees from './pages/admin/AdminEmployees'
import EmployeeLayout from './components/employee/EmployeeLayout'
import EmployeeDashboard from './pages/employee/EmployeeDashboard'
import EmployeeCategories from './pages/employee/EmployeeCategories'
import Profile from './pages/Profile'
import ProtectedRoute from './components/ProtectedRoute'
import { formatPrice } from './utils/formatPrice'

const categoryIcons = {
  electronics: '⚡',
  laptops: '💻',
  cameras: '📷',
  smartphones: '📱',
  printers: '🖨️',
  tv: '📺',
  audio: '🔊',
  security: '📹',
  wearables: '⌚',
  accessories: '🔌',
  gaming: '🎮',
  'home-office': '🖥️',
}

function getCategoryIcon(category) {
  const key = (category.slug || category.name)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')

  return categoryIcons[key] || '📦'
}

function getCategoryImageUrl(imagePath) {
  return new URL(imagePath, 'http://127.0.0.1:8000').toString()
}

function CategoryVisual({ category }) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <span className="category-icon">
      {category.image && !imageFailed ? (
        <img
          className="category-image"
          src={getCategoryImageUrl(category.image)}
          alt=""
          onError={() => setImageFailed(true)}
        />
      ) : (
        getCategoryIcon(category)
      )}
    </span>
  )
}

function Home() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesError, setCategoriesError] = useState(false)
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
        setCategories(data.filter((category) => category.is_active === true))
        setCategoriesLoading(false)
      })
      .catch((error) => {
        console.error('CATEGORIES ERROR:', error)
        setCategoriesError(true)
        setCategoriesLoading(false)
      })
  }, [])

  
  /*
    Products for Hero Slider
    Featured products are preferred.
    If there are no featured products,
    all products with images are used.
  */
  const featuredProducts = products.filter(
    (product) => product.is_featured === true
  )
  const displayedFeaturedProducts = featuredProducts.slice(0, 8)
  const sliderFeaturedProducts = featuredProducts.filter(
    (product) => product.images?.length > 0
  )

  const sliderProducts =
    sliderFeaturedProducts.length > 0
      ? sliderFeaturedProducts
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
                      {formatPrice(currentProduct.discount_price)}
                    </strong>

                    <del>
                      {formatPrice(currentProduct.price)}
                    </del>
                  </>
                ) : (
                  <strong>
                    {formatPrice(currentProduct.price)}
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
  ) : categoriesError ? (
    <p className="categories-loading">
      Unable to load categories.
    </p>
  ) : (
    <div className="categories-grid">
      {categories.map((category) => (
        <Link
          key={category.id}
          to={`/category/${category.slug}`}
          className="category-card"
        >
          <CategoryVisual category={category} />

          <h3>{category.name}</h3>

          <p>
            {category.product_count}{' '}
            {category.product_count === 1
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

        <div className="latest-products-header">
          <h2>Featured Products</h2>
          <Link
            to="/search?featured=true"
            className="view-all-products"
          >
            View All →
          </Link>
        </div>

        {!loading && !error && (
          displayedFeaturedProducts.length > 0 ? (
            <div className="product-grid">
              {displayedFeaturedProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                />
              ))}
            </div>
          ) : (
            <p className="latest-loading">
              No featured products available.
            </p>
          )
        )}

      </section>

    </main>
  )
}


/* =========================
   MAIN APP
========================= */

function AppShell() {
  const location = useLocation()
  const isManagementRoute = location.pathname.startsWith('/admin') || location.pathname.startsWith('/employee')

  return (
    <>
      {!isManagementRoute && <Navbar />}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/product/:slug" element={<ProductDetails />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<ProtectedRoute requiredRole="customer"><Checkout /></ProtectedRoute>} />
        <Route path="/search" element={<Search />} />
        <Route path="/offers" element={<Offers />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/category/:slug" element={<CategoryProducts />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/order-success" element={<OrderSuccess />} />
        <Route path="/my-orders" element={<ProtectedRoute requiredRole="customer"><MyOrders /></ProtectedRoute>} />
        <Route path="/wishlist" element={<ProtectedRoute requiredRole="customer"><Wishlist /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/:id" element={<AdminOrderDetail />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="products/add" element={<AddProduct />} />
          <Route path="products/edit/:id" element={<EditProduct />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="categories/add" element={<AddCategory />} />
          <Route path="categories/edit/:id" element={<EditCategory />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="customers/:id" element={<AdminCustomerDetail />} />
          <Route path="employees" element={<AdminEmployees />} />
        </Route>

        <Route
          path="/employee"
          element={
            <ProtectedRoute requiredRoles={['admin', 'employee']}>
              <EmployeeLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<EmployeeDashboard />} />
          <Route path="orders" element={<AdminOrders apiPrefix="/api/employee" routeBase="/employee" />} />
          <Route path="orders/:id" element={<AdminOrderDetail apiPrefix="/api/employee" routeBase="/employee" employeeMode />} />
          <Route path="products" element={<AdminProducts apiPrefix="/api/employee" routeBase="/employee" />} />
          <Route path="products/add" element={<AddProduct apiPrefix="/api/employee" routeBase="/employee" employeeMode />} />
          <Route path="products/edit/:id" element={<EditProduct apiPrefix="/api/employee" routeBase="/employee" employeeMode />} />
          <Route path="categories" element={<EmployeeCategories />} />
        </Route>
      </Routes>

      {!isManagementRoute && <Footer />}
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}

export default App