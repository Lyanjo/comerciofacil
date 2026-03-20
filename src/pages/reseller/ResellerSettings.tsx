import { useState, useEffect } from 'react'
import { Settings, Save, Loader2, EyeOff, Eye, Info } from 'lucide-react'
import { resellerService } from '../../services/resellerService'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function ResellerSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // Campos do formulário
  const [priceInput, setPriceInput] = useState('')
  const [priceHidden, setPriceHidden] = useState(false)
  const [monthlyFee, setMonthlyFee] = useState(0)

  useEffect(() => {
    resellerService.getSettings()
      .then((s) => {
        setPriceInput(s.resellerPrice != null ? String(s.resellerPrice) : '')
        setPriceHidden(s.priceHidden)
        setMonthlyFee(s.monthlyFee)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      const parsed = priceInput.trim() === '' ? null : parseFloat(priceInput.replace(',', '.'))
      if (parsed !== null && (isNaN(parsed) || parsed < 0)) {
        setError('Valor inválido. Use um número positivo, ex: 49.90')
        return
      }
      await resellerService.saveSettings({ reseller_price: parsed, price_hidden: priceHidden })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar configurações.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400 gap-2">
        <Loader2 size={24} className="animate-spin" />Carregando...
      </div>
    )
  }

  const previewPrice = priceInput.trim() !== '' ? parseFloat(priceInput.replace(',', '.')) : null

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-2 mb-6">
        <Settings size={20} className="text-gray-600" />
        <h1 className="text-2xl font-bold text-gray-800">Configurações</h1>
      </div>

      {/* Card fatura do adm */}
      <div className="card mb-6 border-l-4 border-l-orange-400 bg-orange-50">
        <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1">Mensalidade ao Administrador</p>
        {monthlyFee > 0 ? (
          <>
            <p className="text-2xl font-bold text-orange-600">{fmt(monthlyFee)}</p>
            <p className="text-xs text-orange-500 mt-1">por cliente ativo / mês — valor definido pelo administrador</p>
          </>
        ) : (
          <p className="text-sm text-orange-400 italic">Não definido pelo administrador ainda.</p>
        )}
      </div>

      {/* Formulário de preço do gestor */}
      <form onSubmit={handleSave} className="card space-y-5">
        <div>
          <h2 className="font-semibold text-gray-800 mb-1">Seu preço ao cliente</h2>
          <p className="text-xs text-gray-400 mb-4">
            Defina quanto você cobra de cada cliente por mês. Isso aparece no seu dashboard como referência.
            Se preferir manter privado, ative a opção "Ocultar valor".
          </p>

          <label className="label">Valor mensal cobrado (R$)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">R$</span>
            <input
              className="input pl-9"
              type="text"
              inputMode="decimal"
              placeholder="ex: 49,90"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              disabled={priceHidden}
            />
          </div>
          {previewPrice !== null && !isNaN(previewPrice) && !priceHidden && (
            <p className="text-xs text-green-600 mt-1">Será exibido como: <strong>{fmt(previewPrice)}</strong></p>
          )}
          <p className="text-xs text-gray-400 mt-1">Deixe em branco para não exibir nenhum valor.</p>
        </div>

        {/* Toggle ocultar */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
          <div className="flex items-center gap-3">
            {priceHidden ? <EyeOff size={18} className="text-gray-400" /> : <Eye size={18} className="text-gray-500" />}
            <div>
              <p className="text-sm font-medium text-gray-700">Ocultar valor no dashboard</p>
              <p className="text-xs text-gray-400">O valor será substituído por "••••••"</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPriceHidden(!priceHidden)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${priceHidden ? 'bg-indigo-600' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${priceHidden ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Info */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <Info size={15} className="text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-600">
            Este valor é apenas para seu controle e referência no dashboard. Ele não é enviado para seus clientes nem aparece em nenhuma tela deles.
          </p>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        {success && <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">✅ Configurações salvas com sucesso!</p>}

        <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={saving}>
          {saving ? <><Loader2 size={14} className="animate-spin" />Salvando...</> : <><Save size={15} />Salvar Configurações</>}
        </button>
      </form>
    </div>
  )
}
