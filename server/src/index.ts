import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { config } from './config'
import { runMigrations } from './database/migrate'
import { errorHandler } from './middleware/errorHandler'

import authRoutes from './routes/auth'
import adminRoutes from './routes/admin'
import resellerRoutes from './routes/reseller'
import commerceRoutes from './routes/commerce'

const app = express()

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Aceita a origem configurada + localhost para desenvolvimento
const allowedOrigins = [
  config.cors.origin,
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
