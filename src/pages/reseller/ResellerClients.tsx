import { useState, useEffect, useMemo } from 'react'
import { Plus, UserCheck, UserX, Loader2, X, Pencil, Check, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { resellerService } from '../../services/resellerService'
import type { Client } from '../../services/resellerService'

const EMPTY_FORM = { name: '', responsible: '', email: '', password: '', phone: '', address: '', client_price: '' }

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

type SortKey = 'name' | 'owner_name' | 'email' | 'client_price' | 'active' | 'created_at'
type SortDir = 'asc' | 'desc'

function SortTh({ label, sortKey, current, dir, onSort, align = 'left' }: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir
  onSort: (k: SortKey) => void; align?: 'left' | 'center' | 'right'
}) {
  const active = current === sortKey
  return (
    <th
      className={`py-2 px-3 text-gray-500 font-medium cursor-pointer select-none hover:text-gray-800 transition-colors text-${align}`}
      onClick={() => onSort(sortKey)}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'center' ? 'justify-center w-full' : ''}`}>
        {label}
        {active
          ? dir === 'asc' ? <ChevronUp size={13} className="text-primary-600" /> : <ChevronDown size={13} className="text-primary-600" />
          : <ChevronsUpDown size={13} className="opacity-30" />}
      </span>
    </th>
  )
}

export default function ResellerClients() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [defaultPrice, setDefaultPrice] = useState<number | null>(null)

  // Ordenação
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  // Edição inline de preço por cliente
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [priceInput, setPriceInput] = useState('')
  const [savingPrice, setSavingPrice] = useState(false)

  const load = () => {
    setLoading(true)
    resellerService.listClients().then(setClients).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    resellerService.getSettings().then((s) => setDefaultPrice(s.resellerPrice))
  }, [])

  const baseFiltered = clients.filter((c) =>
    filter === 'all' ? true : filter === 'active' ? c.active : !c.active
  )

  const filtered = useMemo(() => {
    return [...baseFiltered].sort((a, b) => {
      let va: string | number, vb: string | number
      switch (sortKey) {
        case 'name':         va = a.name.toLowerCase();       vb = b.name.toLowerCase(); break
        case 'owner_name':   va = (a.owner_name ?? '').toLowerCase(); vb = (b.owner_name ?? '').toLowerCase(); break
        case 'email':        va = a.email.toLowerCase();      vb = b.email.toLowerCase(); break
        case 'client_price': va = a.client_price ?? -1;       vb = b.client_price ?? -1; break
        case 'active':       va = a.active ? 1 : 0;          vb = b.active ? 1 : 0; break
        case 'created_at':   va = a.created_at;               vb = b.created_at; break
        default:             va = a.name.toLowerCase();       vb = b.name.toLowerCase()
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [baseFiltered, sortKey, sortDir])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) { setError('Nome, e-mail e senha sao obrigatorios.'); return }
    setSaving(true)
    setError('')
    try {
      const cp = form.client_price.trim().replace(',', '.')
      const parsedPrice = cp === '' ? null : parseFloat(cp)
      await resellerService.createClient({
        name: form.name,
        owner_name: form.responsible,
        email: form.email,
        password: form.password,
        phone: form.phone,
        address: form.address || undefined,
        client_price: parsedPrice && !isNaN(parsedPrice) ? parsedPrice : null,
      })
      setShowModal(false)
      setForm(EMPTY_FORM)
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar cliente.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (c: Client) => {
    if (!confirm(`${c.active ? 'Desativar' : 'Ativar'} o cliente ${c.name}?`)) return
    await resellerService.toggleClientStatus(c.id, !c.active)
    load()
  }

  const startEditPrice = (c: Client) => {
    setEditingPriceId(c.id)
    setPriceInput(c.client_price != null ? String(c.client_price) : '')
  }

  const savePrice = async (clientId: string) => {
    const trimmed = priceInput.trim().replace(',', '.')
    const price = trimmed === '' ? null : parseFloat(trimmed)
    if (price !== null && (isNaN(price) || price < 0)) { setEditingPriceId(null); return }
    setSavingPrice(true)
    try {
      await resellerService.updateClientPrice(clientId, price)
      load()
    } finally {
      setSavingPrice(false)
      setEditingPriceId(null)
    }
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Meus Clientes</h1>
        <button onClick={() => { setForm(EMPTY_FORM); setError(''); setShowModal(true) }} className="btn-primary flex items-center gap-2">
          <Plus size={16} />Novo Cliente
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', 'active', 'inactive'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors ${filter === f ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {f === 'all' ? 'Todos' : f === 'active' ? <><UserCheck size={14} />Ativos</> : <><UserX size={14} />Cancelados</>}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 gap-2"><Loader2 size={20} className="animate-spin" />Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <SortTh label="Nome do Comercio" sortKey="name"         current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Responsavel"       sortKey="owner_name"  current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="E-mail"            sortKey="email"       current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Preco"             sortKey="client_price" current={sortKey} dir={sortDir} onSort={handleSort} align="center" />
                  <SortTh label="Status"            sortKey="active"      current={sortKey} dir={sortDir} onSort={handleSort} align="center" />
                  <SortTh label="Desde"             sortKey="created_at"  current={sortKey} dir={sortDir} onSort={handleSort} align="center" />
                  <th className="text-center py-2 px-3 text-gray-500 font-medium">Acoes</th>
                </tr>
              </thead>
              <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="text-center text-gray-400 py-8">Nenhum cliente encontrado.</td></tr>
                  ) : (
                    filtered.map((c) => (
                      <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 px-3 font-medium text-gray-800">{c.name}</td>
                        <td className="py-3 px-3 text-gray-600">{c.owner_name}</td>
                        <td className="py-3 px-3 text-gray-600">{c.email}</td>
                        <td className="py-3 px-3 text-center">
                          {editingPriceId === c.id ? (
                            <div className="flex items-center gap-1 justify-center">
                              <span className="text-gray-400 text-xs">R$</span>
                              <input
                                autoFocus
                                className="w-20 border border-gray-300 rounded px-1.5 py-0.5 text-xs text-center"
                                value={priceInput}
                                onChange={(e) => setPriceInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') savePrice(c.id); if (e.key === 'Escape') setEditingPriceId(null) }}
                                placeholder="0,00"
                              />
                              <button onClick={() => savePrice(c.id)} disabled={savingPrice} className="text-green-600 hover:text-green-800">
                                {savingPrice ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditPrice(c)}
                              className="flex items-center gap-1 mx-auto group"
                            >
                              {c.client_price != null ? (
                                <span className="text-gray-700 font-medium hover:text-indigo-600">{fmt(c.client_price)}</span>
                              ) : (
                                <span className="text-gray-400 italic text-xs hover:text-indigo-500">
                                  {defaultPrice != null ? `padrão (${fmt(defaultPrice)})` : 'padrão'}
                                </span>
                              )}
                              <Pencil size={11} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400" />
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={c.active ? 'badge-green' : 'badge-red'}>{c.active ? 'Ativo' : 'Inativo'}</span>
                        </td>
                        <td className="py-3 px-3 text-center text-gray-500">{fmtDate(c.created_at)}</td>
                        <td className="py-3 px-3 text-center">
                          <button onClick={() => handleToggle(c)} className={`text-xs font-medium ${c.active ? 'text-red-400 hover:text-red-600' : 'text-green-500 hover:text-green-700'}`}>
                            {c.active ? 'Desativar' : 'Ativar'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Novo Cliente</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Nome do Comercio *</label>
                  <input className="input" placeholder="ex: Bomboniere da Ana" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Responsavel</label>
                  <input className="input" value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} />
                </div>
                <div>
                  <label className="label">Telefone</label>
                  <input className="input" placeholder="(11) 99999-9999" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label className="label">E-mail de acesso *</label>
                  <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Senha de acesso *</label>
                  <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                </div>
                <div className="col-span-2">
                  <label className="label">Endereco</label>
                  <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="label">Preco personalizado (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input"
                    placeholder={defaultPrice != null ? `Deixe em branco para usar o padrao (${fmt(defaultPrice)})` : 'Deixe em branco para usar o padrao'}
                    value={form.client_price}
                    onChange={(e) => setForm({ ...form, client_price: e.target.value })}
                  />
                  <p className="text-xs text-gray-400 mt-1">Opcional. Define um preco diferente do seu padrao para este cliente.</p>
                </div>
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={saving}>
                  {saving ? <><Loader2 size={14} className="animate-spin" />Criando...</> : 'Criar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
