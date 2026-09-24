import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()

  useEffect(() => {
    if (!successMessage) {
      return undefined
    }

    const timeoutId = setTimeout(() => {
      setSuccessMessage('')
      navigate('/')
    }, 2500)

    return () => clearTimeout(timeoutId)
  }, [successMessage, navigate])

  const handleLogin = async (e) => {
    e.preventDefault()

    setError('')
    setLoading(true)

    try {
      const response = await fetch(
        'http://127.0.0.1:8000/api/accounts/login/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: username,
            password: password,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error('Invalid username or password')
      }

      localStorage.setItem('access_token', data.access)
      localStorage.setItem('refresh_token', data.refresh)
      localStorage.setItem('username', username)
      
      window.dispatchEvent(new Event('auth-change'))

      setSuccessMessage('Login successful!')
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      {successMessage && (
        <div className="login-success-message" role="status">
          <span aria-hidden="true">✓</span>
          <span>{successMessage}</span>
        </div>
      )}

      <div className="auth-card">

        <div className="auth-logo">
          <img
            src="/tech-mart-logo.png"
            alt="Tech Mart"
          />
        </div>

        <h1>Welcome To TechMart</h1>
        <p className="auth-subtitle">
          Login to your account
        </p>

        <form onSubmit={handleLogin}>

          <label>Username</label>

          <input
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          <label>Password</label>

          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <p className="auth-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

        </form>

        <p className="auth-footer">
          Don't have an account?{' '}
          <Link to="/register">
            Register
          </Link>
        </p>

      </div>
    </main>
  )
}

export default Login