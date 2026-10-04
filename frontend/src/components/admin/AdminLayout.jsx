import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import AdminHeader from './AdminHeader'
import AdminSidebar from './AdminSidebar'
import { clearAuthData } from '../../utils/auth'

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const defaultPageTitle = pathname.includes('/orders/')
    ? 'Order details'
    : pathname.includes('/orders')
      ? 'Orders'
      : pathname.includes('/products/edit')
        ? 'Edit product'
        : pathname.includes('/products/add')
          ? 'Add product'
          : pathname.includes('/products')
            ? 'Products'
            : pathname.includes('/categories/edit')
              ? 'Edit category'
              : pathname.includes('/categories/add')
                ? 'Add category'
                : pathname.includes('/categories')
                  ? 'Categories'
                  : pathname.includes('/gift-vouchers/edit')
                    ? 'Edit gift voucher'
                    : pathname.includes('/gift-vouchers/add')
                      ? 'Add gift voucher'
                      : pathname.includes('/gift-vouchers')
                        ? 'Gift Vouchers'
                  : pathname.includes('/customers/')
                    ? 'Customer details'
                    : pathname.includes('/customers')
                      ? 'Customers'
                        : pathname.includes('/employees')
                          ? 'Employees'
                      : 'Dashboard'

  const pageTitle = pathname === '/admin/profile'
    ? 'Profile'
    : pathname === '/admin/change-password'
      ? 'Change password'
      : defaultPageTitle

  const handleLogout = () => {
    clearAuthData()
    setSidebarOpen(false)
    navigate('/')
  }

  return (
    <div className="admin-shell">
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={handleLogout}
      />

      <div className="admin-main-panel">
        <AdminHeader
          title={pageTitle}
          onMenuClick={() => setSidebarOpen(true)}
          showBack={pathname !== '/admin'}
          showProfileMenu
          onLogout={handleLogout}
        />
        <main className="admin-main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
