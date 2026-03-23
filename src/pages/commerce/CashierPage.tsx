import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Minus, Trash2, CheckCircle, ShoppingCart, Loader2, Barcode, X } from 'lucide-react'
import type { Product, SaleItem, PaymentMethod } from '../../types'
import { productService } from '../../services/productService'
import { saleService } from '../../services/saleService'

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  debit: 'Débito',
  credit: 'Crédito',
  pix: 'PIX',
  other: 'Outro',
}

export default function CashierPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [cart, setCart] = useState<SaleItem[]>([])
  const [payment, setPayment] = useState<PaymentMethod>('cash')
  const [cashReceived, setCashReceived] = useState<string>('')
  const [confirmed, setConfirmed] = useState(false)
  const [confirmedTotal, setConfirmedTotal] = useState(0)
  const [confirmedChange, setConfirmedChange] = useState<number | null>(null)
  const [loadingSale, setLoadingSale] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // ─── Leitor de código de barras ───────────────────────────────────────────
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanFeedback, setScanFeedback] = useState<{ msg: string; ok: boolean } | null>(null)
  const barcodeBufferRef = useRef('')
  const barcodeTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const productsRef = useRef<Product[]>([])
  productsRef.current = products

  // Som de bip via Web Audio API
  const beep = useCallback((ok: boolean) => {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = ok ? 880 : 300
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (ok ? 0.12 : 0.25))
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + (ok ? 0.12 : 0.25))
    } catch { /* navegador sem AudioContext */ }
  }, [])

  // Feedback visual temporário
  const showFeedback = useCallback((msg: string, ok: boolean) => {
    setScanFeedback({ msg, ok })
    setTimeout(() => setScanFeedback(null), 2000)
  }, [])

  // Adiciona produto pelo código de barras
  const addByBarcode = useCallback((code: string) => {
    const found = productsRef.current.find((p) => p.barcode === code)
    if (!found) {
      beep(false)
      showFeedback(`Código não encontrado: ${code}`, false)
      return
    }
    if (found.stock <= 0) {
      beep(false)
      showFeedback(`Sem estoque: ${found.name}`, false)
      return
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === found.id)
      if (existing) {
        return prev.map((i) =>
          i.productId === found.id
            ? { ...i, quantity: i.quantity + 1, totalPrice: (i.quantity + 1) * i.unitPrice }
            : i
        )
      }
      return [...prev, { productId: found.id, productName: found.name, quantity: 1, unitPrice: found.salePrice, totalPrice: found.salePrice }]
    })
    beep(true)
    showFeedback(`✓ ${found.name}`, true)
  }, [beep, showFeedback])

  // Listener de teclado para capturar leituras do scanner USB/bluetooth
  // Scanners enviam os dígitos muito rápido e terminam com Enter
  useEffect(() => {
    if (!scannerOpen) return
    const handleKey = (e: KeyboardEvent) => {
      // Ignora teclas de controle exceto Enter
      if (e.key === 'Enter') {
        const code = barcodeBufferRef.current.trim()
        barcodeBufferRef.current = ''
        if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current)
        if (code.length >= 8) addByBarcode(code)
        return
      }
      if (e.key.length === 1) {
        barcodeBufferRef.current += e.key
        // Reset buffer se não vier mais entrada em 300ms (digitação manual)
        if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current)
        barcodeTimerRef.current = setTimeout(() => {
          barcodeBufferRef.current = ''
        }, 300)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [scannerOpen, addByBarcode])

  useEffect(() => {
    productService.list().then((data) => {
      const sorted = data
        .filter((p) => p.isActive)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
      setProducts(sorted)
    }).finally(() => setLoadingProducts(false))
  }, [])

  // Categorias únicas para as subdivisões — ordem alfabética sem acento
  const categories = Array.from(
    new Set(products.map((p) => p.category || 'Sem categoria'))
  ).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))

  // Quando tem busca, ignora subdivisões e mostra tudo filtrado
  const isSearching = searchTerm.trim().length > 0
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + 1, totalPrice: (i.quantity + 1) * i.unitPrice }
            : i
        )
      }
      return [...prev, { productId: product.id, productName: product.name, quantity: 1, unitPrice: product.salePrice, totalPrice: product.salePrice }]
    })
  }

  const changeQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev.map((i) =>
        i.productId === productId
          ? { ...i, quantity: i.quantity + delta, totalPrice: (i.quantity + delta) * i.unitPrice }
          : i
      ).filter((i) => i.quantity > 0)
    )
  }

  const removeFromCart = (productId: string) => setCart((prev) => prev.filter((i) => i.productId !== productId))

  const total = cart.reduce((sum, i) => sum + i.totalPrice, 0)
  const change = payment === 'cash' && cashReceived ? parseFloat(cashReceived.replace(',', '.')) - total : null

  const handleConfirm = async () => {
    if (cart.length === 0) return
    setLoadingSale(true)
    try {
      await saleService.create({
        items: cart.map((i) => ({ product_id: i.productId, quantity: i.quantity, unit_price: i.unitPrice })),
        payment_method: payment,
      })
      setConfirmedTotal(total)
      setConfirmedChange(change)
      setConfirmed(true)
      productService.list().then((data) => setProducts(data.filter((p) => p.isActive)))
      setTimeout(() => { setCart([]); setCashReceived(''); setConfirmed(false) }, 2500)
    } catch {
      alert('Erro ao registrar venda. Verifique o estoque.')
    } finally {
      setLoadingSale(false)
    }
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // Card de produto sem imagem — compacto
  const ProductCard = ({ product }: { product: Product }) => (
    <button
      key={product.id}
      onClick={() => addToCart(product)}
      disabled={product.stock <= 0}
      className="bg-white border border-gray-200 rounded-lg p-2 text-left hover:border-emerald-400 hover:shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <p className="font-medium text-gray-800 text-xs leading-tight line-clamp-2">{product.name}</p>
      <p className="text-emerald-600 font-bold text-xs mt-1">{fmt(product.salePrice)}</p>
      <p className="text-gray-400 text-[10px] mt-0.5">Estq: {product.stock}</p>
    </button>
  )

  if (confirmed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="bg-green-100 text-green-600 rounded-full p-6"><CheckCircle size={64} /></div>
        <h2 className="text-2xl font-bold text-green-700">Venda Confirmada!</h2>
        <p className="text-gray-500">Total: <strong>{fmt(confirmedTotal)}</strong></p>
        {confirmedChange !== null && confirmedChange >= 0 && (
          <p className="text-gray-500">Troco: <strong className="text-green-600">{fmt(confirmedChange)}</strong></p>
        )}
      </div>
    )
  }

  return (
    <>
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Painel esquerdo — Produtos */}
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
          <ShoppingCart size={22} className="text-emerald-600" />Caixa
        </h1>
        {/* Barra de busca + botão de código de barras */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            className="input flex-1 min-w-0"
            placeholder="🔍 Buscar produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            onClick={() => setScannerOpen(true)}
            title="Ler código de barras (ou use leitor USB conectado)"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium whitespace-nowrap transition-colors
              ${scanFeedback?.ok === true  ? 'bg-green-100 border-green-400 text-green-700' :
                scanFeedback?.ok === false ? 'bg-red-100  border-red-400  text-red-700'  :
                'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <Barcode size={16} />
            <span className="hidden sm:inline">Cód. Barras</span>
          </button>
        </div>

        {/* Feedback visual de leitura */}
        {scanFeedback && (
          <div className={`mb-3 px-3 py-2 rounded-lg text-sm font-medium
            ${scanFeedback.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {scanFeedback.msg}
          </div>
        )}

        {loadingProducts ? (
          <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
            <Loader2 size={20} className="animate-spin" />Carregando produtos...
          </div>
        ) : isSearching ? (
          /* Modo busca: lista plana sem subdivisões */
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
            {filteredProducts.length === 0
              ? <div className="col-span-6 text-center text-gray-400 py-8">Nenhum produto encontrado.</div>
              : filteredProducts.map((p) => <ProductCard key={p.id} product={p} />)
            }
          </div>
        ) : (
          /* Modo normal: subdivisões por categoria */
          <div className="space-y-5">
            {categories.map((cat) => {
              const catProducts = products.filter(
                (p) => (p.category || 'Sem categoria') === cat
              )
              if (catProducts.length === 0) return null
              return (
                <div key={cat}>
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                    {cat}
                  </h2>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                    {catProducts.map((p) => <ProductCard key={p.id} product={p} />)}
                  </div>
                </div>
              )
            })}
            {products.length === 0 && (
              <div className="text-center text-gray-400 py-8">Nenhum produto cadastrado.</div>
            )}
          </div>
        )}
      </div>

      {/* Painel direito — Carrinho */}
      <div className="lg:w-80 flex flex-col gap-3">
        <div className="card flex-1">
          <h2 className="font-bold text-gray-700 mb-3 flex items-center justify-between">
            Carrinho
            {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-red-400 hover:text-red-600">Limpar</button>}
          </h2>
          {cart.length === 0 ? (
            <div className="text-center text-gray-300 py-8">
              <ShoppingCart size={40} className="mx-auto mb-2" />
              <p className="text-sm">Carrinho vazio</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.productId} className="flex items-center gap-2 py-2 border-b border-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.productName}</p>
                    <p className="text-xs text-gray-500">{fmt(item.unitPrice)} un.</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => changeQty(item.productId, -1)} className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><Minus size={12} /></button>
                    <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                    <button onClick={() => changeQty(item.productId, 1)} className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><Plus size={12} /></button>
                  </div>
                  <p className="w-16 text-right text-sm font-bold text-gray-800">{fmt(item.totalPrice)}</p>
                  <button onClick={() => removeFromCart(item.productId)} className="text-red-300 hover:text-red-500 ml-1"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <span className="text-gray-600 font-medium">Total</span>
            <span className="text-2xl font-bold text-emerald-600">{fmt(total)}</span>
          </div>
          <p className="text-xs text-gray-500 mb-2 font-medium">Forma de pagamento</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((method) => (
              <button key={method} onClick={() => setPayment(method)}
                className={`py-2 px-2 rounded-lg text-xs font-medium transition-colors ${payment === method ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {PAYMENT_LABELS[method]}
              </button>
            ))}
          </div>
          {payment === 'cash' && (
            <div className="mb-3">
              <label className="label">Valor recebido (R$)</label>
              <input type="number" className="input" placeholder="0,00" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} min={0} step={0.01} />
              {change !== null && (
                <p className={`text-sm mt-1 font-semibold ${change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {change >= 0 ? `Troco: ${fmt(change)}` : `Faltam: ${fmt(Math.abs(change))}`}
                </p>
              )}
            </div>
          )}
          <button className="btn-success w-full py-3 text-base flex items-center justify-center gap-2"
            disabled={cart.length === 0 || loadingSale} onClick={handleConfirm}>
            {loadingSale ? (<><Loader2 size={16} className="animate-spin" />Registrando...</>) : '✅ Confirmar Venda'}
          </button>
        </div>
      </div>
    </div>

    {/* Modal do leitor de codigo de barras */}
    {scannerOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-emerald-600">
              <Barcode size={20} />
              <h2 className="font-bold text-gray-800 text-lg">Codigo de Barras</h2>
            </div>
            <button onClick={() => setScannerOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={18} />
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Use o leitor USB/bluetooth (ele digita automaticamente) ou insira o codigo manualmente:
          </p>
          <input
            type="text"
            inputMode="numeric"
            className="input text-center text-xl tracking-widest font-mono"
            placeholder="0000000000000"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const code = e.currentTarget.value.trim()
                e.currentTarget.value = ''
                if (code.length >= 8) addByBarcode(code)
              }
            }}
          />
          <p className="text-xs text-gray-400 mt-3 text-center">
            Pressione Enter apos digitar ou ao usar o leitor
          </p>
          {scanFeedback && (
            <div className={`mt-3 px-3 py-2 rounded-lg text-sm font-medium text-center ${scanFeedback.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {scanFeedback.msg}
            </div>
          )}
        </div>
      </div>
    )}
    </>
  )
}