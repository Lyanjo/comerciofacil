import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import type { UserRole } from '../types'

interface PrivateRouteProps {
  role: UserRole
}

const roleRedirect: Record<UserRole, string> = {
  admin: '/admin',
  reseller: '/gestor',
  commerce: '/comercio/caixa',
}

export default function PrivateRoute({ role }: PrivateRouteProps) {
  const { isAuthenticated, isLoaded, user } = useAuthStore()

  // Aguarda a leitura do storage antes de redirecionar
  if (!isLoaded) return null

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.role !== role) {
    const redirect = roleRedirect[user?.role as UserRole] ?? '/login'
    return <Navigate to={redirect} replace />
  }

  return <Outlet />
}
