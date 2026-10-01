import { Outlet, useLocation } from 'react-router-dom'
import { useState } from 'react'
import AdminHeader from './AdminHeader'
import AdminSidebar from './AdminSidebar'

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { pathname } = useLocation()
  const pageTitle = pathname.includes('/orders/')
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
                  : pathname.includes('/customers/')
                    ? 'Customer details'
                    : pathname.includes('/customers')
                      ? 'Customers'
                        : pathname.includes('/employees')
                          ? 'Employees'
                      : 'Dashboard'

  return (
    <div className="admin-shell">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="admin-main-panel">
        <AdminHeader title={pageTitle} onMenuClick={() => setSidebarOpen(true)} />
        <main className="admin-main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
