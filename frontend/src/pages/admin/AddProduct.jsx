import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const allowedImageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp'])
const allowedImageTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])

const initialForm = {
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
}

const getFileIdentity = (file) => `${file.name}:${file.size}:${file.lastModified}:${file.type}`

export default function AddProduct({ apiPrefix = '/api/admin', routeBase = '/admin', employeeMode = false }) {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const selectedImagesRef = useRef([])
  const imageIdRef = useRef(0)
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [form, setForm] = useState(initialForm)
  const [images, setImages] = useState([])
  const [primaryImageId, setPrimaryImageId] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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
  }, [apiPrefix])

  useEffect(() => () => {
    selectedImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl))
  }, [])

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const addImages = (fileList) => {
    const currentImages = selectedImagesRef.current
    const knownFiles = new Set(currentImages.map(({ file }) => getFileIdentity(file)))
    const additions = []
    const validationErrors = new Set()

    Array.from(fileList).forEach((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase()
      if (!allowedImageExtensions.has(extension) || (file.type && !allowedImageTypes.has(file.type.toLowerCase()))) {
        validationErrors.add('Only JPG, JPEG, PNG and WEBP images are allowed.')
        return
      }
      if (file.size > MAX_IMAGE_SIZE) {
        validationErrors.add('Image size must be 5MB or less.')
        return
      }

      const identity = getFileIdentity(file)
      if (knownFiles.has(identity)) return
      knownFiles.add(identity)
      additions.push({
        id: ++imageIdRef.current,
        file,
        previewUrl: URL.createObjectURL(file),
      })
    })

    if (additions.length) {
      const nextImages = [...currentImages, ...additions]
      selectedImagesRef.current = nextImages
      setImages(nextImages)
      if (currentImages.length === 0) setPrimaryImageId(additions[0].id)
      setSuccess('')
    }

    if (validationErrors.size) {
      setError(Array.from(validationErrors).join(' '))
    } else if (additions.length) {
      setError('')
    }
  }

  const removeImage = (imageId) => {
    const removedImage = selectedImagesRef.current.find((image) => image.id === imageId)
    if (removedImage) URL.revokeObjectURL(removedImage.previewUrl)

    const nextImages = selectedImagesRef.current.filter((image) => image.id !== imageId)
    selectedImagesRef.current = nextImages
    setImages(nextImages)
    if (primaryImageId === imageId) setPrimaryImageId(nextImages[0]?.id ?? null)
  }

  const handleDropzoneKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      fileInputRef.current?.click()
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
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
    payload.append('is_active', form.is_active ? 'true' : 'false')
    payload.append('is_featured', form.is_featured ? 'true' : 'false')
    images.forEach(({ file }) => payload.append('images', file))
    if (images.length) {
      payload.append('primary_image_index', String(images.findIndex((image) => image.id === primaryImageId)))
    }

    try {
      const response = await fetch(`http://127.0.0.1:8000${apiPrefix}/products/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: payload,
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.detail || data.error || 'Unable to create product.')
      }

      selectedImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl))
      selectedImagesRef.current = []
      setImages([])
      setPrimaryImageId(null)
      setForm(initialForm)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setSuccess('Product added successfully.')
      window.setTimeout(() => navigate(`${routeBase}/products`), 1200)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-card form-card">
        <div className="admin-card-header">
          <h3>Add Product</h3>
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

          <section className="product-image-upload" aria-labelledby="product-image-heading">
            <h4 id="product-image-heading">Product Images</h4>
            <input
              ref={fileInputRef}
              className="product-image-file-input"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              multiple
              aria-label="Choose product image files"
              onChange={(event) => {
                addImages(event.target.files)
                event.target.value = ''
              }}
            />
            <div
              className={`product-image-dropzone${isDragging ? ' is-dragging' : ''}`}
              role="button"
              tabIndex={0}
              aria-label="Upload product images"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={handleDropzoneKeyDown}
              onDragEnter={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'copy'
                setIsDragging(true)
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false)
              }}
              onDrop={(event) => {
                event.preventDefault()
                setIsDragging(false)
                addImages(event.dataTransfer.files)
              }}
            >
              <span className="product-image-upload-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14.5v4A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <strong>{isDragging ? 'Drop images here' : 'Drag & Drop Product Images Here'}</strong>
              <span>or click to browse</span>
              <small>PNG, JPG, JPEG, WEBP · Maximum 5MB per image · Multiple images allowed</small>
            </div>

            {error ? <div className="product-image-error" role="alert">{error}</div> : null}
            {success ? <div className="product-image-success" role="status">{success}</div> : null}

            {images.length > 0 ? (
              <div className="product-image-preview-grid" aria-label="Selected product images">
                {images.map((image) => {
                  const isPrimary = image.id === primaryImageId
                  return (
                    <article className="product-image-preview-card" key={image.id}>
                      <div className="product-image-preview-frame">
                        <img src={image.previewUrl} alt={`Preview of ${image.file.name}`} />
                        {isPrimary ? <span className="product-image-primary-badge">Primary</span> : null}
                      </div>
                      <div className="product-image-preview-info">
                        <span className="product-image-filename" title={image.file.name}>{image.file.name}</span>
                        {isPrimary ? (
                          <span className="product-image-primary-label">Primary Image</span>
                        ) : (
                          <button type="button" className="product-image-text-button" onClick={() => setPrimaryImageId(image.id)}>
                            Set as Primary
                          </button>
                        )}
                        <button
                          type="button"
                          className="product-image-remove-button"
                          aria-label={`Remove ${image.file.name}`}
                          onClick={() => removeImage(image.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : null}
          </section>

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

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={isSubmitting || Boolean(success)}>
              {isSubmitting ? `Uploading ${images.length} image${images.length === 1 ? '' : 's'}...` : 'Save Product'}
            </button>
            <button type="button" className="secondary-button" disabled={isSubmitting} onClick={() => navigate(`${routeBase}/products`)}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
