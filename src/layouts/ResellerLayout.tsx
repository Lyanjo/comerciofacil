import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { LayoutDashboard, Users, LogOut, Menu, X, Settings, KeyRound } from 'lucide-react'
import ChangePasswordModal from '../components/ChangePasswordModal'

const navItems = [
  { to: '/gestor', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/gestor/clientes', label: 'Meus Clientes', icon: Users },
  { to: '/gestor/configuracoes', label: 'Configurações', icon: Settings },
]

export default function ResellerLayout() {
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
      <header className="bg-indigo-700 text-white shadow-md z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1 rounded hover:bg-indigo-600"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <span className="font-bold text-lg">ComércioFácil</span>
            <span className="hidden md:inline text-xs bg-indigo-900 text-indigo-100 px-2 py-0.5 rounded-full ml-2">Gestor</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:block text-indigo-200 text-sm">{user?.name}</span>
            <button onClick={() => setShowChangePwd(true)} className="flex items-center gap-1 text-indigo-200 hover:text-white transition text-sm" title="Alterar senha">
              <KeyRound size={17} />
              <span className="hidden md:inline">Senha</span>
            </button>
            <button onClick={handleLogout} className="flex items-center gap-1 text-indigo-200 hover:text-white transition text-sm">
              <LogOut size={18} />
              <span className="hidden md:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className={`fixed md:static top-0 left-0 h-full z-20 w-64 bg-white border-r border-gray-200 shadow-lg md:shadow-none transition-transform duration-200 ${menuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <nav className="p-4 space-y-1 mt-16 md:mt-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'text-gray-600 hover:bg-gray-100'}`
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
    </div>
  )
}
