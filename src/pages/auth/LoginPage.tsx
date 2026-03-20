import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { authService } from '../../services/authService'
import type { UserRole } from '../../types'

const roleRedirect: Record<UserRole, string> = {
  admin: '/admin',
  reseller: '/gestor',
  commerce: '/comercio/caixa',
}

export default function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await authService.login(email, password)
      login(result.user, result.token, remember)
      navigate(roleRedirect[result.user.role])
    } catch (err: unknown) {
      // Extrai mensagem do backend (Axios encapsula em error.response.data.error)
      const axiosErr = err as { response?: { data?: { error?: string } } }
      const msg = axiosErr?.response?.data?.error || (err instanceof Error ? err.message : 'E-mail ou senha inválidos.')
      setError(msg)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <span className="text-2xl font-bold text-primary-600">CF</span>
          </div>
          <h1 className="text-3xl font-bold text-white">ComércioFácil</h1>
          <p className="text-primary-200 mt-1">Sistema de gestão para pequenos comércios</p>
        </div>

        {/* Card de login */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Entrar na sua conta</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">E-mail</label>
              <input
                type="email"
                className="input"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="label">Senha</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 cursor-pointer accent-primary-600"
              />
              <label htmlFor="remember" className="text-sm text-gray-600 cursor-pointer select-none">
                Continuar conectado
              </label>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full py-3 text-base"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>


        </div>

        <p className="text-center text-primary-200 text-sm mt-6">
          © 2026 ComércioFácil. Todos os direitos reservados.
        </p>
      </div>
    </div>
  )
}
