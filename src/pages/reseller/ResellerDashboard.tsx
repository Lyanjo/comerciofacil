import { useState, useEffect, useMemo } from 'react'
import { Users, UserCheck, UserX, Key, Loader2, UserPlus, Receipt, TrendingUp, Settings, DollarSign, ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'
import { resellerService } from '../../services/resellerService'
import type { ResellerDashboard, ClientRevenue } from '../../services/resellerService'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const SHOW_LIMIT = 5

type SortKey = 'name' | 'price' | 'estimated'
type SortDir = 'asc' | 'desc'

function SortTh({ label, sk, current, dir, onSort, align = 'right' }: {
  label: string; sk: SortKey; current: SortKey; dir: SortDir
  onSort: (k: SortKey) => void; align?: 'left' | 'right' | 'center'
}) {
  const active = current === sk
  return (
    <th
      className={`py-2 px-3 text-${align} text-gray-500 font-medium cursor-pointer select-none hover:text-gray-700 whitespace-nowrap`}
      onClick={() => onSort(sk)}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end' : 'justify-start'} w-full`}>
        {label}
        {active
          ? dir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
          : <ChevronsUpDown size={13} className="opacity-30" />}
      </span>
    </th>
  )
}

export default function ResellerDashboardPage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [data, setData] = useState<ResellerDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAllClients, setShowAllClients] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  useEffect(() => {
    resellerService.getDashboard().then(setData).finally(() => setLoading(false))
  }, [])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const activeRevenue = useMemo<ClientRevenue[]>(() => {
    const list = (data?.clientsRevenue ?? []).filter((c) => c.active)
    return [...list].sort((a, b) => {
      let va: string | number, vb: string | number
      if (sortKey === 'name')       { va = a.name.toLowerCase(); vb = b.name.toLowerCase() }
      else if (sortKey === 'price') { va = a.price ?? -1; vb = b.price ?? -1 }
      else                          { va = a.estimated; vb = b.estimated }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [data, sortKey, sortDir])

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-gray-400 gap-2"><Loader2 size={24} className="animate-spin" />Carregando...</div>
  }

  const usagePercent = data && data.totalLicenses > 0
    ? Math.round((data.usedLicenses / data.totalLicenses) * 100)
    : 0

  const visibleClients = showAllClients ? activeRevenue : activeRevenue.slice(0, SHOW_LIMIT)
  const hasAnyPrice = activeRevenue.some((c) => c.price != null)
  const estimatedReceivable = data?.estimatedReceivable ?? 0

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Olá, {user?.name} 👋</h1>
          <p className="text-gray-500 text-sm mt-1">Aqui está um resumo dos seus clientes.</p>
        </div>
        <button
          onClick={() => navigate('/gestor/configuracoes')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Settings size={15} />Configurações
        </button>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card flex flex-col items-center text-center gap-2 py-5">
          <div className="bg-blue-500 text-white p-3 rounded-xl"><Users size={22} /></div>
          <p className="text-2xl font-bold text-gray-800">{data?.totalClients ?? 0}</p>
          <p className="text-xs text-gray-500 leading-tight">Total de Clientes</p>
        </div>
        <div className="card flex flex-col items-center text-center gap-2 py-5">
          <div className="bg-green-500 text-white p-3 rounded-xl"><UserCheck size={22} /></div>
          <p className="text-2xl font-bold text-gray-800">{data?.activeClients ?? 0}</p>
          <p className="text-xs text-gray-500 leading-tight">Clientes Ativos</p>
        </div>
        <div className="card flex flex-col items-center text-center gap-2 py-5">
          <div className="bg-emerald-500 text-white p-3 rounded-xl"><UserPlus size={22} /></div>
          <p className="text-2xl font-bold text-gray-800">{data?.newClientsThisMonth ?? 0}</p>
          <p className="text-xs text-gray-500 leading-tight">Novos este Mês</p>
        </div>
        <div className="card flex flex-col items-center text-center gap-2 py-5">
          <div className="bg-red-400 text-white p-3 rounded-xl"><UserX size={22} /></div>
          <p className="text-2xl font-bold text-gray-800">{data?.canceledClients ?? 0}</p>
          <p className="text-xs text-gray-500 leading-tight">Cancelados</p>
        </div>
      </div>

      {/* Fatura + Preço ao cliente + Receita a receber */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card border-l-4 border-l-orange-400">
          <div className="flex items-center gap-2 mb-3">
            <Receipt size={18} className="text-orange-500" />
            <h2 className="font-semibold text-gray-700">Fatura do Mês</h2>
          </div>
          {data?.monthlyFee ? (
            <>
              <p className="text-3xl font-bold text-orange-500">{fmt(data.monthlyBill)}</p>
              <p className="text-xs text-gray-400 mt-1">
                {data.activeClients} cliente{data.activeClients !== 1 ? 's' : ''} ativo{data.activeClients !== 1 ? 's' : ''} × {fmt(data.monthlyFee)} / mês
              </p>
            </>
          ) : (
            <div className="text-sm text-gray-400 italic">Valor mensal não definido pelo administrador.</div>
          )}
        </div>

        <div className="card border-l-4 border-l-indigo-400">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={18} className="text-indigo-500" />
            <h2 className="font-semibold text-gray-700">Seu Preço ao Cliente</h2>
          </div>
          {data?.priceHidden ? (
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-400">••••••</span>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Oculto</span>
            </div>
          ) : data?.resellerPrice != null ? (
            <>
              <p className="text-3xl font-bold text-indigo-600">{fmt(data.resellerPrice)}</p>
              <p className="text-xs text-gray-400 mt-1">Valor mensal cobrado de cada cliente</p>
            </>
          ) : (
            <div className="text-sm text-gray-400 italic">
              Não configurado.{' '}
              <button onClick={() => navigate('/gestor/configuracoes')} className="text-indigo-500 hover:underline">Configurar agora</button>
            </div>
          )}
        </div>

        <div className="card border-l-4 border-l-green-400">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign size={18} className="text-green-500" />
            <h2 className="font-semibold text-gray-700">A Receber este Mês</h2>
          </div>
          {data?.priceHidden ? (
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-400">••••••</span>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Oculto</span>
            </div>
          ) : hasAnyPrice ? (
            <>
              <p className="text-3xl font-bold text-green-600">{fmt(estimatedReceivable)}</p>
              <p className="text-xs text-gray-400 mt-1">
                {activeRevenue.filter((c) => c.price != null).length} cliente{activeRevenue.filter((c) => c.price != null).length !== 1 ? 's' : ''} com preço definido
              </p>
            </>
          ) : (
            <div className="text-sm text-gray-400 italic">
              Configure os preços dos clientes.{' '}
              <button onClick={() => navigate('/gestor/configuracoes')} className="text-green-600 hover:underline">Configurar</button>
            </div>
          )}
        </div>
      </div>

      {/* Tabela A Receber por Cliente */}
      {!data?.priceHidden && activeRevenue.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={18} className="text-green-500" />
            <h2 className="font-semibold text-gray-700">A Receber por Cliente</h2>
            <span className="ml-auto text-xs text-gray-400">{activeRevenue.length} cliente{activeRevenue.length !== 1 ? 's' : ''} ativo{activeRevenue.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <SortTh label="Cliente"     sk="name"      current={sortKey} dir={sortDir} onSort={handleSort} align="left" />
                  <SortTh label="Mensalidade" sk="price"     current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="A Receber"   sk="estimated" current={sortKey} dir={sortDir} onSort={handleSort} />
                </tr>
              </thead>
              <tbody>
                {visibleClients.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 px-3 text-gray-800">{c.name}</td>
                    <td className="py-2.5 px-3 text-right">
                      {c.price != null
                        ? <span className="text-gray-700">{fmt(c.price)}</span>
                        : <span className="text-gray-400 italic text-xs">sem preço</span>}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {c.estimated > 0
                        ? <span className="font-semibold text-green-600">{fmt(c.estimated)}</span>
                        : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-green-50">
                  <td className="py-3 px-3 font-semibold text-gray-700" colSpan={2}>Total</td>
                  <td className="py-3 px-3 text-right font-bold text-green-600">{fmt(estimatedReceivable)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {activeRevenue.length > SHOW_LIMIT && (
            <button
              onClick={() => setShowAllClients((v) => !v)}
              className="mt-3 flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium mx-auto"
            >
              {showAllClients
                ? <><ChevronUp size={14} />Mostrar menos</>
                : <><ChevronDown size={14} />Ver todos ({activeRevenue.length} clientes)</>}
            </button>
          )}
        </div>
      )}

      {/* Licenças */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Key size={18} className="text-purple-500" />
          <h2 className="font-semibold text-gray-700">Licenças</h2>
        </div>
        <div className="flex items-end gap-2 mb-2">
          <span className="text-3xl font-bold text-purple-600">{data?.usedLicenses ?? 0}</span>
          <span className="text-lg text-gray-400 mb-0.5">/ {data?.totalLicenses ?? 0}</span>
          <span className="text-xs text-gray-400 mb-1 ml-1">em uso</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2">
          <div
            className={`h-2.5 rounded-full transition-all ${usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-orange-400' : 'bg-purple-500'}`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>
        <p className="text-xs text-gray-400">
          {data?.availableLicenses === 0
            ? 'Sem licenças disponíveis — contate o administrador.'
            : `${data?.availableLicenses} licença${(data?.availableLicenses ?? 0) !== 1 ? 's' : ''} disponível${(data?.availableLicenses ?? 0) !== 1 ? 'is' : ''} para novos clientes.`}
        </p>
      </div>
    </div>
  )
}
