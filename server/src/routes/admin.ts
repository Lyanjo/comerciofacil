import { Router, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'
import { getDb, sql } from '../database/db'
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)
router.use(requireRole('admin'))

// GET /api/admin/resellers
router.get('/resellers', async (_req, res: Response) => {
  try {
    const db = getDb()
    const resellers = await db.all(`
      SELECT r.id, u.name, u.email, r.total_licenses, r.is_active, r.monthly_fee, r.created_at,
             COUNT(CASE WHEN c.status = 'active' THEN 1 END) as active_clients,
             COUNT(c.id) as total_clients
      FROM resellers r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN commerces c ON c.reseller_id = r.id
      GROUP BY r.id, u.name, u.email, r.total_licenses, r.is_active, r.monthly_fee, r.created_at
      ORDER BY r.created_at DESC
    `)
    res.json({ resellers })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// POST /api/admin/resellers — cria novo revendedor
router.post('/resellers', async (req, res: Response) => {
  try {
    const { name, email, password, total_licenses } = req.body as {
      name: string; email: string; password: string; total_licenses: number
    }

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' })
      return
    }

    const db = getDb()
    const existing = await db.get(`SELECT id FROM users WHERE email = ?`, [email])
    if (existing) {
      res.status(409).json({ error: 'E-mail já cadastrado.' })
      return
    }

    const userId = uuidv4()
    const resellerId = uuidv4()
    const hash = await bcrypt.hash(password, 10)

    await db.run(
      `INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'reseller')`,
      [userId, name, email, hash]
    )
    await db.run(
      `INSERT INTO resellers (id, user_id, total_licenses) VALUES (?, ?, ?)`,
      [resellerId, userId, total_licenses || 0]
    )

    res.status(201).json({ message: 'Revendedor criado com sucesso.', resellerId })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// PATCH /api/admin/resellers/:id/licenses — ajusta licenças
router.patch('/resellers/:id/licenses', async (req, res: Response) => {
  try {
    const { id } = req.params
    const { total_licenses } = req.body as { total_licenses: number }
    const db = getDb()
    await db.run(`UPDATE resellers SET total_licenses = ? WHERE id = ?`, [total_licenses, id])
    res.json({ message: 'Licenças atualizadas.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// PATCH /api/admin/resellers/:id/status
router.patch('/resellers/:id/status', async (req, res: Response) => {
  try {
    const { id } = req.params
    const { is_active } = req.body as { is_active: boolean }
    const db = getDb()
    await db.run(`UPDATE resellers SET is_active = ? WHERE id = ?`, [is_active ? 1 : 0, id])
    res.json({ message: 'Status atualizado.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// GET /api/admin/stats
router.get('/stats', async (_req, res: Response) => {
  try {
    const db = getDb()
    const stats = await db.get<{
      total_resellers: number
      active_resellers: number
      total_commerces: number
      active_commerces: number
      estimated_monthly: number
    }>(`
      SELECT
        COUNT(DISTINCT r.id) as total_resellers,
        COUNT(DISTINCT CASE WHEN ${sql.isTrue('r.is_active')} THEN r.id END) as active_resellers,
        COUNT(DISTINCT c.id) as total_commerces,
        COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.id END) as active_commerces,
        COALESCE(SUM(CASE WHEN c.status = 'active' THEN r.monthly_fee ELSE 0 END), 0) as estimated_monthly
      FROM resellers r
      LEFT JOIN commerces c ON c.reseller_id = r.id
    `)

    // Receita estimada por gestor (apenas com fee > 0)
    const revenueByReseller = await db.all<{
      id: string; name: string; active_clients: number; monthly_fee: number; estimated: number
    }>(`
      SELECT
        r.id,
        u.name,
        r.monthly_fee,
        COUNT(CASE WHEN c.status = 'active' THEN 1 END) as active_clients,
        COALESCE(COUNT(CASE WHEN c.status = 'active' THEN 1 END) * r.monthly_fee, 0) as estimated
      FROM resellers r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN commerces c ON c.reseller_id = r.id
      GROUP BY r.id, u.name, r.monthly_fee
      ORDER BY estimated DESC, u.name ASC
    `)

    res.json({
      totalResellers: stats?.total_resellers || 0,
      activeResellers: stats?.active_resellers || 0,
      totalCommerces: stats?.total_commerces || 0,
      activeCommerces: stats?.active_commerces || 0,
      estimatedMonthly: stats?.estimated_monthly || 0,
      revenueByReseller: revenueByReseller.map((r) => ({
        id: r.id,
        name: r.name,
        activeClients: r.active_clients,
        monthlyFee: r.monthly_fee || 0,
        estimated: r.estimated || 0,
      })),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// PATCH /api/admin/resellers/:id/fee — define valor mensal cobrado do gestor
router.patch('/resellers/:id/fee', async (req, res: Response) => {
  try {
    const { id } = req.params
    const { monthly_fee } = req.body as { monthly_fee: number }
    if (monthly_fee === undefined || monthly_fee < 0) {
      res.status(400).json({ error: 'Valor mensal inválido.' })
      return
    }
    const db = getDb()
    await db.run(`UPDATE resellers SET monthly_fee = ? WHERE id = ?`, [monthly_fee, id])
    res.json({ message: 'Valor mensal atualizado.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// ─── Limpeza de dados ─────────────────────────────────────────────────────────

// GET /api/admin/cleanup/resellers — lista gestores com contagem de clientes (para tela de limpeza)
router.get('/cleanup/resellers', async (_req, res: Response) => {
  try {
    const db = getDb()
    const resellers = await db.all(`
      SELECT r.id, u.name, u.email,
             COUNT(c.id) as total_clients
      FROM resellers r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN commerces c ON c.reseller_id = r.id
      GROUP BY r.id, u.name, u.email
      ORDER BY u.name ASC
    `)
    res.json({ resellers })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// GET /api/admin/cleanup/resellers/:id/clients — lista clientes de um gestor
router.get('/cleanup/resellers/:id/clients', async (req, res: Response) => {
  try {
    const { id } = req.params
    const db = getDb()
    const clients = await db.all(`
      SELECT c.id, u.name, u.email, c.status, c.created_at
      FROM commerces c
      JOIN users u ON u.id = c.user_id
      WHERE c.reseller_id = ?
      ORDER BY u.name ASC
    `, [id])
    res.json({ clients })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// DELETE /api/admin/cleanup/client/:id — deleta um cliente e todos seus dados
router.delete('/cleanup/client/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const db = getDb()

    // Busca o commerce e seu user_id
    const commerce = await db.get<{ user_id: string }>(
      `SELECT user_id FROM commerces WHERE id = ?`, [id]
    )
    if (!commerce) { res.status(404).json({ error: 'Cliente não encontrado.' }); return }

    // Deleta em cascata
    await db.run(`DELETE FROM financial_transactions WHERE commerce_id = ?`, [id])
    await db.run(`DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE commerce_id = ?)`, [id])
    await db.run(`DELETE FROM sales WHERE commerce_id = ?`, [id])
    await db.run(`DELETE FROM products WHERE commerce_id = ?`, [id])
    await db.run(`DELETE FROM commerces WHERE id = ?`, [id])
    await db.run(`DELETE FROM users WHERE id = ?`, [commerce.user_id])

    res.json({ message: 'Cliente deletado com sucesso.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// DELETE /api/admin/cleanup/reseller/:id — deleta gestor, todos os clientes e dados
router.delete('/cleanup/reseller/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const db = getDb()

    // Busca user_id do gestor
    const reseller = await db.get<{ user_id: string }>(
      `SELECT user_id FROM resellers WHERE id = ?`, [id]
    )
    if (!reseller) { res.status(404).json({ error: 'Gestor não encontrado.' }); return }

    // Busca todos os clientes do gestor
    const clients = await db.all<{ id: string; user_id: string }>(
      `SELECT c.id, c.user_id FROM commerces c WHERE c.reseller_id = ?`, [id]
    )

    // Deleta dados de cada cliente em cascata
    for (const client of clients) {
      await db.run(`DELETE FROM financial_transactions WHERE commerce_id = ?`, [client.id])
      await db.run(`DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE commerce_id = ?)`, [client.id])
      await db.run(`DELETE FROM sales WHERE commerce_id = ?`, [client.id])
      await db.run(`DELETE FROM products WHERE commerce_id = ?`, [client.id])
      await db.run(`DELETE FROM commerces WHERE id = ?`, [client.id])
      await db.run(`DELETE FROM users WHERE id = ?`, [client.user_id])
    }

    // Deleta o gestor e seu usuário
    await db.run(`DELETE FROM resellers WHERE id = ?`, [id])
    await db.run(`DELETE FROM users WHERE id = ?`, [reseller.user_id])

    res.json({ message: `Gestor e ${clients.length} cliente(s) deletados com sucesso.` })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// DELETE /api/admin/cleanup/all — limpa TUDO exceto o admin logado
router.delete('/cleanup/all', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb()
    const adminUserId = req.user!.id

    // Busca todos os clientes
    const clients = await db.all<{ id: string; user_id: string }>(`SELECT id, user_id FROM commerces`)
    for (const client of clients) {
      await db.run(`DELETE FROM financial_transactions WHERE commerce_id = ?`, [client.id])
      await db.run(`DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE commerce_id = ?)`, [client.id])
      await db.run(`DELETE FROM sales WHERE commerce_id = ?`, [client.id])
      await db.run(`DELETE FROM products WHERE commerce_id = ?`, [client.id])
    }
    await db.run(`DELETE FROM commerces`)
    await db.run(`DELETE FROM resellers`)
    // Deleta todos os usuários EXCETO o admin logado
    await db.run(`DELETE FROM users WHERE id != ?`, [adminUserId])

    res.json({ message: 'Sistema limpo. Apenas seu acesso de admin foi mantido.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

export default router
