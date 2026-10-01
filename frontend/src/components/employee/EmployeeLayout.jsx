import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import AdminHeader from '../admin/AdminHeader'
import EmployeeSidebar from './EmployeeSidebar'

export default function EmployeeLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { pathname } = useLocation()
  const title = pathname.includes('/orders/') ? 'Order details'
    : pathname.includes('/orders') ? 'Orders'
      : pathname.includes('/products/edit') ? 'Edit product'
        : pathname.includes('/products/add') ? 'Add product'
          : pathname.includes('/products') ? 'Products'
            : pathname.includes('/categories') ? 'Categories' : 'Dashboard'

  return (
    <div className="admin-shell">
      <EmployeeSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="admin-main-panel">
        <AdminHeader title={title} onMenuClick={() => setSidebarOpen(true)} />
        <main className="admin-main-content"><Outlet /></main>
      </div>
    </div>
  )
}
