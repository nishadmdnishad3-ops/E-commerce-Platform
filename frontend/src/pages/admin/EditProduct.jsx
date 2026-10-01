import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

export default function EditProduct({ apiPrefix = '/api/admin', routeBase = '/admin', employeeMode = false }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [existingImage, setExistingImage] = useState('')
  const [imagePreview, setImagePreview] = useState('')
  const [form, setForm] = useState({
    name: '',
    category: '',
    brand: '',
    sku: '',
    price: '',
    discount_percentage: '0',
    stock: '',
    description: '',
    is_active: true,
    is_featured: false,
    image: null,
  })
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('access_token')

    fetch(`http://127.0.0.1:8000${apiPrefix}/categories/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => response.json())
      .then((data) => setCategories(data.results || data))
      .catch(() => setCategories([]))

    fetch(`http://127.0.0.1:8000${apiPrefix}/brands/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => response.json())
      .then((data) => setBrands(data.results || data))
      .catch(() => setBrands([]))

    fetch(`http://127.0.0.1:8000${apiPrefix}/products/${id}/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load product.')
        return response.json()
      })
      .then((data) => {
        const primaryImage = data.images?.find((image) => image.is_primary) || data.images?.[0]
        setExistingImage(primaryImage?.image || '')
        setForm({
          name: data.name || '',
          category: data.category || data.category_id || '',
          brand: data.brand || data.brand_id || '',
          sku: data.sku || '',
          price: data.price || '',
          discount_percentage: data.discount_percentage ?? 0,
          stock: data.stock || '',
          description: data.description || '',
          is_active: data.is_active ?? true,
          is_featured: data.is_featured ?? false,
          image: null,
        })
      })
      .catch((loadError) => setError(loadError.message))
  }, [id, apiPrefix])

  useEffect(() => {
    if (!form.image) {
      setImagePreview(existingImage)
      return undefined
    }

    const previewUrl = URL.createObjectURL(form.image)
    setImagePreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [form.image, existingImage])

  const handleChange = (event) => {
    const { name, value, type, checked, files } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'file' ? files[0] : value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const token = localStorage.getItem('access_token')

    const payload = new FormData()
    payload.append('name', form.name)
    payload.append('category', form.category)
    payload.append('brand', form.brand)
    payload.append('sku', form.sku)
    payload.append('price', form.price)
    payload.append('discount_percentage', form.discount_percentage)
    payload.append('stock', form.stock)
    payload.append('description', form.description)
    if (!employeeMode) {
      payload.append('is_active', form.is_active ? 'true' : 'false')
      payload.append('is_featured', form.is_featured ? 'true' : 'false')
    }
    if (form.image) payload.append('images', form.image)

    try {
      const response = await fetch(`http://127.0.0.1:8000${apiPrefix}/products/${id}/`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: payload,
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.detail || data.error || 'Unable to update product.')
      }

      navigate(`${routeBase}/products`)
    } catch (submitError) {
      setError(submitError.message)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-card form-card">
        <div className="admin-card-header">
          <h3>Edit Product</h3>
        </div>

        <form onSubmit={handleSubmit} className="admin-form">
          <label>
            Product name
            <input name="name" value={form.name} onChange={handleChange} required />
          </label>

          <label>
            Category
            <select name="category" value={form.category} onChange={handleChange} required>
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>

          <label>
            Brand
            <select name="brand" value={form.brand} onChange={handleChange} required>
              <option value="">Select brand</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>{brand.name}</option>
              ))}
            </select>
          </label>

          <label>
            SKU
            <input name="sku" value={form.sku} onChange={handleChange} required />
          </label>

          <div className="double-field">
            <label>
              Price
              <input type="number" step="0.01" name="price" value={form.price} onChange={handleChange} required />
            </label>

            <label>
              Discount (%)
              <input type="number" min="0" max="100" name="discount_percentage" value={form.discount_percentage} onChange={handleChange} />
            </label>

            <label>
              Stock
              <input type="number" name="stock" value={form.stock} onChange={handleChange} required />
            </label>
          </div>

          <label>
            Description
            <textarea name="description" rows="5" value={form.description} onChange={handleChange} />
          </label>

          <label>
            Add product image
            <input type="file" name="image" accept="image/*" onChange={handleChange} />
          </label>
          {imagePreview ? <img src={imagePreview.startsWith('blob:') ? imagePreview : `http://127.0.0.1:8000${imagePreview}`} alt="Product preview" className="admin-image-preview" /> : null}

          {!employeeMode ? (
            <>
              <label className="checkbox-row">
                <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
                Active product
              </label>
              <label className="checkbox-row">
                <input type="checkbox" name="is_featured" checked={form.is_featured} onChange={handleChange} />
                Featured product
              </label>
            </>
          ) : null}

          {error ? <div className="form-error">{error}</div> : null}

          <div className="form-actions">
            <button type="submit" className="primary-button">Update Product</button>
            <button type="button" className="secondary-button" onClick={() => navigate(`${routeBase}/products`)}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
