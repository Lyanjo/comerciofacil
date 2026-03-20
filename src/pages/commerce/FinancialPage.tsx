import { useState, useEffect, useMemo } from 'react'
import { Plus, DollarSign, TrendingUp, TrendingDown, Loader2, X, Eye, EyeOff, ChevronDown, Tag } from 'lucide-react'
import type { FinancialTransaction, TransactionType } from '../../types'
import { financialService } from '../../services/financialService'

// ─── Categorias padrão ───────────────────────────────────────────────────────
const DEFAULT_INCOME_CATS: Record<string, string> = {
  sale: 'Venda',
  other_income: 'Outra Receita',
}
const DEFAULT_EXPENSE_CATS: Record<string, string> = {
  cleaning: 'Limpeza',
  maintenance: 'Manutenção',
  rent: 'Aluguel',
  salary: 'Salário',
  supplies: 'Suprimentos',
  utilities: 'Água/Luz/etc.',
  other_expense: 'Outra Despesa',
}

const CUSTOM_KEY = 'cf_custom_cats'

function loadCustomCats(): { income: Record<string, string>; expense: Record<string, string> } {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { income: {}, expense: {} }
}

function saveCustomCats(cats: { income: Record<string, string>; expense: Record<string, string> }) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(cats))
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const toMonthKey = (d: string) => { const dt = new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}` }
const monthLabel = (key: string) => { const [y, m] = key.split('-'); return `${MONTHS[Number(m) - 1]} ${y}` }

// ─── Componente ──────────────────────────────────────────────────────────────
export default function FinancialPage() {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showCatModal, setShowCatModal] = useState(false)
  const [filterType, setFilterType] = useState<TransactionType | 'all'>('all')
  const [filterMonth, setFilterMonth] = useState<string>('')
  const [expandedSaleGroups, setExpandedSaleGroups] = useState<Set<string>>(new Set())
  const [expandedSupplyGroups, setExpandedSupplyGroups] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [customCats, setCustomCats] = useState(loadCustomCats)
  const [newCatType, setNewCatType] = useState<TransactionType>('expense')
  const [newCatLabel, setNewCatLabel] = useState('')

  const allIncomeCats = useMemo(() => ({ ...DEFAULT_INCOME_CATS, ...customCats.income }), [customCats])
  const allExpenseCats = useMemo(() => ({ ...DEFAULT_EXPENSE_CATS, ...customCats.expense }), [customCats])
  const allCatLabels = useMemo(() => ({ ...allIncomeCats, ...allExpenseCats }), [allIncomeCats, allExpenseCats])

  const EMPTY_FORM = useMemo(() => ({
    type: 'expense' as TransactionType,
    category: Object.keys(allExpenseCats)[0] ?? 'other_expense',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
  }), [allExpenseCats])

  const [form, setForm] = useState(EMPTY_FORM)

  const load = () => {
    setLoading(true)
    financialService.list().then((data) => {
      setTransactions(data.transactions)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const availableMonths = useMemo(() => {
    const keys = Array.from(new Set(transactions.map((t) => toMonthKey(t.date))))
    return keys.sort((a, b) => b.localeCompare(a))
  }, [transactions])

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filterType !== 'all' && t.type !== filterType) return false
      if (filterMonth && toMonthKey(t.date) !== filterMonth) return false
      return true
    })
  }, [transactions, filterType, filterMonth])

  const summary = useMemo(() => {
    const base = filterMonth
      ? transactions.filter((t) => toMonthKey(t.date) === filterMonth)
      : transactions
    const income = base.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = base.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return { income, expense, balance: income - expense }
  }, [transactions, filterMonth])

  const displayItems = useMemo(() => {
    type DisplayItem =
      | { kind: 'tx'; tx: FinancialTransaction }
      | { kind: 'sale-group'; monthKey: string; total: number; sales: FinancialTransaction[] }
      | { kind: 'supply-group'; monthKey: string; total: number; items: FinancialTransaction[] }

    const saleGroupsAdded = new Set<string>()
    const supplyGroupsAdded = new Set<string>()
    const result: DisplayItem[] = []

    for (const t of filtered) {
      if (t.type === 'income' && t.category === 'sale') {
        const mk = toMonthKey(t.date)
        if (!saleGroupsAdded.has(mk)) {
          saleGroupsAdded.add(mk)
          const salesOfMonth = filtered.filter(
            (x) => x.type === 'income' && x.category === 'sale' && toMonthKey(x.date) === mk
          )
          result.push({ kind: 'sale-group', monthKey: mk, total: salesOfMonth.reduce((s, x) => s + x.amount, 0), sales: salesOfMonth })
        }
      } else if (t.type === 'expense' && t.category === 'supplies') {
        const mk = toMonthKey(t.date)
        if (!supplyGroupsAdded.has(mk)) {
          supplyGroupsAdded.add(mk)
          const itemsOfMonth = filtered.filter(
            (x) => x.type === 'expense' && x.category === 'supplies' && toMonthKey(x.date) === mk
          )
          result.push({ kind: 'supply-group', monthKey: mk, total: itemsOfMonth.reduce((s, x) => s + x.amount, 0), items: itemsOfMonth })
        }
      } else {
        result.push({ kind: 'tx', tx: t })
      }
    }
    return result
  }, [filtered])

  const openModal = () => { setForm(EMPTY_FORM); setError(''); setShowModal(true) }

  const handleTypeChange = (type: TransactionType) => {
    const cats = type === 'income' ? allIncomeCats : allExpenseCats
    setForm({ ...form, type, category: Object.keys(cats)[0] ?? '' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.description || !form.amount) { setError('Descrição e valor são obrigatórios.'); return }
    setSaving(true); setError('')
    try {
      await financialService.create({
        type: form.type,
        category: form.category,
        description: form.description,
        amount: parseFloat(form.amount),
        date: new Date(form.date + 'T12:00:00').toISOString(),
      })
      setShowModal(false)
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar lançamento.')
    } finally {
      setSaving(false)
    }
  }

  const handleAddCategory = () => {
    if (!newCatLabel.trim()) return
    const key = newCatLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now()
    const updated = { ...customCats, [newCatType]: { ...customCats[newCatType], [key]: newCatLabel.trim() } }
    setCustomCats(updated)
    saveCustomCats(updated)
    setNewCatLabel('')
  }

  const handleRemoveCustomCat = (type: TransactionType, key: string) => {
    const updated = {
      ...customCats,
      [type]: Object.fromEntries(Object.entries(customCats[type]).filter(([k]) => k !== key)),
    }
    setCustomCats(updated)
    saveCustomCats(updated)
  }

  const toggleSaleGroup = (mk: string) => {
    setExpandedSaleGroups((prev) => {
      const next = new Set(prev)
      next.has(mk) ? next.delete(mk) : next.add(mk)
      return next
    })
  }

  const toggleSupplyGroup = (mk: string) => {
    setExpandedSupplyGroups((prev) => {
      const next = new Set(prev)
      next.has(mk) ? next.delete(mk) : next.add(mk)
      return next
    })
  }

  const formCats = form.type === 'income'
    ? Object.entries(allIncomeCats).sort(([, a], [, b]) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
    : Object.entries(allExpenseCats).sort(([, a], [, b]) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <DollarSign size={24} className="text-emerald-600" />Financeiro
        </h1>
        <div className="flex gap-2">
          <button onClick={() => setShowCatModal(true)} className="btn-secondary flex items-center gap-2 text-sm">
            <Tag size={15} />Categorias
          </button>
          <button onClick={openModal} className="btn-primary flex items-center gap-2">
            <Plus size={16} />Lançamento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div className="card border-l-4 border-l-green-500">
          <div className="flex items-center gap-3">
            <TrendingUp size={20} className="text-green-500" />
            <div>
              <p className="text-xs text-gray-500">Receitas{filterMonth ? ` — ${monthLabel(filterMonth)}` : ''}</p>
              <p className="text-xl font-bold text-green-600">{fmt(summary.income)}</p>
            </div>
          </div>
        </div>
        <div className="card border-l-4 border-l-red-500">
          <div className="flex items-center gap-3">
            <TrendingDown size={20} className="text-red-500" />
            <div>
              <p className="text-xs text-gray-500">Despesas{filterMonth ? ` — ${monthLabel(filterMonth)}` : ''}</p>
              <p className="text-xl font-bold text-red-600">{fmt(summary.expense)}</p>
            </div>
          </div>
        </div>
        <div className={`card border-l-4 ${summary.balance >= 0 ? 'border-l-blue-500' : 'border-l-orange-500'}`}>
          <div className="flex items-center gap-3">
            <DollarSign size={20} className={summary.balance >= 0 ? 'text-blue-500' : 'text-orange-500'} />
            <div>
              <p className="text-xs text-gray-500">Saldo{filterMonth ? ` — ${monthLabel(filterMonth)}` : ''}</p>
              <p className={`text-xl font-bold ${summary.balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{fmt(summary.balance)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {(['all', 'income', 'expense'] as const).map((f) => (
          <button key={f} onClick={() => setFilterType(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterType === f ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {f === 'all' ? 'Todos' : f === 'income' ? 'Receitas' : 'Despesas'}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
          <ChevronDown size={14} className="text-gray-400" />
          <select
            className="bg-transparent outline-none text-sm text-gray-700 cursor-pointer"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
          >
            <option value="">Todos os meses</option>
            {availableMonths.map((mk) => (
              <option key={mk} value={mk}>{monthLabel(mk)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
            <Loader2 size={20} className="animate-spin" />Carregando...
          </div>
        ) : displayItems.length === 0 ? (
          <p className="text-center text-gray-400 py-8">Nenhum lançamento encontrado.</p>
        ) : (
          <div className="space-y-1">
            {displayItems.map((item, idx) => {
              if (item.kind === 'sale-group') {
                const expanded = expandedSaleGroups.has(item.monthKey)
                return (
                  <div key={`sg-${item.monthKey}`}>
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-green-50 text-green-600">
                          <TrendingUp size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            Vendas — {monthLabel(item.monthKey)}
                            <span className="ml-2 text-xs font-normal text-gray-400">
                              ({item.sales.length} venda{item.sales.length !== 1 ? 's' : ''})
                            </span>
                          </p>
                          <p className="text-xs text-gray-400">Venda • agrupado</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm text-green-600">+{fmt(item.total)}</span>
                        <button
                          onClick={() => toggleSaleGroup(item.monthKey)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                          title={expanded ? 'Ocultar vendas' : 'Ver vendas'}
                        >
                          {expanded ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    {expanded && (
                      <div className="bg-gray-50 rounded-b-lg mb-1 border border-t-0 border-gray-100">
                        {item.sales.map((sale) => (
                          <div key={sale.id} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-0">
                            <div className="flex items-center gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-400 ml-4" />
                              <div>
                                <p className="text-sm text-gray-700">{sale.description}</p>
                                <p className="text-xs text-gray-400">{fmtDate(sale.date)}</p>
                              </div>
                            </div>
                            <span className="text-sm font-medium text-green-600">+{fmt(sale.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }
              if (item.kind === 'supply-group') {
                const expanded = expandedSupplyGroups.has(item.monthKey)
                return (
                  <div key={`sup-${item.monthKey}`}>
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-orange-50 text-orange-600">
                          <TrendingDown size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            Compras — {monthLabel(item.monthKey)}
                            <span className="ml-2 text-xs font-normal text-gray-400">
                              ({item.items.length} compra{item.items.length !== 1 ? 's' : ''})
                            </span>
                          </p>
                          <p className="text-xs text-gray-400">Suprimentos • agrupado</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm text-red-600">-{fmt(item.total)}</span>
                        <button
                          onClick={() => toggleSupplyGroup(item.monthKey)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                          title={expanded ? 'Ocultar compras' : 'Ver compras'}
                        >
                          {expanded ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    {expanded && (
                      <div className="bg-gray-50 rounded-b-lg mb-1 border border-t-0 border-gray-100">
                        {item.items.map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-0">
                            <div className="flex items-center gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-orange-400 ml-4" />
                              <div>
                                <p className="text-sm text-gray-700">{entry.description}</p>
                                <p className="text-xs text-gray-400">{fmtDate(entry.date)}</p>
                              </div>
                            </div>
                            <span className="text-sm font-medium text-red-600">-{fmt(entry.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }
              // item.kind === 'tx'
              const t = item.tx
              return (
                <div key={t.id + idx} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${t.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      {t.type === 'income' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{t.description}</p>
                      <p className="text-xs text-gray-400">{allCatLabels[t.category] || t.category} — {fmtDate(t.date)}</p>
                    </div>
                  </div>
                  <span className={`font-bold text-sm ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal: Novo lançamento */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Novo Lançamento</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => handleTypeChange('income')}
                    className={`py-2 rounded-lg text-sm font-medium transition-colors ${form.type === 'income' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    Receita
                  </button>
                  <button type="button" onClick={() => handleTypeChange('expense')}
                    className={`py-2 rounded-lg text-sm font-medium transition-colors ${form.type === 'expense' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    Despesa
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Categoria</label>
                <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {formCats.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Descrição *</label>
                <input className="input" placeholder="ex: Compra de mercadoria" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Valor (R$) *</label>
                  <input type="number" className="input" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Data</label>
                  <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={saving}>
                  {saving ? <><Loader2 size={14} className="animate-spin" />Salvando...</> : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Gerenciar categorias */}
      {showCatModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Tag size={18} />Categorias</h2>
              <button onClick={() => setShowCatModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">Nova categoria</p>
                <div className="flex gap-2 mb-2">
                  <button type="button" onClick={() => setNewCatType('income')}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${newCatType === 'income' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    Receita
                  </button>
                  <button type="button" onClick={() => setNewCatType('expense')}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${newCatType === 'expense' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    Despesa
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Nome da categoria"
                    value={newCatLabel}
                    onChange={(e) => setNewCatLabel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                  />
                  <button type="button" onClick={handleAddCategory} className="btn-primary px-4">Adicionar</button>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-green-700 mb-2">Categorias de Receita</p>
                <div className="space-y-1">
                  {Object.entries(allIncomeCats)
                    .sort(([, a], [, b]) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
                    .map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between px-3 py-2 rounded-lg bg-green-50">
                        <span className="text-sm text-gray-700">{label}</span>
                        {customCats.income[key] && (
                          <button onClick={() => handleRemoveCustomCat('income', key)}
                            className="text-gray-400 hover:text-red-500 transition-colors" title="Remover">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-red-700 mb-2">Categorias de Despesa</p>
                <div className="space-y-1">
                  {Object.entries(allExpenseCats)
                    .sort(([, a], [, b]) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
                    .map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between px-3 py-2 rounded-lg bg-red-50">
                        <span className="text-sm text-gray-700">{label}</span>
                        {customCats.expense[key] && (
                          <button onClick={() => handleRemoveCustomCat('expense', key)}
                            className="text-gray-400 hover:text-red-500 transition-colors" title="Remover">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100">
              <button onClick={() => setShowCatModal(false)} className="btn-secondary w-full">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
