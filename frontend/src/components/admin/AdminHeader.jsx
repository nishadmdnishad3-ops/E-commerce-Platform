import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { getCurrentRole } from '../../utils/auth'

function AdminBackButton() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const canGoBack = window.history.state?.idx > 0

  return (
    <button
      type="button"
      className="admin-back-button"
      onClick={() => navigate(canGoBack ? -1 : '/admin')}
      aria-label={`Back from ${pathname}`}
    >
      <span aria-hidden="true">←</span> Back
    </button>
  )
}

export default function AdminHeader({ title, onMenuClick, showBack = false, showProfileMenu = false, onLogout }) {
  const username = localStorage.getItem('username') || 'Admin'
  const role = getCurrentRole() || 'admin'
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef(null)

  useEffect(() => {
    if (!profileMenuOpen) return undefined

    const closeOnOutsideClick = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) setProfileMenuOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setProfileMenuOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [profileMenuOpen])

  return (
    <header className="admin-header">
      <div className="admin-header-left">
        <button type="button" className="admin-menu-button" onClick={onMenuClick}>
          ☰
        </button>
        <div className="admin-header-title">
          {showBack ? <AdminBackButton /> : null}
          <p className="admin-page-label">Dashboard</p>
          <h1>{title}</h1>
        </div>
      </div>

      {showProfileMenu ? (
        <div className="admin-profile-menu-wrap" ref={profileMenuRef}>
          <button
            type="button"
            className="admin-profile-trigger"
            aria-expanded={profileMenuOpen}
            aria-haspopup="menu"
            onClick={() => setProfileMenuOpen((open) => !open)}
          >
            <span className="admin-avatar" aria-hidden="true">{username.charAt(0).toUpperCase()}</span>
            <span className="admin-profile-trigger-text">
              <strong>{username}</strong>
              <small>{roleLabel}</small>
            </span>
            <span className="admin-profile-chevron" aria-hidden="true">⌄</span>
          </button>

          {profileMenuOpen ? (
            <div className="admin-profile-menu" role="menu">
              <Link to="/admin/profile" className="admin-profile-menu-item" role="menuitem" onClick={() => setProfileMenuOpen(false)}>
                <span aria-hidden="true">👤</span> Profile
              </Link>
              <Link to="/admin/change-password" className="admin-profile-menu-item" role="menuitem" onClick={() => setProfileMenuOpen(false)}>
                <span aria-hidden="true">🔑</span> Change Password
              </Link>
              <Link to="/" className="admin-profile-menu-item" role="menuitem" onClick={() => setProfileMenuOpen(false)}>
                <span aria-hidden="true">🏠</span> Go to Home
              </Link>
              <div className="admin-profile-menu-divider" />
              <button
                type="button"
                className="admin-profile-menu-item logout"
                role="menuitem"
                onClick={() => {
                  setProfileMenuOpen(false)
                  onLogout?.()
                }}
              >
                <span aria-hidden="true">🚪</span> Logout
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="admin-header-user">
          <span className="admin-avatar">{username.charAt(0).toUpperCase()}</span>
          <div>
            <strong>{username}</strong>
            <small>{roleLabel}</small>
          </div>
        </div>
      )}
    </header>
  )
}
