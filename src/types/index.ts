// Tipos centrais do sistema ComércioFácil

// ─── USUÁRIOS E AUTENTICAÇÃO ────────────────────────────────────────────────

export type UserRole = 'admin' | 'reseller' | 'commerce'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  createdAt: string
  updatedAt: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
}

// ─── REVENDEDOR ──────────────────────────────────────────────────────────────

export interface Reseller {
  id: string
  userId: string
  name: string
  email: string
  phone?: string
  totalLicenses: number
  usedLicenses: number
  isActive: boolean
  createdAt: string
}

// ─── COMÉRCIO (CLIENTE FINAL) ─────────────────────────────────────────────────

export type CommerceStatus = 'active' | 'canceled' | 'suspended'

export interface Commerce {
  id: string
  resellerId: string
  name: string
  ownerName: string
  email: string
  phone?: string
  address?: string
  status: CommerceStatus
  createdAt: string
  updatedAt: string
}

// ─── ESTOQUE ─────────────────────────────────────────────────────────────────

export type ProductUnit = 'un' | 'kg' | 'g' | 'l' | 'ml' | 'cx' | 'pct'

export interface Product {
  id: string
  commerceId: string
  name: string
  description?: string
  barcode?: string
  category?: string
  salePrice: number
  costPrice?: number
  unit: ProductUnit
  stock: number
  minStock?: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// ─── CAIXA / VENDAS ──────────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'debit' | 'credit' | 'pix' | 'other'

export interface SaleItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export type SaleStatus = 'open' | 'completed' | 'canceled'

export interface Sale {
  id: string
  commerceId: string
  items: SaleItem[]
  subtotal: number
  discount: number
  total: number
  paymentMethod: PaymentMethod
  status: SaleStatus
  notes?: string
  createdAt: string
  updatedAt: string
}

// ─── FINANCEIRO ───────────────────────────────────────────────────────────────

export type TransactionType = 'income' | 'expense'

export type FinancialCategory =
  | 'sale'
  | 'other_income'
  | 'cleaning'
  | 'maintenance'
  | 'rent'
  | 'salary'
  | 'supplies'
  | 'utilities'
  | 'other_expense'

export interface FinancialTransaction {
  id: string
  commerceId: string
  type: TransactionType
  category: FinancialCategory
  description: string
  amount: number
  date: string
  saleId?: string
  createdAt: string
}

// ─── DASHBOARD / RELATÓRIOS ───────────────────────────────────────────────────

export interface DashboardSummary {
  totalSalesToday: number
  totalRevenueToday: number
  totalSalesMonth: number
  totalRevenueMonth: number
  lowStockProducts: number
  totalProducts: number
}

export interface ResellerDashboard {
  totalClients: number
  activeClients: number
  canceledClients: number
  newClientsThisMonth: number
  availableLicenses: number
  usedLicenses: number
  monthlyValue: number
}
