import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { initDb, getDb } from './db'
import { runMigrations } from './migrate'

async function seed() {
  await initDb()
  await runMigrations()
  const db = getDb()

  console.log('[Seed] Inserindo dados iniciais...')

  // Admin
  const adminId = uuidv4()
  const adminHash = await bcrypt.hash('admin123', 10)
  await db.run(
    `INSERT OR IGNORE INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
    [adminId, 'Admin Master', 'admin@comerciofacil.com', adminHash, 'admin']
  )

  // Revendedor
  const resellerUserId = uuidv4()
  const resellerId = uuidv4()
  const resellerHash = await bcrypt.hash('rev123', 10)
  await db.run(
    `INSERT OR IGNORE INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
    [resellerUserId, 'João Revendedor', 'joao@revendedor.com', resellerHash, 'reseller']
  )
  await db.run(
    `INSERT OR IGNORE INTO resellers (id, user_id, total_licenses) VALUES (?, ?, ?)`,
    [resellerId, resellerUserId, 10]
  )

  // Comércio (cliente final)
  const commerceUserId = uuidv4()
  const commerceId = uuidv4()
  const commerceHash = await bcrypt.hash('loja123', 10)
  await db.run(
    `INSERT OR IGNORE INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
    [commerceUserId, 'Loja da Maria', 'maria@loja.com', commerceHash, 'commerce']
  )
  await db.run(
    `INSERT OR IGNORE INTO commerces (id, reseller_id, user_id, name, owner_name, phone, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [commerceId, resellerId, commerceUserId, 'Loja da Maria', 'Maria Silva', '(11) 99999-0000', 'active']
  )

  // Produtos de exemplo
  const products = [
    { name: 'Pipoca Salgada', category: 'Alimentos', sale_price: 5.0, cost_price: 2.0, unit: 'un', stock: 50, min_stock: 10 },
    { name: 'Pipoca Doce', category: 'Alimentos', sale_price: 5.0, cost_price: 2.0, unit: 'un', stock: 40, min_stock: 10 },
    { name: 'Refrigerante Lata', category: 'Bebidas', sale_price: 6.0, cost_price: 3.5, unit: 'un', stock: 5, min_stock: 10 },
    { name: 'Suco de Laranja', category: 'Bebidas', sale_price: 7.0, cost_price: 4.0, unit: 'un', stock: 25, min_stock: 5 },
    { name: 'Água Mineral', category: 'Bebidas', sale_price: 3.0, cost_price: 1.0, unit: 'un', stock: 100, min_stock: 20 },
    { name: 'Chocolate', category: 'Doces', sale_price: 8.0, cost_price: 4.5, unit: 'un', stock: 20, min_stock: 5 },
    { name: 'Bala', category: 'Doces', sale_price: 0.5, cost_price: 0.2, unit: 'un', stock: 200, min_stock: 30 },
    { name: 'Chiclete', category: 'Doces', sale_price: 1.0, cost_price: 0.4, unit: 'un', stock: 150, min_stock: 20 },
  ]

  for (const p of products) {
    await db.run(
      `INSERT OR IGNORE INTO products (id, commerce_id, name, category, sale_price, cost_price, unit, stock, min_stock, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [uuidv4(), commerceId, p.name, p.category, p.sale_price, p.cost_price, p.unit, p.stock, p.min_stock]
    )
  }

  console.log('[Seed] ✅ Dados iniciais inseridos!')
  console.log('[Seed] Acessos criados:')
  console.log('  Admin:      admin@comerciofacil.com / admin123')
  console.log('  Revendedor: joao@revendedor.com    / rev123')
  console.log('  Comércio:   maria@loja.com          / loja123')
}

seed().catch(console.error)
