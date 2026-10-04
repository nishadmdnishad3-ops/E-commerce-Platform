import { NavLink } from 'react-router-dom'

const navItems = [
  { label: 'Dashboard', path: '/admin' },
  { label: 'Orders', path: '/admin/orders' },
  { label: 'Products', path: '/admin/products' },
  { label: 'Categories', path: '/admin/categories' },
  { label: 'Gift Vouchers', path: '/admin/gift-vouchers', icon: '🎁' },
  { label: 'Customers', path: '/admin/customers' },
  { label: 'Employees', path: '/admin/employees' },
]

export default function AdminSidebar({ isOpen, onClose, onLogout }) {
  return (
    <aside className={`admin-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="admin-sidebar-header">
        <div>
          <p className="admin-brand-kicker">Management</p>
          <h2>TechMart Admin</h2>
        </div>
        <button type="button" className="admin-close-button" onClick={onClose}>
          ✕
        </button>
      </div>

      <nav className="admin-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/admin'}
            className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            {item.icon ? <span className="admin-nav-icon" aria-hidden="true">{item.icon}</span> : null}
            {item.label}
          </NavLink>
        ))}
      </nav>

      <button
        type="button"
        className="admin-logout-button"
        onClick={onLogout}
      >
        Logout
      </button>
    </aside>
  )
}
