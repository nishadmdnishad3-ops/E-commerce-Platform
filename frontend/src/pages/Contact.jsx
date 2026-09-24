import { useState } from 'react'

const initialForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
}

function Contact() {
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
    setErrors((currentErrors) => ({
      ...currentErrors,
      [name]: '',
    }))
    setSubmitted(false)
  }

  const validate = () => {
    const nextErrors = {}
    const requiredFields = [
      ['firstName', 'First Name'],
      ['lastName', 'Last Name'],
      ['email', 'Email'],
      ['subject', 'Subject'],
      ['message', 'Message'],
    ]

    requiredFields.forEach(([field, label]) => {
      if (!form[field].trim()) {
        nextErrors[field] = `${label} is required.`
      }
    })

    if (
      form.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    ) {
      nextErrors.email = 'Enter a valid email address.'
    }

    return nextErrors
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const nextErrors = validate()

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setSubmitted(false)
      return
    }

    setErrors({})
    setSubmitted(true)
    setForm(initialForm)
  }

  return (
    <main className="contact-page">
      <header className="contact-header">
        <p className="contact-eyebrow">We are here to help</p>
        <h1>Contact Us</h1>
        <p>Have a question or need help? Get in touch with us.</p>
      </header>

      <div className="contact-layout">
        <section className="contact-information">
          <h2>Contact Information</h2>

          <div className="contact-detail">
            <span aria-hidden="true">📍</span>
            <div>
              <strong>Address</strong>
              <p>Dhaka, Bangladesh</p>
            </div>
          </div>

          <div className="contact-detail">
            <span aria-hidden="true">📞</span>
            <div>
              <strong>Phone</strong>
              <p>+880 1XXX-XXXXXX</p>
            </div>
          </div>

          <div className="contact-detail">
            <span aria-hidden="true">✉</span>
            <div>
              <strong>Email</strong>
              <p>support@techmart.com</p>
            </div>
          </div>

          <div className="contact-detail">
            <span aria-hidden="true">🕒</span>
            <div>
              <strong>Opening Hours</strong>
              <p>Sat - Thu: 9:00 AM - 8:00 PM</p>
            </div>
          </div>
        </section>

        <section className="contact-form-section">
          <h2>Send us a message</h2>
          <form onSubmit={handleSubmit} noValidate>
            <div className="contact-form-grid">
              <label>
                First Name
                <input
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.firstName)}
                />
                {errors.firstName && <small>{errors.firstName}</small>}
              </label>

              <label>
                Last Name
                <input
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.lastName)}
                />
                {errors.lastName && <small>{errors.lastName}</small>}
              </label>

              <label>
                Email
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.email)}
                />
                {errors.email && <small>{errors.email}</small>}
              </label>

              <label>
                Phone
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                />
              </label>

              <label className="contact-full-field">
                Subject
                <input
                  name="subject"
                  value={form.subject}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.subject)}
                />
                {errors.subject && <small>{errors.subject}</small>}
              </label>

              <label className="contact-full-field">
                Message
                <textarea
                  name="message"
                  rows="5"
                  value={form.message}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.message)}
                />
                {errors.message && <small>{errors.message}</small>}
              </label>
            </div>

            {submitted && (
              <p className="contact-success">
                Thank you! Your message has been sent successfully.
              </p>
            )}

            <button type="submit" className="contact-submit-button">
              Send Message
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}

export default Contact
