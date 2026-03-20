import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getDb } from '../database/db'
import { config } from '../config'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()

// POST /api/auth/login
router.post('/login', async (req, res: Response) => {
  try {
    const { email, password } = req.body as { email: string; password: string }

    if (!email || !password) {
      res.status(400).json({ error: 'E-mail e senha são obrigatórios.' })
      return
    }

    const db = getDb()
    const user = await db.get<{
      id: string; name: string; email: string; password_hash: string; role: string
    }>(
      `SELECT u.id, u.name, u.email, u.password_hash, u.role,
              r.id as reseller_id, r.is_active as reseller_active,
              c.id as commerce_id, c.status as commerce_status
       FROM users u
       LEFT JOIN resellers r ON r.user_id = u.id
       LEFT JOIN commerces c ON c.user_id = u.id
       WHERE u.email = ?`,
      [email]
    )

    if (!user) {
      res.status(401).json({ error: 'Credenciais inválidas.' })
      return
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      res.status(401).json({ error: 'Credenciais inválidas.' })
      return
    }

    // Verifica se o usuário está ativo
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = user as any
    if (u.role === 'reseller' && (u.reseller_active === 0 || u.reseller_active === false)) {
      res.status(403).json({ error: 'Usuário inativo, consultar o gestor da licença.' })
      return
    }
    if (u.role === 'commerce' && u.commerce_status !== 'active') {
      res.status(403).json({ error: 'Usuário inativo, consultar o gestor da licença.' })
      return
    }

    const payload = {
      id: user.id,
      role: user.role,
      resellerId: u.reseller_id || undefined,
      commerceId: u.commerce_id || undefined,
    }

    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: (config.jwt.expiresIn || '7d') as jwt.SignOptions['expiresIn'],
    })

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        resellerId: u.reseller_id || undefined,
        commerceId: u.commerce_id || undefined,
      },
    })
  } catch (err) {
    console.error('[auth/login] Erro:', err)
    res.status(500).json({ error: 'Erro interno.', detail: err instanceof Error ? err.message : String(err) })
  }
})

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb()
    const user = await db.get<{ id: string; name: string; email: string; role: string }>(
      `SELECT id, name, email, role FROM users WHERE id = ?`,
      [req.user!.id]
    )
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' })
      return
    }
    res.json({ user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno.' })
  }
})

export default router
