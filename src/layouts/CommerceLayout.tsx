import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { ShoppingCart, Package, DollarSign, History, LogOut, Menu, X, KeyRound } from 'lucide-react'
import ChangePasswordModal from '../components/ChangePasswordModal'

const navItems = [
  { to: '/comercio/caixa', label: 'Caixa', icon: ShoppingCart },
  { to: '/comercio/estoque', label: 'Estoque', icon: Package },
  { to: '/comercio/historico', label: 'Histórico', icon: History },
  { to: '/comercio/financeiro', label: 'Financeiro', icon: DollarSign },
]

export default function CommerceLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [showChangePwd, setShowChangePwd] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
      {/* Header */}
      <header className="bg-emerald-700 text-white shadow-md z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1 rounded hover:bg-emerald-600" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <span className="font-bold text-lg">ComércioFácil</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:block text-emerald-200 text-sm">{user?.name}</span>
            <button onClick={() => setShowChangePwd(true)} className="flex items-center gap-1 text-emerald-200 hover:text-white transition text-sm" title="Alterar senha">
              <KeyRound size={17} />
            </button>
            <button onClick={handleLogout} className="flex items-center gap-1 text-emerald-200 hover:text-white transition text-sm">
              <LogOut size={18} />
              <span className="hidden md:inline">Sair</span>
            </button>
          </div>
        </div>

        {/* Navegação horizontal (desktop) */}
        <nav className="hidden md:flex border-t border-emerald-600">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-6 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white text-emerald-700 border-b-2 border-white'
                    : 'text-emerald-100 hover:bg-emerald-600'
                }`
              }
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Sidebar mobile */}
      <aside className={`fixed top-0 left-0 h-full z-20 w-64 bg-white border-r border-gray-200 shadow-lg transition-transform duration-200 md:hidden ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 bg-emerald-700 text-white font-bold text-lg">ComércioFácil</div>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'}`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {menuOpen && <div className="fixed inset-0 bg-black/40 z-10 md:hidden" onClick={() => setMenuOpen(false)} />}

      <main className="flex-1 p-4 md:p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
