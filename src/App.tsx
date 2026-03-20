import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'

// ─── Layouts ──────────────────────────────────────────────────────────────────
import AdminLayout from './layouts/AdminLayout'
import ResellerLayout from './layouts/ResellerLayout'
import CommerceLayout from './layouts/CommerceLayout'

// ─── Páginas públicas ─────────────────────────────────────────────────────────
import LoginPage from './pages/auth/LoginPage'

// ─── Páginas Admin ────────────────────────────────────────────────────────────
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminResellers from './pages/admin/AdminResellers'
import AdminCleanup from './pages/admin/AdminCleanup'

// ─── Páginas Revendedor ───────────────────────────────────────────────────────
import ResellerDashboard from './pages/reseller/ResellerDashboard'
import ResellerClients from './pages/reseller/ResellerClients'
import ResellerSettings from './pages/reseller/ResellerSettings'

// ─── Páginas Comércio ─────────────────────────────────────────────────────────
import CashierPage from './pages/commerce/CashierPage'
import StockPage from './pages/commerce/StockPage'
import FinancialPage from './pages/commerce/FinancialPage'
import SalesHistoryPage from './pages/commerce/SalesHistoryPage'

import PrivateRoute from './components/PrivateRoute'

function App() {
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage)

  useEffect(() => {
    loadFromStorage()
  }, [loadFromStorage])

  return (
    <BrowserRouter basename="/">
      <Routes>
        {/* Pública */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Admin */}
        <Route element={<PrivateRoute role="admin" />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/revendedores" element={<AdminResellers />} />
            <Route path="/admin/limpeza" element={<AdminCleanup />} />
          </Route>
        </Route>

        {/* Revendedor */}
        <Route element={<PrivateRoute role="reseller" />}>
          <Route element={<ResellerLayout />}>
            <Route path="/gestor" element={<ResellerDashboard />} />
            <Route path="/gestor/clientes" element={<ResellerClients />} />
            <Route path="/gestor/configuracoes" element={<ResellerSettings />} />
          </Route>
        </Route>

        {/* Comércio */}
        <Route element={<PrivateRoute role="commerce" />}>
          <Route element={<CommerceLayout />}>
            <Route path="/comercio/caixa" element={<CashierPage />} />
            <Route path="/comercio/estoque" element={<StockPage />} />
            <Route path="/comercio/financeiro" element={<FinancialPage />} />
            <Route path="/comercio/historico" element={<SalesHistoryPage />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
