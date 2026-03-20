import 'dotenv/config'
import path from 'path'

const isProduction = process.env.NODE_ENV === 'production'

export const config = {
  port: parseInt(process.env.PORT || '3333'),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  db: {
    // Se DATABASE_URL estiver definida, usa PostgreSQL (produção Railway)
    // Caso contrário, usa SQLite local
    usePostgres: !!process.env.DATABASE_URL,
    postgresUrl: process.env.DATABASE_URL || '',
    sqlitePath: path.resolve(__dirname, '../../data/comercio.db'),
  },

  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  },
}
