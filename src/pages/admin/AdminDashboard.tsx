import { useState, useEffect, useMemo } from 'react'
import { Users, UserCheck, TrendingUp, Loader2, Receipt, Store, ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { adminService } from '../../services/adminService'
import type { AdminStats } from '../../services/adminService'

type RevSortKey = 'name' | 'activeClients' | 'monthlyFee' | 'estimated'
type SortDir = 'asc' | 'desc'

function SortTh({
  label, sortKey, current, dir, onSort, align = 'left',
}: {
  label: string; sortKey: RevSortKey; current: RevSortKey; dir: SortDir
  onSort: (k: RevSortKey) => void; align?: 'left' | 'center' | 'right'
}) {
  const active = current === sortKey
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return (
    <th
      className={`py-2 px-3 text-gray-500 font-medium cursor-pointer select-none hover:text-gray-700 ${alignCls}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? (dir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />)
          : <ChevronsUpDown size={12} className="opacity-40" />}
      </span>
    </th>
  )
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAllRevenue, setShowAllRevenue] = useState(false)
  const [sortKey, setSortKey] = useState<RevSortKey>('estimated')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: RevSortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc') }
  }

  useEffect(() => {
    adminService.getStats().then(setStats).finally(() => setLoading(false))
  }, [])

  const revenue = stats?.revenueByReseller ?? []
  const SHOW_LIMIT = 5

  const sortedRevenue = useMemo(() => {
    return [...revenue].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'activeClients') cmp = a.activeClients - b.activeClients
      else if (sortKey === 'monthlyFee') cmp = a.monthlyFee - b.monthlyFee
      else cmp = a.estimated - b.estimated
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [revenue, sortKey, sortDir])

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-gray-400 gap-2"><Loader2 size={24} className="animate-spin" />Carregando...</div>
  }

  const cards = [
    { label: 'Gestores Ativos', value: stats?.activeResellers ?? 0, icon: UserCheck, color: 'bg-green-500' },
    { label: 'Total de Gestores', value: stats?.totalResellers ?? 0, icon: Users, color: 'bg-blue-500' },
    { label: 'Comercios Ativos', value: stats?.activeCommerces ?? 0, icon: TrendingUp, color: 'bg-emerald-500' },
    { label: 'Total de Comercios', value: stats?.totalCommerces ?? 0, icon: Store, color: 'bg-purple-500' },
  ]

  const taxaGestores = stats && stats.totalResellers > 0
    ? Math.round((stats.activeResellers / stats.totalResellers) * 100) : 0
  const taxaComercios = stats && stats.totalCommerces > 0
    ? Math.round((stats.activeCommerces / stats.totalCommerces) * 100) : 0

  const visibleRevenue = showAllRevenue ? sortedRevenue : sortedRevenue.slice(0, SHOW_LIMIT)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Painel Administrativo</h1>

      {/* Cards principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((s) => (
          <div key={s.label} className="card flex items-center gap-4">
            <div className={`${s.color} text-white p-3 rounded-xl shrink-0`}><s.icon size={22} /></div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Receita estimada geral */}
      <div className="card border-l-4 border-l-orange-400">
        <div className="flex items-center gap-2 mb-1">
          <Receipt size={18} className="text-orange-500" />
          <h2 className="font-semibold text-gray-700">Receita Estimada do Mês — Geral</h2>
        </div>
        <p className="text-3xl font-bold text-orange-500 mt-1">{fmt(stats?.estimatedMonthly ?? 0)}</p>
        <p className="text-xs text-gray-400 mt-1">
          Soma de: clientes ativos de cada gestor × mensalidade definida. Gestores sem mensalidade configurada não entram no cálculo.
        </p>
      </div>

      {/* Receita estimada por gestor */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Receipt size={18} className="text-orange-400" />
          <h2 className="font-semibold text-gray-700">Receita Estimada por Gestor</h2>
        </div>

        {revenue.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Nenhum gestor com mensalidade configurada.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <SortTh label="Gestor"           sortKey="name"          current={sortKey} dir={sortDir} onSort={handleSort} align="left" />
                    <SortTh label="Clientes Ativos"  sortKey="activeClients" current={sortKey} dir={sortDir} onSort={handleSort} align="center" />
                    <SortTh label="Mensalidade"      sortKey="monthlyFee"    current={sortKey} dir={sortDir} onSort={handleSort} align="center" />
                    <SortTh label="Receita Estimada" sortKey="estimated"     current={sortKey} dir={sortDir} onSort={handleSort} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {visibleRevenue.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-3 font-medium text-gray-800">{r.name}</td>
                      <td className="py-3 px-3 text-center text-gray-600">{r.activeClients}</td>
                      <td className="py-3 px-3 text-center">
                        {r.monthlyFee > 0
                          ? <span className="text-gray-700">{fmt(r.monthlyFee)}</span>
                          : <span className="text-gray-400 italic text-xs">não definida</span>}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {r.estimated > 0
                          ? <span className="font-semibold text-orange-500">{fmt(r.estimated)}</span>
                          : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {revenue.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-orange-50">
                      <td className="py-3 px-3 font-semibold text-gray-700" colSpan={3}>Total</td>
                      <td className="py-3 px-3 text-right font-bold text-orange-600">{fmt(stats?.estimatedMonthly ?? 0)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {revenue.length > SHOW_LIMIT && (
              <button
                onClick={() => setShowAllRevenue((v) => !v)}
                className="mt-3 flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium mx-auto"
              >
                {showAllRevenue
                  ? <><ChevronUp size={14} />Mostrar menos</>
                  : <><ChevronDown size={14} />Ver todos ({revenue.length} gestores)</>}
              </button>
            )}
          </>
        )}
      </div>

      {/* Visão geral */}
      <div className="card">
        <h2 className="font-semibold text-gray-700 mb-4">Visao Geral</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Taxa de ativacao de gestores</p>
            <p className="text-2xl font-bold text-gray-800">{taxaGestores}%</p>
            <p className="text-xs text-gray-400 mt-1">{stats?.activeResellers ?? 0} de {stats?.totalResellers ?? 0}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Taxa de ativacao de comercios</p>
            <p className="text-2xl font-bold text-gray-800">{taxaComercios}%</p>
            <p className="text-xs text-gray-400 mt-1">{stats?.activeCommerces ?? 0} de {stats?.totalCommerces ?? 0}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Media de clientes por gestor</p>
            <p className="text-2xl font-bold text-gray-800">
              {stats && stats.activeResellers > 0
                ? (stats.activeCommerces / stats.activeResellers).toFixed(1)
                : '0'}
            </p>
            <p className="text-xs text-gray-400 mt-1">clientes ativos / gestores ativos</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Receita media por gestor</p>
            <p className="text-2xl font-bold text-gray-800">
              {stats && stats.activeResellers > 0
                ? fmt((stats.estimatedMonthly ?? 0) / stats.activeResellers)
                : fmt(0)}
            </p>
            <p className="text-xs text-gray-400 mt-1">estimativa mensal</p>
          </div>
        </div>
      </div>
    </div>
  )
}
