import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { config } from './config'
import { runMigrations } from './database/migrate'
import { getDb } from './database/db'
import { errorHandler } from './middleware/errorHandler'

import authRoutes from './routes/auth'
import adminRoutes from './routes/admin'
import resellerRoutes from './routes/reseller'
import commerceRoutes from './routes/commerce'

const app = express()

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Aceita a origem configurada + origens extras separadas por vírgula + localhost
const allowedOrigins = [
  // FRONTEND_URL pode conter múltiplas origens separadas por vírgula
  ...(config.cors.origin ? config.cors.origin.split(',').map((s) => s.trim()) : []),
  // Domínio customizado (sempre permitido)
  'https://comerciofacil.questsistemas.com.br',
  // GitHub Pages (sempre permitido)
  'https://lyanjo.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    // Permite requests sem origin (ex: Postman, mobile)
    if (!origin) return callback(null, true)
    if (allowedOrigins.some((o) => origin === o || origin.startsWith(o))) {
      return callback(null, true)
    }
    return callback(new Error(`CORS: origem não permitida — ${origin}`))
  },
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ─── Rotas ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/reseller', resellerRoutes)
app.use('/api/commerce', commerceRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', env: config.nodeEnv, timestamp: new Date().toISOString() })
})

// ─── Setup inicial (endpoint temporário — só funciona com SETUP_KEY definida) ──
// Para usar: POST /api/setup  com header  x-setup-key: <valor de SETUP_KEY>
// Após criar o admin, remova a variável SETUP_KEY no Railway para desativar.
app.post('/api/setup', async (req, res) => {
  const setupKey = process.env.SETUP_KEY
  if (!setupKey) {
    return res.status(404).json({ error: 'Endpoint não disponível.' })
  }
  if (req.headers['x-setup-key'] !== setupKey) {
    return res.status(403).json({ error: 'Chave inválida.' })
  }

  try {
    const db = getDb()
    const { email, password, name } = req.body as { email?: string; password?: string; name?: string }

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Campos obrigatórios: email, password, name.' })
    }

    const existing = await db.get<{ id: string }>(`SELECT id FROM users WHERE email = ?`, [email])
    if (existing) {
      return res.status(409).json({ error: `Usuário ${email} já existe.` })
    }

    const hash = await bcrypt.hash(password, 12)
    const id   = uuidv4()
    await db.run(
      `INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
      [id, name, email, hash, 'admin']
    )

    console.log(`[Setup] ✅ Admin criado: ${email}`)
    return res.status(201).json({ message: `Admin ${email} criado com sucesso!` })
  } catch (err) {
    console.error('[Setup] Erro:', err)
    return res.status(500).json({ error: 'Erro interno ao criar admin.' })
  }
})

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler)

// ─── Inicialização ────────────────────────────────────────────────────────────
async function start() {
  await runMigrations()
  app.listen(config.port, () => {
    console.log(`\n🚀 ComércioFácil Backend`)
    console.log(`   Porta  : http://localhost:${config.port}`)
    console.log(`   Ambiente: ${config.nodeEnv}`)
    console.log(`   Banco   : ${config.db.usePostgres ? 'PostgreSQL' : 'SQLite'}`)
    console.log(`   Health  : http://localhost:${config.port}/api/health\n`)
  })
}

start().catch((err) => {
  console.error('Falha ao iniciar o servidor:', err)
  process.exit(1)
})
