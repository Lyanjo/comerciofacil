import { Router, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'
import { getDb, sql } from '../database/db'
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)
router.use(requireRole('reseller'))

// GET /api/reseller/dashboard
router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb()
    const reseller = await db.get<{
      id: string; total_licenses: number; monthly_fee: number; reseller_price: number | null; price_hidden: number
    }>(
      `SELECT id, total_licenses, monthly_fee, reseller_price, price_hidden FROM resellers WHERE user_id = ?`,
      [req.user!.id]
    )
    if (!reseller) { res.status(404).json({ error: 'Revendedor não encontrado.' }); return }

    const stats = await db.get<{
      total: number; active: number; canceled: number; new_month: number
    }>(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'canceled' THEN 1 END) as canceled,
        COUNT(CASE WHEN status = 'active' AND ${sql.yearMonth('created_at')} = ${sql.yearMonthNow()} THEN 1 END) as new_month
      FROM commerces WHERE reseller_id = ?
    `, [reseller.id])

    const usedLicenses = stats?.active || 0
    const activeClients = stats?.active || 0
    const monthlyBill = activeClients * (reseller.monthly_fee || 0)

    // Receita a receber: por cliente (client_price ?? reseller_price) apenas ativos
    const clientsRaw = await db.all<{
      id: string; name: string; client_price: number | null; status: string
    }>(`
      SELECT id, name, client_price, status
      FROM commerces
      WHERE reseller_id = ?
      ORDER BY name ASC
    `, [reseller.id])

    const resellerPriceVal = reseller.reseller_price ?? null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const priceHidden = !!(reseller.price_hidden as any)

    const clientsRevenue = clientsRaw.map((c) => {
      const effectivePrice = c.client_price ?? resellerPriceVal
      return {
        id: c.id,
        name: c.name,
        active: c.status === 'active',
        price: effectivePrice,
        estimated: c.status === 'active' && effectivePrice != null ? effectivePrice : 0,
      }
    })

    const estimatedReceivable = clientsRevenue.reduce((s, c) => s + c.estimated, 0)

    res.json({
      totalClients: stats?.total || 0,
      activeClients,
      canceledClients: stats?.canceled || 0,
      newClientsThisMonth: stats?.new_month || 0,
      totalLicenses: reseller.total_licenses,
      usedLicenses,
      availableLicenses: reseller.total_licenses - usedLicenses,
      monthlyFee: reseller.monthly_fee || 0,
      monthlyBill,
      resellerPrice: resellerPriceVal,
      priceHidden,
      estimatedReceivable,
      clientsRevenue,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// GET /api/reseller/clients
router.get('/clients', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb()
    const reseller = await db.get<{ id: string }>(
      `SELECT id FROM resellers WHERE user_id = ?`, [req.user!.id]
    )
    if (!reseller) { res.status(404).json({ error: 'Revendedor não encontrado.' }); return }

    const clients = await db.all(`
      SELECT c.id, c.name, c.owner_name, u.email, c.phone, c.status, c.client_price, c.created_at
      FROM commerces c
      JOIN users u ON u.id = c.user_id
      WHERE c.reseller_id = ?
      ORDER BY c.created_at DESC
    `, [reseller.id])

    res.json({ clients })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// POST /api/reseller/clients — cria novo comércio
router.post('/clients', async (req: AuthRequest, res: Response) => {
  try {
    const { name, owner_name, email, password, phone, address, client_price } = req.body as {
      name: string; owner_name: string; email: string; password: string
      phone?: string; address?: string; client_price?: number | null
    }

    if (!name || !owner_name || !email || !password) {
      res.status(400).json({ error: 'Nome, responsável, e-mail e senha são obrigatórios.' })
      return
    }

    const db = getDb()
    const reseller = await db.get<{ id: string; total_licenses: number }>(
      `SELECT r.id, r.total_licenses FROM resellers r WHERE r.user_id = ?`, [req.user!.id]
    )
    if (!reseller) { res.status(404).json({ error: 'Revendedor não encontrado.' }); return }

    // Verifica licenças disponíveis
    const activeCount = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM commerces WHERE reseller_id = ? AND status = 'active'`,
      [reseller.id]
    )
    if ((activeCount?.count || 0) >= reseller.total_licenses) {
      res.status(422).json({ error: 'Sem licenças disponíveis. Solicite mais ao administrador.' })
      return
    }

    const existing = await db.get(`SELECT id FROM users WHERE email = ?`, [email])
    if (existing) { res.status(409).json({ error: 'E-mail já cadastrado.' }); return }

    const userId = uuidv4()
    const commerceId = uuidv4()
    const hash = await bcrypt.hash(password, 10)

    await db.run(
      `INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'commerce')`,
      [userId, name, email, hash]
    )
    await db.run(
      `INSERT INTO commerces (id, reseller_id, user_id, name, owner_name, phone, address, client_price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [commerceId, reseller.id, userId, name, owner_name, phone || null, address || null, client_price ?? null]
    )

    res.status(201).json({ message: 'Cliente criado com sucesso.', commerceId })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// PATCH /api/reseller/clients/:id/status
router.patch('/clients/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { status } = req.body as { status: 'active' | 'canceled' | 'suspended' }
    const db = getDb()
    const reseller = await db.get<{ id: string }>(
      `SELECT id FROM resellers WHERE user_id = ?`, [req.user!.id]
    )
    if (!reseller) { res.status(404).json({ error: 'Revendedor não encontrado.' }); return }
    await db.run(
      `UPDATE commerces SET status = ?, updated_at = ${sql.now()} WHERE id = ? AND reseller_id = ?`,
      [status, id, reseller.id]
    )
    res.json({ message: 'Status atualizado.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// PATCH /api/reseller/clients/:id/price — define preço individual do cliente
router.patch('/clients/:id/price', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { client_price } = req.body as { client_price: number | null }
    const db = getDb()
    const reseller = await db.get<{ id: string }>(
      `SELECT id FROM resellers WHERE user_id = ?`, [req.user!.id]
    )
    if (!reseller) { res.status(404).json({ error: 'Revendedor não encontrado.' }); return }
    await db.run(
      `UPDATE commerces SET client_price = ?, updated_at = ${sql.now()} WHERE id = ? AND reseller_id = ?`,
      [client_price ?? null, id, reseller.id]
    )
    res.json({ message: 'Preço atualizado.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// GET /api/reseller/settings
router.get('/settings', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb()
    const reseller = await db.get<{
      reseller_price: number | null; price_hidden: number; monthly_fee: number
    }>(
      `SELECT reseller_price, price_hidden, monthly_fee FROM resellers WHERE user_id = ?`,
      [req.user!.id]
    )
    if (!reseller) { res.status(404).json({ error: 'Revendedor não encontrado.' }); return }
    res.json({
      resellerPrice: reseller.reseller_price ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      priceHidden: !!(reseller.price_hidden as any),
      monthlyFee: reseller.monthly_fee || 0,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

// PATCH /api/reseller/settings
router.patch('/settings', async (req: AuthRequest, res: Response) => {
  try {
    const { reseller_price, price_hidden } = req.body as {
      reseller_price?: number | null
      price_hidden?: boolean
    }
    const db = getDb()
    const reseller = await db.get<{ id: string }>(
      `SELECT id FROM resellers WHERE user_id = ?`, [req.user!.id]
    )
    if (!reseller) { res.status(404).json({ error: 'Revendedor não encontrado.' }); return }

    await db.run(
      `UPDATE resellers SET
        reseller_price = ?,
        price_hidden = ?
       WHERE id = ?`,
      [
        reseller_price !== undefined ? reseller_price : null,
        price_hidden ? 1 : 0,
        reseller.id,
      ]
    )
    res.json({ message: 'Configurações salvas.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

export default router
