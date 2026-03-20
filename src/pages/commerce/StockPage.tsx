import { useState, useEffect } from 'react'
import { Plus, Search, Package, AlertTriangle, Loader2, X, ShoppingBag, SlidersHorizontal, Pencil, ShieldOff, ShieldCheck } from 'lucide-react'
import type { Product, ProductUnit } from '../../types'
import { productService } from '../../services/productService'
import { financialService } from '../../services/financialService'

const UNIT_LABELS: Record<ProductUnit, string> = {
  un: 'Unidade', kg: 'Kg', g: 'Gramas', l: 'Litros', ml: 'mL', cx: 'Caixa', pct: 'Pacote',
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const EMPTY_FORM = { name: '', category: '', barcode: '', costPrice: '', salePrice: '', unit: 'un' as ProductUnit, stock: '', minStock: '' }

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // autocomplete de categoria
  const [catSuggestions, setCatSuggestions] = useState<string[]>([])
  const [showCatDropdown, setShowCatDropdown] = useState(false)

  // Modal abastecimento (entrada de compra)
  const [supplyProduct, setSupplyProduct] = useState<Product | null>(null)
  const [supplyQty, setSupplyQty] = useState('')
  const [supplyCost, setSupplyCost] = useState('')
  const [supplyNote, setSupplyNote] = useState('')
  const [supplySaving, setSupplySaving] = useState(false)
  const [supplyError, setSupplyError] = useState('')

  // Modal ajuste de estoque (conferência)
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null)
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustSaving, setAdjustSaving] = useState(false)
  const [adjustError, setAdjustError] = useState('')

  const load = () => {
    setLoading(true)
    productService.list().then(setProducts).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // Categorias únicas já cadastradas para o autocomplete — ordem alfabética sem acento
  const allCategories = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean) as string[])
  ).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))

  // Filtra sugestões conforme o que o usuário digita
  const handleCategoryInput = (value: string) => {
    setForm({ ...form, category: value })
    if (value.trim().length > 0) {
      const matches = allCategories.filter((c) =>
        c.toLowerCase().includes(value.toLowerCase())
      )
      setCatSuggestions(matches)
      setShowCatDropdown(matches.length > 0)
    } else {
      setCatSuggestions([])
      setShowCatDropdown(false)
    }
  }

  const selectCategory = (cat: string) => {
    setForm({ ...form, category: cat })
    setCatSuggestions([])
    setShowCatDropdown(false)
  }

  const filtered = products
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
  const lowStock = products.filter((p) => p.minStock != null && p.stock <= p.minStock)

  const openNew = () => { setEditProduct(null); setForm(EMPTY_FORM); setError(''); setShowModal(true) }
  const openEdit = (p: Product) => {
    setEditProduct(p)
    setForm({
      name: p.name, category: p.category || '', barcode: p.barcode || '',
      costPrice: p.costPrice?.toString() || '', salePrice: p.salePrice.toString(),
      unit: p.unit, stock: p.stock.toString(), minStock: p.minStock?.toString() || '',
    })
    setError('')
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.name || !form.salePrice) { setError('Nome e preço de venda são obrigatórios.'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        category: form.category || undefined,
        barcode: form.barcode || undefined,
        costPrice: form.costPrice ? parseFloat(form.costPrice) : undefined,
        salePrice: parseFloat(form.salePrice),
        unit: form.unit,
        stock: parseInt(form.stock || '0'),
        minStock: form.minStock ? parseInt(form.minStock) : undefined,
      }
      if (editProduct) {
        await productService.update(editProduct.id, payload)
      } else {
        await productService.create(payload)
      }
      setShowModal(false)
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar produto.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (id: string) => {
    if (!confirm('Desativar este produto?')) return
    await productService.deactivate(id)
    load()
  }

  const handleActivate = async (id: string) => {
    if (!confirm('Ativar este produto?')) return
    await productService.update(id, { isActive: true })
    load()
  }

  // ── Abastecimento ────────────────────────────────────────────────────────
  const openSupply = (p: Product) => {
    setSupplyProduct(p)
    setSupplyQty('')
    setSupplyCost(p.costPrice?.toString() || '')
    setSupplyNote(`Compra: ${p.name}`)
    setSupplyError('')
  }

  const handleSupplySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supplyProduct) return
    const qty = parseInt(supplyQty)
    if (!qty || qty <= 0) { setSupplyError('Informe uma quantidade válida.'); return }
    setSupplySaving(true); setSupplyError('')
    try {
      // Atualiza estoque somando a quantidade
      await productService.update(supplyProduct.id, { stock: supplyProduct.stock + qty })
      // Se informou custo, lança no financeiro como despesa
      const totalCost = supplyCost ? parseFloat(supplyCost) * qty : 0
      if (totalCost > 0) {
        await financialService.create({
          type: 'expense',
          category: 'supplies',
          description: supplyNote || `Compra: ${supplyProduct.name}`,
          amount: totalCost,
          date: new Date().toISOString(),
        })
      }
      setSupplyProduct(null)
      load()
    } catch {
      setSupplyError('Erro ao registrar abastecimento.')
    } finally {
      setSupplySaving(false)
    }
  }

  // ── Ajuste de estoque ────────────────────────────────────────────────────
  const openAdjust = (p: Product) => {
    setAdjustProduct(p)
    setAdjustQty(p.stock.toString())
    setAdjustReason('')
    setAdjustError('')
  }

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adjustProduct) return
    const newQty = parseInt(adjustQty)
    if (isNaN(newQty) || newQty < 0) { setAdjustError('Informe uma quantidade válida (≥ 0).'); return }
    setAdjustSaving(true); setAdjustError('')
    try {
      await productService.update(adjustProduct.id, { stock: newQty })
      setAdjustProduct(null)
      load()
    } catch {
      setAdjustError('Erro ao ajustar estoque.')
    } finally {
      setAdjustSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Package size={24} className="text-emerald-600" />Estoque
        </h1>
        <button onClick={openNew} className="btn-primary flex items-center gap-2">
          <Plus size={16} />Novo Produto
        </button>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-yellow-600 shrink-0" />
          <p className="text-sm text-yellow-800">
            <strong>{lowStock.length} produto(s)</strong> com estoque baixo: {lowStock.map((p) => p.name).join(', ')}
          </p>
        </div>
      )}

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" className="input pl-9" placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
            <Loader2 size={20} className="animate-spin" />Carregando...
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Produto</th>
                <th className="text-center py-2 px-3 text-gray-500 font-medium">Unidade</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Custo</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Venda</th>
                <th className="text-center py-2 px-3 text-gray-500 font-medium">Estoque</th>
                <th className="text-center py-2 px-3 text-gray-500 font-medium">Status</th>
                <th className="text-center py-2 px-3 text-gray-500 font-medium">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-gray-400 py-8">Nenhum produto encontrado.</td></tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-3">
                      <p className="font-medium text-gray-800">{p.name}</p>
                      {p.category && <p className="text-xs text-gray-400">{p.category}</p>}
                    </td>
                    <td className="py-3 px-3 text-center text-gray-600">{UNIT_LABELS[p.unit]}</td>
                    <td className="py-3 px-3 text-right text-gray-600">{p.costPrice ? fmt(p.costPrice) : '-'}</td>
                    <td className="py-3 px-3 text-right font-semibold text-gray-800">{fmt(p.salePrice)}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`font-bold ${p.minStock != null && p.stock <= p.minStock ? 'text-red-600' : 'text-green-600'}`}>{p.stock}</span>
                      {p.minStock != null && <span className="text-xs text-gray-400 ml-1">(min: {p.minStock})</span>}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={p.isActive ? 'badge-green' : 'badge-red'}>{p.isActive ? 'Ativo' : 'Inativo'}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                          title="Editar produto"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => openSupply(p)}
                          className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                          title="Entrada de estoque (compra)"
                        >
                          <ShoppingBag size={15} />
                        </button>
                        <button
                          onClick={() => openAdjust(p)}
                          className="p-1.5 rounded-lg text-orange-400 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                          title="Ajuste de conferência"
                        >
                          <SlidersHorizontal size={15} />
                        </button>
                        {p.isActive
                          ? <button
                              onClick={() => handleDeactivate(p.id)}
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="Desativar produto"
                            >
                              <ShieldOff size={15} />
                            </button>
                          : <button
                              onClick={() => handleActivate(p.id)}
                              className="p-1.5 rounded-lg text-green-500 hover:bg-green-50 hover:text-green-700 transition-colors"
                              title="Ativar produto"
                            >
                              <ShieldCheck size={15} />
                            </button>
                        }
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">{editProduct ? 'Editar Produto' : 'Novo Produto'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Nome *</label>
                  <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="relative">
                  <label className="label">Categoria</label>
                  <input
                    className="input"
                    placeholder="ex: Bebidas"
                    value={form.category}
                    onChange={(e) => handleCategoryInput(e.target.value)}
                    onBlur={() => setTimeout(() => setShowCatDropdown(false), 150)}
                    autoComplete="off"
                  />
                  {showCatDropdown && catSuggestions.length > 0 && (
                    <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {catSuggestions.map((cat) => (
                        <li
                          key={cat}
                          onMouseDown={() => selectCategory(cat)}
                          className="px-3 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
                        >
                          {cat}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <label className="label">Cod. Barras</label>
                  <input className="input" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
                </div>
                <div>
                  <label className="label">Preco de Custo (R$)</label>
                  <input type="number" className="input" step="0.01" min="0" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
                </div>
                <div>
                  <label className="label">Preco de Venda (R$) *</label>
                  <input type="number" className="input" step="0.01" min="0" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Unidade</label>
                  <select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as ProductUnit })}>
                    {(Object.entries(UNIT_LABELS)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Estoque atual</label>
                  <input type="number" className="input" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="label">Estoque minimo (alerta)</label>
                  <input type="number" className="input" min="0" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
                </div>
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={saving}>
                  {saving ? <><Loader2 size={14} className="animate-spin" />Salvando...</> : 'Salvar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Abastecimento (entrada de compra) ── */}
      {supplyProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <ShoppingBag size={18} className="text-emerald-600" />Abastecimento
              </h2>
              <button onClick={() => setSupplyProduct(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSupplySubmit} className="p-6 space-y-4">
              <div className="bg-emerald-50 rounded-xl p-3 text-sm text-emerald-800">
                <span className="font-semibold">{supplyProduct.name}</span>
                <span className="text-emerald-600 ml-2">— Estoque atual: <strong>{supplyProduct.stock}</strong></span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Quantidade entrada *</label>
                  <input
                    type="number" className="input" min="1" placeholder="ex: 50"
                    value={supplyQty}
                    onChange={(e) => setSupplyQty(e.target.value)}
                    required autoFocus
                  />
                </div>
                <div>
                  <label className="label">Custo unitário (R$)</label>
                  <input
                    type="number" className="input" step="0.01" min="0" placeholder="ex: 2.50"
                    value={supplyCost}
                    onChange={(e) => setSupplyCost(e.target.value)}
                  />
                </div>
              </div>
              {supplyCost && supplyQty && (
                <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  Total da compra: <strong className="text-gray-800">
                    {(parseFloat(supplyCost || '0') * parseInt(supplyQty || '0')).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </strong> — será lançado como despesa no Financeiro.
                </p>
              )}
              <div>
                <label className="label">Observação</label>
                <input
                  className="input" placeholder="ex: NF 12345, Fornecedor X"
                  value={supplyNote}
                  onChange={(e) => setSupplyNote(e.target.value)}
                />
              </div>
              {supplyError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{supplyError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setSupplyProduct(null)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={supplySaving}>
                  {supplySaving ? <><Loader2 size={14} className="animate-spin" />Salvando...</> : 'Confirmar Entrada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Ajuste de estoque (conferência) ── */}
      {adjustProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-orange-500" />Ajuste de Estoque
              </h2>
              <button onClick={() => setAdjustProduct(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleAdjustSubmit} className="p-6 space-y-4">
              <div className="bg-orange-50 rounded-xl p-3 text-sm text-orange-800">
                <span className="font-semibold">{adjustProduct.name}</span>
                <span className="text-orange-600 ml-2">— Estoque atual no sistema: <strong>{adjustProduct.stock}</strong></span>
              </div>
              <div>
                <label className="label">Estoque real (contagem física) *</label>
                <input
                  type="number" className="input" min="0" placeholder="Quantidade contada"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  required autoFocus
                />
                {adjustQty !== '' && !isNaN(parseInt(adjustQty)) && (
                  <p className={`text-xs mt-1 font-medium ${parseInt(adjustQty) > adjustProduct.stock ? 'text-green-600' : parseInt(adjustQty) < adjustProduct.stock ? 'text-red-600' : 'text-gray-400'}`}>
                    {parseInt(adjustQty) > adjustProduct.stock
                      ? `▲ Acréscimo de ${parseInt(adjustQty) - adjustProduct.stock} unidade(s)`
                      : parseInt(adjustQty) < adjustProduct.stock
                      ? `▼ Redução de ${adjustProduct.stock - parseInt(adjustQty)} unidade(s)`
                      : '✓ Sem diferença'}
                  </p>
                )}
              </div>
              <div>
                <label className="label">Motivo do ajuste</label>
                <input
                  className="input" placeholder="ex: Conferência física, Avaria, Perda"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                />
              </div>
              {adjustError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{adjustError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setAdjustProduct(null)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={adjustSaving}>
                  {adjustSaving ? <><Loader2 size={14} className="animate-spin" />Salvando...</> : 'Aplicar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
