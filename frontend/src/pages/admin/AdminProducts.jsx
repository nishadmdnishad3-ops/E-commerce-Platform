import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatPrice } from '../../utils/formatPrice'

export default function AdminProducts({ apiPrefix = '/api/admin', routeBase = '/admin' }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const loadProducts = () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      navigate('/login')
      return
    }

    fetch(`http://127.0.0.1:8000${apiPrefix}/products/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        if (response.status === 403) {
          throw new Error('Access denied. Admin privileges required.')
        }
        if (!response.ok) {
          throw new Error('Failed to load products.')
        }
        return response.json()
      })
      .then((data) => {
        setProducts(data.results || data)
        setError('')
      })
      .catch((fetchError) => {
        setError(fetchError.message)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadProducts()
  }, [apiPrefix, navigate])

  return (
    <div className="admin-page">
      <div className="admin-toolbar admin-toolbar-right">
        <Link to={`${routeBase}/products/add`} className="primary-button">Add Product</Link>
      </div>

      {loading ? (
        <div className="admin-panel-state">Loading products...</div>
      ) : error ? (
        <div className="admin-panel-state error">{error}</div>
      ) : (
        <div className="admin-card table-card">
          <div className="table-wrap">
            <table className="admin-products-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan="7">No products found.</td></tr>
                ) : (
                  products.map((product) => (
                    <tr key={product.id}>
                      <td>
                        {product.images?.length ? (
                          <div className="admin-product-image-wrap">
                            <img
                              src={`http://127.0.0.1:8000${product.images.find((image) => image.is_primary)?.image || product.images[0].image}`}
                              alt={product.name}
                              className="admin-product-thumb"
                            />
                          </div>
                        ) : (
                          <div className="admin-product-image-wrap">
                            <span className="admin-thumb-placeholder">No image</span>
                          </div>
                        )}
                      </td>
                      <td data-label="Name">{product.name}</td>
                      <td data-label="Category">{product.category_name || product.category}</td>
                      <td data-label="Price">{formatPrice(Number(product.price))}</td>
                      <td data-label="Stock">{product.stock}</td>
                      <td data-label="Status">{product.is_active ? 'Active' : 'Inactive'}</td>
                      <td data-label="Action">
                        <Link to={`${routeBase}/products/edit/${product.id}`} className="mini-link">Edit</Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
