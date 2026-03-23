import { useState } from 'react'
import { X, KeyRound, Loader2, Eye, EyeOff } from 'lucide-react'
import api from '../lib/api'

interface Props {
  onClose: () => void
}

export default function ChangePasswordModal({ onClose }: Props) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext]       = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState(false)

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.next !== form.confirm) { setError('A nova senha e a confirmação não coincidem.'); return }
    if (form.next.length < 6)       { setError('A nova senha deve ter no mínimo 6 caracteres.'); return }
    setLoading(true)
    try {
      await api.post('/auth/change-password', {
        currentPassword: form.current,
        newPassword: form.next,
      })
      setSuccess(true)
      setTimeout(onClose, 1500)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Erro ao alterar a senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <KeyRound size={20} className="text-primary-600" />
            <h2 className="font-bold text-gray-800">Alterar Senha</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-2">✅</div>
            <p className="font-semibold text-green-700">Senha alterada com sucesso!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Senha atual */}
            <div>
              <label className="label">Senha atual</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={form.current}
                  onChange={(e) => set('current', e.target.value)}
                  required
                  autoFocus
                />
                <button type="button" tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowCurrent((v) => !v)}
                >
                  {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Nova senha */}
            <div>
              <label className="label">Nova senha</label>
              <div className="relative">
                <input
                  type={showNext ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="Mínimo 6 caracteres"
                  value={form.next}
                  onChange={(e) => set('next', e.target.value)}
                  required
                  minLength={6}
                />
                <button type="button" tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowNext((v) => !v)}
                >
                  {showNext ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirmar nova senha */}
            <div>
              <label className="label">Confirmar nova senha</label>
              <input
                type="password"
                className="input"
                placeholder="Repita a nova senha"
                value={form.confirm}
                onChange={(e) => set('confirm', e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium"
              >
                Cancelar
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Alterar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
