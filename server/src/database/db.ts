import path from 'path'
import fs from 'fs'
import { config } from '../config'

// ─── Interface unificada de banco ─────────────────────────────────────────────
export interface DbRow {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export interface Database {
  run(sql: string, params?: unknown[]): Promise<{ lastID?: number | string; changes?: number }>
  get<T = DbRow>(sql: string, params?: unknown[]): Promise<T | undefined>
  all<T = DbRow>(sql: string, params?: unknown[]): Promise<T[]>
  persist?(): void
}

// ─── Helpers para conversão de parâmetros SQL ─────────────────────────────────
// sql.js usa ? como placeholder (igual SQLite padrão)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToObject(columns: string[], values: any[]): DbRow {
  const obj: DbRow = {}
  columns.forEach((col, i) => { obj[col] = values[i] })
  return obj
}

// ─── SQLite via sql.js (puro JS, sem nativo) ─────────────────────────────────
async function createSqliteDb(): Promise<Database> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const initSqlJs = require('sql.js')
  const SQL = await initSqlJs()

  const dbPath = config.db.sqlitePath
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  // Carrega arquivo existente ou cria novo
  let db: InstanceType<typeof SQL.Database>
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  // Habilita foreign keys
  db.run('PRAGMA foreign_keys = ON')

  // Persiste o banco em disco após cada operação de escrita
  function persistDb() {
    const data: Uint8Array = db.export()
    fs.writeFileSync(dbPath, Buffer.from(data))
  }

  return {
    persist: persistDb,

    run: async (sql, params = []) => {
      db.run(sql, params as (string | number | null | Uint8Array)[])
      persistDb()
      // Pega o último ID inserido
      const lastId = db.exec('SELECT last_insert_rowid() as id')
      const lastID = lastId[0]?.values[0]?.[0] as number | undefined
      return { lastID, changes: db.getRowsModified() }
    },

    get: async <T>(sql: string, params: unknown[] = []) => {
      const stmt = db.prepare(sql)
      stmt.bind(params as (string | number | null | Uint8Array)[])
      if (stmt.step()) {
        const cols = stmt.getColumnNames()
        const values = stmt.get()
        stmt.free()
        return rowToObject(cols, values as unknown[]) as T
      }
      stmt.free()
      return undefined
    },

    all: async <T>(sql: string, params: unknown[] = []) => {
      const results = db.exec(sql, params as (string | number | null | Uint8Array)[])
      if (!results.length) return [] as T[]
      const { columns, values } = results[0]
      return values.map((row: unknown[]) => rowToObject(columns, row)) as T[]
    },
  }
}

// ─── PostgreSQL (produção Railway) ────────────────────────────────────────────
function createPostgresDb(): Database {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require('pg')
  const pool = new Pool({
    connectionString: config.db.postgresUrl,
    ssl: { rejectUnauthorized: false },
  })

  return {
    run: async (sql, params = []) => {
      // Converte ? para $1,$2,... para PostgreSQL
      let i = 0
      const pgSql = sql.replace(/\?/g, () => `$${++i}`)
      const result = await pool.query(pgSql, params)
      return { lastID: result.rows[0]?.id, changes: result.rowCount ?? 0 }
    },
    get: async <T>(sql: string, params: unknown[] = []) => {
      let i = 0
      const pgSql = sql.replace(/\?/g, () => `$${++i}`)
      const result = await pool.query(pgSql, params)
      return result.rows[0] as T | undefined
    },
    all: async <T>(sql: string, params: unknown[] = []) => {
      let i = 0
      const pgSql = sql.replace(/\?/g, () => `$${++i}`)
      const result = await pool.query(pgSql, params)
      return result.rows as T[]
    },
  }
}

// ─── Exporta instância correta ────────────────────────────────────────────────
let _db: Database | null = null

export async function initDb(): Promise<Database> {
  if (!_db) {
    if (config.db.usePostgres) {
      _db = createPostgresDb()
      console.log('[DB] Usando PostgreSQL (produção)')
    } else {
      _db = await createSqliteDb()
      console.log('[DB] Usando SQLite via sql.js (desenvolvimento)')
    }
  }
  return _db
}

export function getDb(): Database {
  if (!_db) throw new Error('Banco não inicializado. Chame initDb() primeiro.')
  return _db
}
