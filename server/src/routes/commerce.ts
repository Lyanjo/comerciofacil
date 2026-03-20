import { Router, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb, sql } from '../database/db'
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)
router.use(requireRole('commerce'))

// ─── Produtos ────────────────────────────────────────────────────────────────

// GET /api/commerce/products
router.get('/products', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb()
    const products = await db.all(
      `SELECT * FROM products WHERE commerce_id = ? ORDER BY name ASC`,
      [req.user!.commerceId]
    )
    res.json({ products })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// POST /api/commerce/products
router.post('/products', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, barcode, category, sale_price, cost_price, unit, stock, min_stock } =
      req.body as {
        name: string; description?: string; barcode?: string; category?: string
        sale_price: number; cost_price?: number; unit: string
        stock: number; min_stock?: number
      }

    if (!name || !sale_price || !unit) {
      res.status(400).json({ error: 'Nome, preço de venda e unidade são obrigatórios.' })
      return
    }

    const db = getDb()
    const id = uuidv4()
    await db.run(
      `INSERT INTO products (id, commerce_id, name, description, barcode, category, sale_price, cost_price, unit, stock, min_stock, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${sql.boolVal(true)})`,
      [id, req.user!.commerceId, name, description || null, barcode || null, category || null,
       sale_price, cost_price || null, unit, stock || 0, min_stock || null]
    )
    const product = await db.get(`SELECT * FROM products WHERE id = ?`, [id])
    res.status(201).json({ product })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// PUT /api/commerce/products/:id
router.put('/products/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const db = getDb()

    // Busca o produto atual para usar como fallback em campos não enviados (update parcial)
    const current = await db.get<any>(`SELECT * FROM products WHERE id = ? AND commerce_id = ?`, [id, req.user!.commerceId])
    if (!current) {
      res.status(404).json({ error: 'Produto não encontrado.' })
      return
    }

    const body = req.body as {
      name?: string; description?: string; barcode?: string; category?: string
      sale_price?: number; cost_price?: number; unit?: string
      stock?: number; min_stock?: number; is_active?: boolean
    }

    const name        = body.name        !== undefined ? body.name        : current.name
    const description = body.description !== undefined ? body.description : current.description
    const barcode     = body.barcode     !== undefined ? body.barcode     : current.barcode
    const category    = body.category    !== undefined ? body.category    : current.category
    const sale_price  = body.sale_price  !== undefined ? body.sale_price  : current.sale_price
    const cost_price  = body.cost_price  !== undefined ? body.cost_price  : current.cost_price
    const unit        = body.unit        !== undefined ? body.unit        : current.unit
    const stock       = body.stock       !== undefined ? body.stock       : current.stock
    const min_stock   = body.min_stock   !== undefined ? body.min_stock   : current.min_stock
    const is_active   = body.is_active   !== undefined ? body.is_active   : Boolean(current.is_active)

    await db.run(
      `UPDATE products SET name=?, description=?, barcode=?, category=?, sale_price=?, cost_price=?, unit=?, stock=?, min_stock=?, is_active=?, updated_at=${sql.now()}
       WHERE id=? AND commerce_id=?`,
      [name, description || null, barcode || null, category || null, sale_price,
       cost_price || null, unit, stock, min_stock || null, is_active ? 1 : 0, id, req.user!.commerceId]
    )
    const product = await db.get(`SELECT * FROM products WHERE id = ?`, [id])
    res.json({ product })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// DELETE /api/commerce/products/:id
router.delete('/products/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const db = getDb()
    await db.run(
      `UPDATE products SET is_active = ${sql.boolVal(false)} WHERE id = ? AND commerce_id = ?`,
      [id, req.user!.commerceId]
    )
    res.json({ message: 'Produto desativado.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// ─── Vendas / Caixa ───────────────────────────────────────────────────────────

// POST /api/commerce/sales
router.post('/sales', async (req: AuthRequest, res: Response) => {
  try {
    const { items, payment_method, discount, notes } = req.body as {
      items: Array<{ product_id: string; quantity: number; unit_price: number }>
      payment_method: string; discount?: number; notes?: string
    }

    if (!items?.length) {
      res.status(400).json({ error: 'A venda deve ter ao menos um item.' })
      return
    }

    const db = getDb()
    const saleId = uuidv4()
    const disc = discount || 0

    // Calcula totais e busca nomes dos produtos
    let subtotal = 0
    const saleItems = []
    for (const item of items) {
      const product = await db.get<{ name: string; stock: number; sale_price: number }>(
        `SELECT name, stock, sale_price FROM products WHERE id = ? AND commerce_id = ?`,
        [item.product_id, req.user!.commerceId]
      )
      if (!product) {
        res.status(404).json({ error: `Produto ${item.product_id} não encontrado.` })
        return
      }
      if (product.stock < item.quantity) {
        res.status(422).json({ error: `Estoque insuficiente para "${product.name}".` })
        return
      }
      const totalPrice = item.quantity * item.unit_price
      subtotal += totalPrice
      saleItems.push({ id: uuidv4(), product_id: item.product_id, product_name: product.name, quantity: item.quantity, unit_price: item.unit_price, total_price: totalPrice })
    }

    const total = subtotal - disc

    // Insere venda
    await db.run(
      `INSERT INTO sales (id, commerce_id, subtotal, discount, total, payment_method, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)`,
      [saleId, req.user!.commerceId, subtotal, disc, total, payment_method, notes || null]
    )

    // Insere itens e dá baixa no estoque
    for (const si of saleItems) {
      await db.run(
        `INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [si.id, saleId, si.product_id, si.product_name, si.quantity, si.unit_price, si.total_price]
      )
      await db.run(
        `UPDATE products SET stock = stock - ?, updated_at = ${sql.now()} WHERE id = ?`,
        [si.quantity, si.product_id]
      )
    }

    // Lança automaticamente no financeiro com o mesmo ID curto da venda
    await db.run(
      `INSERT INTO financial_transactions (id, commerce_id, type, category, description, amount, date, sale_id)
       VALUES (?, ?, 'income', 'sale', ?, ?, datetime('now'), ?)`,
      [uuidv4(), req.user!.commerceId, `Venda #${saleId.slice(0, 8).toUpperCase()}`, total, saleId]
    )

    res.status(201).json({ saleId, total })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// GET /api/commerce/sales
router.get('/sales', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb()
    const sales = await db.all(
      `SELECT s.*, ${sql.groupConcat('si.product_name || \' x\' || si.quantity', ', ')} as items_summary
       FROM sales s
       LEFT JOIN sale_items si ON si.sale_id = s.id
       WHERE s.commerce_id = ?
       GROUP BY s.id
       ORDER BY s.created_at DESC
       LIMIT 100`,
      [req.user!.commerceId]
    )
    // Busca itens completos para cada venda
    const salesWithItems = await Promise.all(
      sales.map(async (sale) => {
        const items = await db.all(
          `SELECT * FROM sale_items WHERE sale_id = ?`, [sale.id]
        )
        return { ...sale, items }
      })
    )
    res.json({ sales: salesWithItems })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// ─── Financeiro ───────────────────────────────────────────────────────────────

// GET /api/commerce/financial
router.get('/financial', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb()
    const transactions = await db.all(
      `SELECT * FROM financial_transactions WHERE commerce_id = ? ORDER BY date DESC LIMIT 200`,
      [req.user!.commerceId]
    )
    const summary = await db.get<{ income: number; expense: number }>(
      `SELECT
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as expense
       FROM financial_transactions WHERE commerce_id = ?`,
      [req.user!.commerceId]
    )
    res.json({
      transactions,
      summary: {
        income: summary?.income || 0,
        expense: summary?.expense || 0,
        balance: (summary?.income || 0) - (summary?.expense || 0),
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// POST /api/commerce/financial
router.post('/financial', async (req: AuthRequest, res: Response) => {
  try {
    const { type, category, description, amount, date } = req.body as {
      type: 'income' | 'expense'; category: string; description: string; amount: number; date: string
    }

    if (!type || !category || !description || !amount || !date) {
      res.status(400).json({ error: 'Todos os campos são obrigatórios.' })
      return
    }

    const db = getDb()
    const id = uuidv4()
    await db.run(
      `INSERT INTO financial_transactions (id, commerce_id, type, category, description, amount, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user!.commerceId, type, category, description, amount, date]
    )
    const transaction = await db.get(`SELECT * FROM financial_transactions WHERE id = ?`, [id])
    res.status(201).json({ transaction })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// GET /api/commerce/dashboard
router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb()
    const [salesToday, salesMonth, stockAlerts, totalProducts] = await Promise.all([
      db.get<{ count: number; total: number }>(
        `SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total FROM sales
         WHERE commerce_id = ? AND ${sql.dateCast('created_at')} = ${sql.dateToday()}`,
        [req.user!.commerceId]
      ),
      db.get<{ count: number; total: number }>(
        `SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total FROM sales
         WHERE commerce_id = ? AND ${sql.yearMonth('created_at')} = ${sql.yearMonthNow()}`,
        [req.user!.commerceId]
      ),
      db.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM products WHERE commerce_id = ? AND min_stock IS NOT NULL AND stock <= min_stock AND ${sql.isTrue('is_active')}`,
        [req.user!.commerceId]
      ),
      db.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM products WHERE commerce_id = ? AND ${sql.isTrue('is_active')}`,
        [req.user!.commerceId]
      ),
    ])
    res.json({
      salesToday: salesToday?.count || 0,
      revenuToday: salesToday?.total || 0,
      salesMonth: salesMonth?.count || 0,
      revenueMonth: salesMonth?.total || 0,
      lowStockProducts: stockAlerts?.count || 0,
      totalProducts: totalProducts?.count || 0,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

export default router
