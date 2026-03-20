import { useState, useEffect, useMemo } from 'react'
import { Key, UserCheck, UserX, Plus, Loader2, X, Pencil, Check, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { adminService } from '../../services/adminService'
import type { Reseller } from '../../services/adminService'

const EMPTY_FORM = { name: '', email: '', password: '', total_licenses: '5' }
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

type SortKey = 'name' | 'email' | 'total_licenses' | 'used_licenses' | 'monthly_fee' | 'active' | 'created_at'
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

export default function AdminResellers() {
  const [resellers, setResellers] = useState<Reseller[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Ordenação
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = useMemo(() => {
    return [...resellers].sort((a, b) => {
      let va: string | number, vb: string | number
      switch (sortKey) {
        case 'name':          va = a.name.toLowerCase();       vb = b.name.toLowerCase(); break
        case 'email':         va = a.email.toLowerCase();      vb = b.email.toLowerCase(); break
        case 'total_licenses': va = a.total_licenses;           vb = b.total_licenses; break
        case 'used_licenses': va = a.used_licenses;            vb = b.used_licenses; break
        case 'monthly_fee':   va = a.monthly_fee;              vb = b.monthly_fee; break
        case 'active':        va = a.active ? 1 : 0;          vb = b.active ? 1 : 0; break
        case 'created_at':    va = a.created_at;               vb = b.created_at; break
        default:              va = a.name.toLowerCase();       vb = b.name.toLowerCase()
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [resellers, sortKey, sortDir])

  // Edição inline de mensalidade
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null)
  const [feeInput, setFeeInput] = useState('')
  const [savingFee, setSavingFee] = useState(false)

  // Edição inline de licenças
  const [editingLicId, setEditingLicId] = useState<string | null>(null)
  const [licInput, setLicInput] = useState('')
  const [savingLic, setSavingLic] = useState(false)

  const load = () => {
    setLoading(true)
    adminService.listResellers().then(setResellers).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const active = resellers.filter((r) => r.active).length
  const inactive = resellers.length - active
  const totalLic = resellers.reduce((s, r) => s + r.total_licenses, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) { setError('Nome, e-mail e senha sao obrigatorios.'); return }
    setSaving(true)
    setError('')
    try {
      await adminService.createReseller({
        name: form.name,
        email: form.email,
        password: form.password,
        total_licenses: parseInt(form.total_licenses) || 5,
      })
      setShowModal(false)
      setForm(EMPTY_FORM)
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar gestor.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (r: Reseller) => {
    if (!confirm(`${r.active ? 'Desativar' : 'Ativar'} o gestor ${r.name}?`)) return
    await adminService.toggleResellerStatus(r.id, !r.active)
    load()
  }

  const startEditFee = (r: Reseller) => {
    setEditingFeeId(r.id)
    setFeeInput(r.monthly_fee > 0 ? String(r.monthly_fee) : '')
  }

  const saveFee = async (resellerId: string) => {
    const parsed = parseFloat(feeInput.replace(',', '.'))
    if (isNaN(parsed) || parsed < 0) { setEditingFeeId(null); return }
    setSavingFee(true)
    try {
      await adminService.updateMonthlyFee(resellerId, parsed)
      load()
    } finally {
      setSavingFee(false)
      setEditingFeeId(null)
    }
  }

  const startEditLic = (r: Reseller) => {
    setEditingLicId(r.id)
    setLicInput(String(r.total_licenses))
  }

  const saveLic = async (resellerId: string) => {
    const parsed = parseInt(licInput)
    if (isNaN(parsed) || parsed < 1) { setEditingLicId(null); return }
    setSavingLic(true)
    try {
      await adminService.updateLicenses(resellerId, parsed)
      load()
    } finally {
      setSavingLic(false)
      setEditingLicId(null)
    }
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Gestores</h1>
        <button onClick={() => { setForm(EMPTY_FORM); setError(''); setShowModal(true) }} className="btn-primary flex items-center gap-2">
          <Plus size={16} />Novo Gestor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card flex items-center gap-4">
          <div className="bg-green-500 text-white p-3 rounded-xl"><UserCheck size={22} /></div>
          <div><p className="text-2xl font-bold text-gray-800">{active}</p><p className="text-xs text-gray-500">Gestores Ativos</p></div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="bg-red-500 text-white p-3 rounded-xl"><UserX size={22} /></div>
          <div><p className="text-2xl font-bold text-gray-800">{inactive}</p><p className="text-xs text-gray-500">Gestores Inativos</p></div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="bg-purple-500 text-white p-3 rounded-xl"><Key size={22} /></div>
          <div><p className="text-2xl font-bold text-gray-800">{totalLic}</p><p className="text-xs text-gray-500">Total de Licencas</p></div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-gray-700 mb-4">Lista de Gestores</h2>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-400 gap-2"><Loader2 size={20} className="animate-spin" />Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <SortTh label="Nome"        sortKey="name"           current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="E-mail"      sortKey="email"          current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Licencas"    sortKey="total_licenses" current={sortKey} dir={sortDir} onSort={handleSort} align="center" />
                  <SortTh label="Em uso"      sortKey="used_licenses"  current={sortKey} dir={sortDir} onSort={handleSort} align="center" />
                  <SortTh label="Mensalidade" sortKey="monthly_fee"    current={sortKey} dir={sortDir} onSort={handleSort} align="center" />
                  <SortTh label="Status"      sortKey="active"         current={sortKey} dir={sortDir} onSort={handleSort} align="center" />
                  <SortTh label="Desde"       sortKey="created_at"     current={sortKey} dir={sortDir} onSort={handleSort} align="center" />
                  <th className="text-center py-2 px-3 text-gray-500 font-medium">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr><td colSpan={8} className="text-center text-gray-400 py-8">Nenhum gestor cadastrado.</td></tr>
                ) : (
                  sorted.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-3 font-medium text-gray-800">{r.name}</td>
                      <td className="py-3 px-3 text-gray-600">{r.email}</td>
                      <td className="py-3 px-3 text-center">
                        {editingLicId === r.id ? (
                          <div className="flex items-center gap-1 justify-center">
                            <input
                              autoFocus
                              type="number"
                              min="1"
                              className="w-16 border border-gray-300 rounded px-1.5 py-0.5 text-xs text-center"
                              value={licInput}
                              onChange={(e) => setLicInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveLic(r.id); if (e.key === 'Escape') setEditingLicId(null) }}
                            />
                            <button onClick={() => saveLic(r.id)} disabled={savingLic} className="text-green-600 hover:text-green-800">
                              {savingLic ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditLic(r)}
                            className="flex items-center gap-1 mx-auto text-gray-700 font-semibold hover:text-indigo-600 group"
                          >
                            <span>{r.total_licenses}</span>
                            <Pencil size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`font-semibold ${r.used_licenses >= r.total_licenses ? 'text-red-600' : 'text-green-600'}`}>{r.used_licenses}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {editingFeeId === r.id ? (
                          <div className="flex items-center gap-1 justify-center">
                            <span className="text-gray-400 text-xs">R$</span>
                            <input
                              autoFocus
                              className="w-20 border border-gray-300 rounded px-1.5 py-0.5 text-xs text-center"
                              value={feeInput}
                              onChange={(e) => setFeeInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveFee(r.id); if (e.key === 'Escape') setEditingFeeId(null) }}
                              placeholder="0,00"
                            />
                            <button onClick={() => saveFee(r.id)} disabled={savingFee} className="text-green-600 hover:text-green-800">
                              {savingFee ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditFee(r)}
                            className="flex items-center gap-1 mx-auto text-gray-600 hover:text-indigo-600 group"
                          >
                            <span className="font-medium">{r.monthly_fee > 0 ? fmt(r.monthly_fee) : <span className="text-gray-300 italic text-xs">definir</span>}</span>
                            <Pencil size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={r.active ? 'badge-green' : 'badge-red'}>{r.active ? 'Ativo' : 'Inativo'}</span>
                      </td>
                      <td className="py-3 px-3 text-center text-gray-500">{fmtDate(r.created_at)}</td>
                      <td className="py-3 px-3 text-center">
                        <button onClick={() => handleToggle(r)} className={`text-xs font-medium ${r.active ? 'text-red-400 hover:text-red-600' : 'text-green-500 hover:text-green-700'}`}>
                          {r.active ? 'Desativar' : 'Ativar'}
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Novo Gestor</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Nome *</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="label">E-mail de acesso *</label>
                <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <label className="label">Senha *</label>
                <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>
              <div>
                <label className="label">Total de Licencas</label>
                <input type="number" className="input" min="1" value={form.total_licenses} onChange={(e) => setForm({ ...form, total_licenses: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">Numero de comercios que este gestor pode cadastrar.</p>
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={saving}>
                  {saving ? <><Loader2 size={14} className="animate-spin" />Criando...</> : 'Criar Gestor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

