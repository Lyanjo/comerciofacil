/**
 * Seed de produção — cria apenas o admin inicial no PostgreSQL (Railway).
 * Uso: DATABASE_URL=... npx tsx src/database/seed-prod.ts
 */
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { initDb, getDb } from './db'
import { runMigrations } from './migrate'

async function seedProd() {
  await initDb()
  await runMigrations()
  const db = getDb()

  const email = 'george@admin.com'
  const senha = '@Leaofofo1'
  const nome  = 'George Admin'

  // Verifica se já existe
  const existing = await db.get<{ id: string }>(
    `SELECT id FROM users WHERE email = ?`,
    [email]
  )

  if (existing) {
    console.log(`[Seed Prod] ⚠️  Usuário ${email} já existe — nenhuma alteração feita.`)
    process.exit(0)
  }

  const id   = uuidv4()
  const hash = await bcrypt.hash(senha, 12)

  await db.run(
    `INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
    [id, nome, email, hash, 'admin']
  )

  console.log(`[Seed Prod] ✅ Admin criado com sucesso!`)
  console.log(`  E-mail : ${email}`)
  console.log(`  Role   : admin`)
  process.exit(0)
}

seedProd().catch((err) => {
  console.error('[Seed Prod] ❌ Erro:', err)
  process.exit(1)
})
