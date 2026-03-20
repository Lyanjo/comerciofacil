import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Users, LayoutDashboard, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/revendedores', label: 'Gestores', icon: Users },
]

export default function AdminLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Topbar */}
      <header className="bg-primary-700 text-white shadow-md z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1 rounded hover:bg-primary-600"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <span className="font-bold text-lg">ComércioFácil</span>
            <span className="hidden md:inline badge-blue bg-blue-900 text-blue-100 ml-2">Admin Master</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:block text-primary-200 text-sm">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-primary-200 hover:text-white transition text-sm"
              title="Sair"
            >
              <LogOut size={18} />
              <span className="hidden md:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className={`
            fixed md:static top-0 left-0 h-full z-20 w-64 bg-white border-r border-gray-200 shadow-lg md:shadow-none
            transition-transform duration-200
            ${menuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
        >
          <nav className="p-4 space-y-1 mt-16 md:mt-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 border border-primary-100'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Overlay mobile */}
        {menuOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-10 md:hidden"
            onClick={() => setMenuOpen(false)}
          />
        )}

        {/* Conteúdo */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
