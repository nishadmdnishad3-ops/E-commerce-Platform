import { Navigate } from 'react-router-dom'
import { getCurrentRole, getRoleHome } from '../utils/auth'

export default function ProtectedRoute({ children, requiredRole, requiredRoles }) {
  const role = getCurrentRole()
  const allowedRoles = requiredRoles || (requiredRole ? [requiredRole] : [])

  if (!localStorage.getItem('access_token') || !role) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles.length && !allowedRoles.includes(role)) {
    return <Navigate to={getRoleHome(role)} replace />
  }

  return children
}