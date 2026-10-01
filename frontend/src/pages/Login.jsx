import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  initializeAppleLogin,
  initializeGoogleLogin,
  loginWithApple,
  loginWithGoogle,
} from '../utils/socialAuth'
import { getRoleHome, saveAuthData } from '../utils/auth'

function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()

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

      const user = saveAuthData(data, username)
      navigate(getRoleHome(user.role), { replace: true })
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    setLoading(true)

    try {
      const credential = await initializeGoogleLogin()
      const data = await loginWithGoogle(credential)
      navigate(getRoleHome(data.user?.role || data.role), { replace: true })
    } catch (error) {
      setError(error.message || 'Google login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleAppleLogin = async () => {
    setError('')
    setLoading(true)

    try {
      const appleResponse = await initializeAppleLogin()
      const identityToken = appleResponse?.authorization?.id_token || appleResponse?.id_token

      if (!identityToken) {
        throw new Error('Apple login failed. Please try again.')
      }

      const data = await loginWithApple(identityToken, appleResponse?.user || {})
      navigate(getRoleHome(data.user?.role || data.role), { replace: true })
    } catch (error) {
      setError(error.message || 'Apple login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
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

          <label>Email or username</label>

          <input
            type="text"
            placeholder="Enter your email or username"
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

        <div style={{ margin: '18px 0 12px', display: 'grid', gap: '10px' }}>
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              width: '100%',
              border: '1px solid #dadce0',
              borderRadius: '999px',
              background: '#ffffff',
              color: '#3c4043',
              fontWeight: 600,
              padding: '12px 18px',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
            }}
          >
            <span style={{ fontSize: '18px', fontWeight: 700 }}>G</span>
            <span>Continue with Google</span>
          </button>

          <button
            type="button"
            onClick={handleAppleLogin}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              width: '100%',
              border: '1px solid #1f1f1f',
              borderRadius: '999px',
              background: '#111111',
              color: '#ffffff',
              fontWeight: 600,
              padding: '12px 18px',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            <span style={{ fontSize: '18px' }}></span>
            <span>Continue with Apple</span>
          </button>
        </div>

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