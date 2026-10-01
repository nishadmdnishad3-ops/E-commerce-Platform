import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'
import { formatPrice } from '../utils/formatPrice'
import { clearAuthData, getCurrentRole, getRoleHome } from '../utils/auth'


function Navbar() {
  const { cartCount } = useCart()
  const { clearWishlist } = useWishlist()

  const location = useLocation()
  const navigate = useNavigate()

  const [showSearch, setShowSearch] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [products, setProducts] = useState([])

  // Login user
  const [username, setUsername] = useState(
    localStorage.getItem('username')
  )
  const [role, setRole] = useState(getCurrentRole() || 'customer')

  const searchRef = useRef(null)

  // =========================
  // CLOSE SEARCH ON OUTSIDE CLICK
  // =========================
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target)
      ) {
        setShowSearch(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)

    return () => {
      document.removeEventListener(
        'mousedown',
        handleOutsideClick
      )
    }
  }, [])

  // =========================
  // LOAD PRODUCTS
  // =========================
  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/products/')
      .then((response) => response.json())
      .then((data) => setProducts(data))
      .catch((error) => console.error(error))
  }, [])

  // =========================
  // HIDE SEARCH WHEN ROUTE CHANGES
  // =========================
  useEffect(() => {
    setShowSearch(false)
    setSearchTerm('')
  }, [location.pathname])

  // =========================
  // AUTH STATE
  // =========================
  useEffect(() => {
    const updateAuth = () => {
      setUsername(localStorage.getItem('username'))
      setRole(getCurrentRole() || 'customer')
    }

    window.addEventListener('auth-change', updateAuth)

    return () => {
      window.removeEventListener('auth-change', updateAuth)
    }
  }, [])

  // =========================
  // SEARCH SUGGESTIONS
  // =========================
  const suggestions =
    searchTerm.trim() === ''
      ? []
      : products.filter((product) => {
          const search = searchTerm.toLowerCase()

          return (
            product.name?.toLowerCase().includes(search) ||
            product.description?.toLowerCase().includes(search) ||
            product.sku?.toLowerCase().includes(search)
          )
        })

  // =========================
  // SEARCH
  // =========================
  const handleSearch = () => {
    if (!searchTerm.trim()) return

    navigate(`/search?q=${encodeURIComponent(searchTerm)}`)

    setShowSearch(false)
  }

  // =========================
  // LOGOUT
  // =========================
  const handleLogout = () => {
    clearAuthData()
    setUsername(null)
    setRole('customer')
    clearWishlist()
    navigate('/')
  }

  return (
    <nav className="navbar">
      <div className="navbar-container">

        {/* Logo */}
        <Link to="/" className="logo">
          <img
            src="/tech-mart-logo.png"
            alt="Tech Mart"
          />
        </Link>

        {/* Navigation */}
        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/">TechMart</Link>
          <Link to="/categories">Categories</Link>
          <Link to="/offers">Offers</Link>
          <Link to="/contact">Contact</Link>
        </div>

        {/* =========================
            SEARCH BOX
        ========================= */}
        {showSearch && (
          <div
            className="search-wrapper"
            ref={searchRef}
          >

            <div className="search-container">

              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) =>
                  setSearchTerm(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch()
                  }
                }}
                autoFocus
              />

              <button
                type="button"
                onClick={handleSearch}
              >
                🔍
              </button>

            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="search-suggestions">

                {suggestions
                  .slice(0, 5)
                  .map((product) => {

                    const image =
                      product.images?.find(
                        (img) => img.is_primary
                      )?.image ||
                      product.images?.[0]?.image

                    return (
                      <Link
                        key={product.id}
                        to={`/product/${product.slug}`}
                        className="search-suggestion-item"
                      >

                        {image && (
                          <img
                            src={image}
                            alt={product.name}
                          />
                        )}

                        <div>
                          <strong>
                            {product.name}
                          </strong>

                          <span>
                            {formatPrice(
                              product.discount_price || product.price
                            )}
                          </span>
                        </div>

                      </Link>
                    )
                  })}

              </div>
            )}

          </div>
        )}

        {/* =========================
            ACTIONS
        ========================= */}
        <div className="nav-actions">

          {/* Search */}
          <button
            type="button"
            onClick={() =>
              setShowSearch((current) => !current)
            }
          >
            🔍
          </button>

          {/* Cart */}
          <Link
            to="/cart"
            className="cart-link"
          >
            🛒

            {cartCount > 0 && (
              <span className="cart-count">
                {cartCount}
              </span>
            )}
          </Link>

          {/* User */}
          {username ? (
            <div className="user-menu">
              <button
                type="button"
                className="username-trigger"
                aria-label={`Open account menu for ${username}`}
              >
                <span className="username-avatar" aria-hidden="true">👤</span>
                <span className="username-label">{username}</span>
                <span className="username-chevron" aria-hidden="true">⌄</span>
              </button>

              <div className="user-dropdown">
                <div className="user-profile-summary">
                  <span className="user-avatar">👤</span>
                  <div>
                    <strong>{username}</strong>
                    <small>{role.charAt(0).toUpperCase() + role.slice(1)}</small>
                  </div>
                </div>

                {role === 'admin' || role === 'employee' ? (
                  <Link to={getRoleHome(role)} className="dropdown-link">
                    <span className="dropdown-action-icon" aria-hidden="true">▣</span>
                    <span>{role === 'admin' ? 'Admin Dashboard' : 'Employee Dashboard'}</span>
                  </Link>
                ) : (
                  <>
                    <Link to="/my-orders" className="dropdown-link">
                      <span className="dropdown-action-icon" aria-hidden="true">▣</span>
                      <span>My Orders</span>
                    </Link>
                    <Link to="/profile" className="dropdown-link">
                      <span className="dropdown-action-icon" aria-hidden="true">◉</span>
                      <span>Profile</span>
                    </Link>
                    <Link to="/wishlist" className="dropdown-link">
                      <span>Wishlist</span>
                      <span className="dropdown-wishlist-icon" aria-hidden="true">❤️</span>
                    </Link>
                  </>
                )}

                <button
                  type="button"
                  className="logout-button"
                  onClick={handleLogout}
                >
                  <span className="dropdown-action-icon" aria-hidden="true">↪</span>
                  <span>Logout</span>
                </button>
              </div>
            </div>
          ) : (
            <Link
              to="/login"
              className="user-link"
            >
              👤
            </Link>
          )}

        </div>

      </div>
    </nav>
  )
}

export default Navbar