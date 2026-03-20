import { initDb, getDb } from './db'
// SQL para criação das tabelas — compatível com SQLite e PostgreSQL
// Usamos TEXT para IDs (UUID) em ambos os bancos

const SQLITE_TABLES = `
-- Usuários
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','reseller','commerce')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Revendedores
CREATE TABLE IF NOT EXISTS resellers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  total_licenses INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  monthly_fee REAL NOT NULL DEFAULT 0,
  reseller_price REAL,
  price_hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Comércios (clientes finais)
CREATE TABLE IF NOT EXISTS commerces (
  id TEXT PRIMARY KEY,
  reseller_id TEXT NOT NULL REFERENCES resellers(id),
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','canceled','suspended')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Produtos
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  commerce_id TEXT NOT NULL REFERENCES commerces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  barcode TEXT,
  category TEXT,
  sale_price REAL NOT NULL,
  cost_price REAL,
  unit TEXT NOT NULL DEFAULT 'un',
  stock REAL NOT NULL DEFAULT 0,
  min_stock REAL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Vendas
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  commerce_id TEXT NOT NULL REFERENCES commerces(id) ON DELETE CASCADE,
  subtotal REAL NOT NULL,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Itens da venda
CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  total_price REAL NOT NULL
);

-- Transações financeiras
CREATE TABLE IF NOT EXISTS financial_transactions (
  id TEXT PRIMARY KEY,
  commerce_id TEXT NOT NULL REFERENCES commerces(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('income','expense')),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  sale_id TEXT REFERENCES sales(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`

const POSTGRES_TABLES = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','reseller','commerce')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resellers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  total_licenses INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  monthly_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  reseller_price NUMERIC(10,2),
  price_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commerces (
  id TEXT PRIMARY KEY,
  reseller_id TEXT NOT NULL REFERENCES resellers(id),
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','canceled','suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  commerce_id TEXT NOT NULL REFERENCES commerces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  barcode TEXT,
  category TEXT,
  sale_price NUMERIC(10,2) NOT NULL,
  cost_price NUMERIC(10,2),
  unit TEXT NOT NULL DEFAULT 'un',
  stock NUMERIC(10,3) NOT NULL DEFAULT 0,
  min_stock NUMERIC(10,3),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  commerce_id TEXT NOT NULL REFERENCES commerces(id) ON DELETE CASCADE,
  subtotal NUMERIC(10,2) NOT NULL,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC(10,3) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS financial_transactions (
  id TEXT PRIMARY KEY,
  commerce_id TEXT NOT NULL REFERENCES commerces(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('income','expense')),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  sale_id TEXT REFERENCES sales(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

export async function runMigrations() {
  await initDb()
  const db = getDb()
  const isPostgres = !!process.env.DATABASE_URL

  console.log('[Migrate] Executando migrações...')

  if (isPostgres) {
    // PostgreSQL: executa cada statement separado
    for (const stmt of POSTGRES_TABLES.split(';').map(s => s.trim()).filter(Boolean)) {
      await db.run(stmt)
    }
  } else {
    // SQLite: executa o bloco completo de uma vez via run encadeado
    for (const stmt of SQLITE_TABLES.split(';').map(s => s.trim()).filter(Boolean)) {
      await db.run(stmt)
    }
  }

  // Migrações incrementais — adiciona colunas se ainda não existirem
  const incrementalMigrations = [
    `ALTER TABLE resellers ADD COLUMN monthly_fee REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE resellers ADD COLUMN reseller_price REAL`,
    `ALTER TABLE resellers ADD COLUMN price_hidden INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE commerces ADD COLUMN client_price REAL`,
  ]
  for (const stmt of incrementalMigrations) {
    try { await db.run(stmt) } catch (_) { /* coluna já existe */ }
  }

  console.log('[Migrate] ✅ Migrações concluídas!')
}

// Permite rodar direto: tsx src/database/migrate.ts
if (require.main === module) {
  runMigrations().catch(console.error)
}
