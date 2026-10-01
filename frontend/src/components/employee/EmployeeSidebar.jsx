import { NavLink } from 'react-router-dom'
import { clearAuthData } from '../../utils/auth'

const navItems = [
  { label: 'Dashboard', path: '/employee', end: true },
  { label: 'Orders', path: '/employee/orders' },
  { label: 'Products', path: '/employee/products' },
]

export default function EmployeeSidebar({ isOpen, onClose }) {
  return (
    <aside className={`admin-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="admin-sidebar-header">
        <div><p className="admin-brand-kicker">Operations</p><h2>TechMart Team</h2></div>
        <button type="button" className="admin-close-button" onClick={onClose} aria-label="Close menu">×</button>
      </div>
      <nav className="admin-nav">
        {navItems.map((item) => (
          <NavLink key={item.path} to={item.path} end={item.end} className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <button type="button" className="admin-logout-button" onClick={() => { clearAuthData(); window.location.href = '/' }}>
        Logout
      </button>
    </aside>
  )
}
