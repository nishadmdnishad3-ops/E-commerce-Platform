import { getCurrentRole } from '../../utils/auth'

export default function AdminHeader({ title, onMenuClick }) {
  const username = localStorage.getItem('username') || 'Admin'
  const role = getCurrentRole() || 'admin'
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1)

  return (
    <header className="admin-header">
      <div className="admin-header-left">
        <button type="button" className="admin-menu-button" onClick={onMenuClick}>
          ☰
        </button>
        <div>
          <p className="admin-page-label">Dashboard</p>
          <h1>{title}</h1>
        </div>
      </div>

      <div className="admin-header-user">
        <span className="admin-avatar">A</span>
        <div>
          <strong>{username}</strong>
          <small>{roleLabel}</small>
        </div>
      </div>
    </header>
  )
}
