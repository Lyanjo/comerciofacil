import { useState, useEffect, useMemo } from 'react'
import { History, ShoppingBag, Loader2, SlidersHorizontal, X, ChevronUp, ChevronDown, ChevronsUpDown, XCircle, Download } from 'lucide-react'
import { saleService } from '../../services/saleService'
import type { SaleWithItems } from '../../services/saleService'

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Dinheiro', debit: 'Débito', credit: 'Crédito', pix: 'PIX', other: 'Outro',
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const toInputDate = (d: string) => d ? new Date(d).toISOString().slice(0, 10) : ''

type SortKey = 'date' | 'total' | 'payment'
type SortDir = 'asc' | 'desc'

const EMPTY_FILTERS = { dateFrom: '', dateTo: '', minValue: '', maxValue: '', payment: '' }

function SortBtn({ label, sk, current, dir, onSort }: {
  label: string; sk: SortKey; current: SortKey; dir: SortDir; onSort: (k: SortKey) => void
}) {
  const active = current === sk
  return (
    <button
      onClick={() => onSort(sk)}
      className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors
        ${active ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}
    >
      {label}
      {active
        ? dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
        : <ChevronsUpDown size={12} className="opacity-40" />}
    </button>
  )
}

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<SaleWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [cancelingId, setCancelingId] = useState<string | null>(null)

  useEffect(() => {
    saleService.list().then(setSales).finally(() => setLoading(false))
  }, [])

  const reload = () => saleService.list().then(setSales)

  const handleCancel = async (saleId: string) => {
    if (!confirm('Cancelar esta venda? O estoque será estornado e o lançamento financeiro removido.')) return
    setCancelingId(saleId)
    try {
      await saleService.cancel(saleId)
      await reload()
    } catch {
      alert('Erro ao cancelar a venda.')
    } finally {
      setCancelingId(null)
    }
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(key === 'date' ? 'desc' : 'asc') }
  }

  const setFilter = (k: keyof typeof EMPTY_FILTERS, v: string) =>
    setFilters((f) => ({ ...f, [k]: v }))

  const hasActiveFilters = Object.values(filters).some((v) => v !== '')

  // ─── Exportar CSV ──────────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows: string[][] = []
    const header = [
      'ID Venda', 'Data', 'Status', 'Forma de Pagamento',
      'Subtotal (R$)', 'Desconto (R$)', 'Total (R$)',
      'Produtos (qtd x nome x preço unit.)',
    ]
    rows.push(header)

    for (const sale of processed) {
      const itemsStr = (sale.items ?? [])
        .map((i) => `${i.quantity}x ${i.productName} @ R$${Number(i.unitPrice).toFixed(2)}`)
        .join(' | ')
      rows.push([
        String(sale.id).slice(0, 8).toUpperCase(),
        new Date(sale.createdAt).toLocaleString('pt-BR'),
        sale.status === 'canceled' ? 'Cancelada' : 'Concluída',
        PAYMENT_LABELS[sale.paymentMethod] || sale.paymentMethod,
        Number(sale.subtotal ?? sale.total).toFixed(2),
        Number(sale.discount ?? 0).toFixed(2),
        Number(sale.total).toFixed(2),
        itemsStr,
      ])
    }

    const csvContent = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n')

    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const dateTag = new Date().toISOString().slice(0, 10)
    a.download = `historico-vendas-${dateTag}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const activePayments = useMemo(() => {
    const set = new Set(sales.map((s) => s.paymentMethod))
    return Array.from(set)
  }, [sales])

  const processed = useMemo(() => {
    let result = [...sales]

    // Filtro: data inicial
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom + 'T00:00:00')
      result = result.filter((s) => new Date(s.createdAt) >= from)
    }
    // Filtro: data final
    if (filters.dateTo) {
      const to = new Date(filters.dateTo + 'T23:59:59')
      result = result.filter((s) => new Date(s.createdAt) <= to)
    }
    // Filtro: valor mínimo
    if (filters.minValue !== '') {
      const min = parseFloat(filters.minValue.replace(',', '.'))
      if (!isNaN(min)) result = result.filter((s) => s.total >= min)
    }
    // Filtro: valor máximo
    if (filters.maxValue !== '') {
      const max = parseFloat(filters.maxValue.replace(',', '.'))
      if (!isNaN(max)) result = result.filter((s) => s.total <= max)
    }
    // Filtro: forma de pagamento
    if (filters.payment) {
      result = result.filter((s) => s.paymentMethod === filters.payment)
    }

    // Ordenação
    result.sort((a, b) => {
      let va: number | string, vb: number | string
      if (sortKey === 'date')    { va = a.createdAt; vb = b.createdAt }
      else if (sortKey === 'total')   { va = a.total; vb = b.total }
      else                            { va = a.paymentMethod; vb = b.paymentMethod }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [sales, filters, sortKey, sortDir])

  // Totalizadores do resultado filtrado
  const totalFiltered = processed.reduce((s, v) => s + v.total, 0)

  return (
    <div>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <History size={24} className="text-emerald-600" />Histórico de Vendas
        </h1>
        <div className="flex items-center gap-2">
          {processed.length > 0 && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              title="Exportar resultado atual como CSV"
            >
              <Download size={15} />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>
          )}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors
              ${showFilters || hasActiveFilters
                ? 'bg-primary-50 border-primary-300 text-primary-700'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <SlidersHorizontal size={15} />
            Filtros
            {hasActiveFilters && (
              <span className="bg-primary-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {Object.values(filters).filter((v) => v !== '').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Painel de filtros */}
      {showFilters && (
        <div className="card mb-4 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">Filtrar vendas</span>
            {hasActiveFilters && (
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
              >
                <X size={12} />Limpar filtros
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Data inicial */}
            <div>
              <label className="label">Data inicial</label>
              <input
                type="date"
                className="input text-sm"
                value={filters.dateFrom}
                max={filters.dateTo || toInputDate(new Date().toISOString())}
                onChange={(e) => setFilter('dateFrom', e.target.value)}
              />
            </div>
            {/* Data final */}
            <div>
              <label className="label">Data final</label>
              <input
                type="date"
                className="input text-sm"
                value={filters.dateTo}
                min={filters.dateFrom || undefined}
                onChange={(e) => setFilter('dateTo', e.target.value)}
              />
            </div>
            {/* Valor mínimo */}
            <div>
              <label className="label">Valor mínimo (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                className="input text-sm"
                value={filters.minValue}
                onChange={(e) => setFilter('minValue', e.target.value)}
              />
            </div>
            {/* Valor máximo */}
            <div>
              <label className="label">Valor máximo (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                className="input text-sm"
                value={filters.maxValue}
                onChange={(e) => setFilter('maxValue', e.target.value)}
              />
            </div>
          </div>
          {/* Pagamento */}
          {activePayments.length > 0 && (
            <div className="mt-3">
              <label className="label">Forma de pagamento</label>
              <div className="flex gap-2 flex-wrap mt-1">
                <button
                  onClick={() => setFilter('payment', '')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                    ${filters.payment === '' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  Todos
                </button>
                {activePayments.map((p) => (
                  <button
                    key={p}
                    onClick={() => setFilter('payment', p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                      ${filters.payment === p ? 'bg-primary-600 text-white border-primary-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {PAYMENT_LABELS[p] || p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Barra de ordenação + resumo */}
      {!loading && sales.length > 0 && (
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 mr-1">Ordenar por:</span>
            <SortBtn label="Data"       sk="date"    current={sortKey} dir={sortDir} onSort={handleSort} />
            <SortBtn label="Valor"      sk="total"   current={sortKey} dir={sortDir} onSort={handleSort} />
            <SortBtn label="Pagamento"  sk="payment" current={sortKey} dir={sortDir} onSort={handleSort} />
          </div>
          <div className="text-xs text-gray-500">
            <span className="font-medium text-gray-700">{processed.length}</span> venda{processed.length !== 1 ? 's' : ''}
            {hasActiveFilters && <span className="text-gray-400"> (filtradas)</span>}
            {' · '}
            <span className="font-semibold text-emerald-600">{fmt(totalFiltered)}</span>
          </div>
        </div>
      )}

      {/* Conteúdo */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
          <Loader2 size={20} className="animate-spin" />Carregando...
        </div>
      ) : sales.length === 0 ? (
        <div className="card text-center py-10 text-gray-400">
          <ShoppingBag size={40} className="mx-auto mb-2" />
          <p>Nenhuma venda registrada.</p>
        </div>
      ) : processed.length === 0 ? (
        <div className="card text-center py-10 text-gray-400">
          <SlidersHorizontal size={36} className="mx-auto mb-2 opacity-40" />
          <p className="font-medium">Nenhuma venda encontrada com estes filtros.</p>
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="mt-3 text-sm text-primary-600 hover:text-primary-800 font-medium"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {processed.map((sale) => (
            <div key={sale.id} className={`card ${sale.status === 'canceled' ? 'opacity-60 bg-gray-50' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-800 flex items-center gap-2">
                    Venda #{String(sale.id).slice(0, 8).toUpperCase()}
                    {sale.status === 'canceled' && (
                      <span className="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full font-normal">Cancelada</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">{fmtDate(sale.createdAt)}</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="text-right">
                    <p className={`text-lg font-bold ${sale.status === 'canceled' ? 'line-through text-gray-400' : 'text-emerald-600'}`}>{fmt(sale.total)}</p>
                    <span className="badge-blue">{PAYMENT_LABELS[sale.paymentMethod] || sale.paymentMethod}</span>
                  </div>
                  {sale.status !== 'canceled' && (
                    <button
                      onClick={() => handleCancel(sale.id)}
                      disabled={cancelingId === sale.id}
                      title="Cancelar venda"
                      className="mt-0.5 p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {cancelingId === sale.id
                        ? <Loader2 size={16} className="animate-spin" />
                        : <XCircle size={16} />}
                    </button>
                  )}
                </div>
              </div>
              <div className="border-t border-gray-50 pt-2 space-y-1">
                {sale.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm text-gray-600">
                    <span>{item.quantity}x {item.productName}</span>
                    <span>{fmt(item.totalPrice)}</span>
                  </div>
                ))}
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between text-sm text-gray-400 mt-1 border-t pt-1">
                  <span>Desconto</span><span>-{fmt(sale.discount)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
