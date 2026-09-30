import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  initializeAppleLogin,
  initializeGoogleLogin,
  loginWithApple,
  loginWithGoogle,
} from '../utils/socialAuth'

function Register() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()

  const handleRegister = async (e) => {
    e.preventDefault()

    setError('')

    if (password !== password2) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(
        'http://127.0.0.1:8000/api/accounts/register/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username,
            email,
            phone_number: phone,
            password,
            password2,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.detail ||
          data.username?.[0] ||
          data.email?.[0] ||
          'Registration failed'
        )
      }

      alert('Account created successfully!')

      navigate('/login')
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleRegister = async () => {
    setError('')
    setLoading(true)

    try {
      const credential = await initializeGoogleLogin()
      await loginWithGoogle(credential)
      navigate('/')
    } catch (error) {
      setError(error.message || 'Google login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleAppleRegister = async () => {
    setError('')
    setLoading(true)

    try {
      const appleResponse = await initializeAppleLogin()
      const identityToken = appleResponse?.authorization?.id_token || appleResponse?.id_token

      if (!identityToken) {
        throw new Error('Apple login failed. Please try again.')
      }

      await loginWithApple(identityToken, appleResponse?.user || {})
      navigate('/')
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
          Create your account
        </p>

        <form onSubmit={handleRegister}>

          <label>Username</label>

          <input
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          <label>Email</label>

          <input
            type="email"
            placeholder="example@mail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label>Phone Number</label>

          <input
            type="text"
            placeholder="+880123456789"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <label>Password</label>

          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <label>Retype Password</label>

          <input
            type="password"
            placeholder="Retype password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
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
            {loading ? 'Creating Account...' : 'Create An Account'}
          </button>

        </form>

        <div style={{ margin: '18px 0 12px', display: 'grid', gap: '10px' }}>
          <button
            type="button"
            onClick={handleGoogleRegister}
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
            onClick={handleAppleRegister}
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
          Already have an account?{' '}
          <Link to="/login">
            Login
          </Link>
        </p>

      </div>
    </main>
  )
}

export default Register