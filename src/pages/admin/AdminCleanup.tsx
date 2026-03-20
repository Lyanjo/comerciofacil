import { useState, useEffect } from 'react'
import { Trash2, Loader2, ChevronDown, ChevronRight, AlertTriangle, Users, User, ShieldAlert } from 'lucide-react'
import { adminService } from '../../services/adminService'

type ResellerItem = { id: string; name: string; email: string; total_clients: number }
type ClientItem   = { id: string; name: string; email: string; status: string; created_at: string }

// ─── Confirm dialog inline ──────────────────────────────────────────────────
function ConfirmBox({
  message, detail, onConfirm, onCancel, loading,
}: {
  message: string; detail: string; onConfirm: () => void; onCancel: () => void; loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={24} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-gray-800">{message}</p>
            <p className="text-sm text-gray-500 mt-1">{detail}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Confirmar exclusão
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminCleanup() {
  const [resellers, setResellers] = useState<ResellerItem[]>([])
  const [loadingResellers, setLoadingResellers] = useState(true)

  // Clientes expandidos por gestor
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [clients, setClients]         = useState<Record<string, ClientItem[]>>({})
  const [loadingClients, setLoadingClients] = useState<string | null>(null)

  // Feedback
  const [successMsg, setSuccessMsg] = useState('')

  // Confirm dialog state
  type ConfirmState = {
    message: string; detail: string; onConfirm: () => Promise<void>
  } | null
  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [confirming, setConfirming] = useState(false)

  const load = () => {
    setLoadingResellers(true)
    adminService.cleanupListResellers()
      .then(setResellers)
      .finally(() => setLoadingResellers(false))
  }

  useEffect(() => { load() }, [])

  const flash = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 4000)
  }

  const ask = (message: string, detail: string, onConfirm: () => Promise<void>) => {
    setConfirm({ message, detail, onConfirm })
  }

  const runConfirm = async () => {
    if (!confirm) return
    setConfirming(true)
    try {
      await confirm.onConfirm()
    } finally {
      setConfirming(false)
      setConfirm(null)
    }
  }

  const toggleReseller = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!clients[id]) {
      setLoadingClients(id)
      const list = await adminService.cleanupListClients(id)
      setClients((prev) => ({ ...prev, [id]: list }))
      setLoadingClients(null)
    }
  }

  const handleDeleteClient = (client: ClientItem, resellerId: string) => {
    ask(
      `Deletar cliente "${client.name}"?`,
      'Serão removidos: cadastro, vendas, estoque, financeiro. Ação irreversível.',
      async () => {
        const msg = await adminService.cleanupClient(client.id)
        setClients((prev) => ({
          ...prev,
          [resellerId]: (prev[resellerId] ?? []).filter((c) => c.id !== client.id),
        }))
        setResellers((prev) => prev.map((r) =>
          r.id === resellerId ? { ...r, total_clients: r.total_clients - 1 } : r
        ))
        flash(msg)
      }
    )
  }

  const handleDeleteReseller = (reseller: ResellerItem) => {
    ask(
      `Deletar gestor "${reseller.name}"?`,
      `Serão removidos o gestor e todos os ${reseller.total_clients} cliente(s) com seus dados. Ação irreversível.`,
      async () => {
        const msg = await adminService.cleanupReseller(reseller.id)
        setResellers((prev) => prev.filter((r) => r.id !== reseller.id))
        setClients((prev) => { const next = { ...prev }; delete next[reseller.id]; return next })
        if (expandedId === reseller.id) setExpandedId(null)
        flash(msg)
      }
    )
  }

  const handleCleanAll = () => {
    ask(
      'Limpar sistema inteiro?',
      'Todos os gestores e clientes serão deletados permanentemente. Apenas seu acesso de admin será mantido.',
      async () => {
        const msg = await adminService.cleanupAll()
        setResellers([])
        setClients({})
        setExpandedId(null)
        flash(msg)
      }
    )
  }

  return (
    <div className="space-y-6">
      {confirm && (
        <ConfirmBox
          message={confirm.message}
          detail={confirm.detail}
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
          loading={confirming}
        />
      )}

      {/* Cabeçalho */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ShieldAlert size={24} className="text-red-500" />
            Limpeza de Dados
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Exclusão permanente de gestores, clientes e dados. Use com cuidado.
          </p>
        </div>
        <button
          onClick={handleCleanAll}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors shadow"
        >
          <Trash2 size={16} />
          Limpar sistema inteiro
        </button>
      </div>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm font-medium">
          ✅ {successMsg}
        </div>
      )}

      {/* Aviso */}
      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
        <p className="text-sm text-red-700">
          Todas as exclusões são <strong>permanentes e irreversíveis</strong>. Não há como recuperar os dados após a exclusão.
        </p>
      </div>

      {/* Lista de gestores */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <Users size={18} className="text-gray-500" />
          <h2 className="font-semibold text-gray-700">Gestores e Clientes</h2>
          <span className="ml-auto text-xs text-gray-400">{resellers.length} gestor(es)</span>
        </div>

        {loadingResellers ? (
          <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
            <Loader2 size={20} className="animate-spin" />Carregando...
          </div>
        ) : resellers.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-10">Nenhum gestor cadastrado.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {resellers.map((r) => (
              <div key={r.id}>
                {/* Linha do gestor */}
                <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <button
                    onClick={() => toggleReseller(r.id)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    {expandedId === r.id
                      ? <ChevronDown size={16} className="text-gray-400 shrink-0" />
                      : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">{r.name}</p>
                      <p className="text-xs text-gray-400 truncate">{r.email}</p>
                    </div>
                    <span className="ml-2 shrink-0 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      {r.total_clients} cliente(s)
                    </span>
                  </button>
                  <button
                    onClick={() => handleDeleteReseller(r)}
                    className="shrink-0 p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title={`Deletar gestor ${r.name} e todos seus clientes`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Clientes expandidos */}
                {expandedId === r.id && (
                  <div className="bg-gray-50 border-t border-gray-100">
                    {loadingClients === r.id ? (
                      <div className="flex items-center gap-2 px-10 py-4 text-gray-400 text-sm">
                        <Loader2 size={14} className="animate-spin" />Carregando clientes...
                      </div>
                    ) : (clients[r.id] ?? []).length === 0 ? (
                      <p className="px-10 py-4 text-sm text-gray-400 italic">Nenhum cliente cadastrado.</p>
                    ) : (
                      (clients[r.id] ?? []).map((c) => (
                        <div key={c.id} className="flex items-center gap-3 px-10 py-2.5 hover:bg-gray-100 transition-colors border-b border-gray-100 last:border-0">
                          <User size={13} className="text-gray-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700 truncate font-medium">{c.name}</p>
                            <p className="text-xs text-gray-400 truncate">{c.email}</p>
                          </div>
                          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
                            c.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {c.status === 'active' ? 'Ativo' : 'Inativo'}
                          </span>
                          <button
                            onClick={() => handleDeleteClient(c, r.id)}
                            className="shrink-0 p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title={`Deletar cliente ${c.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
