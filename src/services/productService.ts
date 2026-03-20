import api from '../lib/api'
import type { Product } from '../types'

// O SQLite retorna snake_case e campos numéricos como string — normalizamos aqui
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalize = (p: any): Product => ({
  id: p.id,
  commerceId: p.commerceId ?? p.commerce_id,
  name: p.name,
  description: p.description ?? undefined,
  barcode: p.barcode ?? undefined,
  category: p.category ?? undefined,
  salePrice: Number(p.salePrice ?? p.sale_price) || 0,
  costPrice: (p.costPrice ?? p.cost_price) != null ? Number(p.costPrice ?? p.cost_price) : undefined,
  unit: p.unit,
  stock: Number(p.stock) || 0,
  minStock: (p.minStock ?? p.min_stock) != null ? Number(p.minStock ?? p.min_stock) : undefined,
  isActive: Boolean(p.isActive ?? p.is_active),
  createdAt: p.createdAt ?? p.created_at,
  updatedAt: p.updatedAt ?? p.updated_at,
})

// Converte o payload camelCase do frontend para snake_case esperado pelo backend
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toSnake = (p: any) => ({
  name: p.name,
  description: p.description,
  barcode: p.barcode,
  category: p.category,
  sale_price: p.salePrice,
  cost_price: p.costPrice,
  unit: p.unit,
  stock: p.stock,
  min_stock: p.minStock,
  is_active: p.isActive,
})

export const productService = {
  list: async (): Promise<Product[]> => {
    const { data } = await api.get<{ products: Product[] }>('/commerce/products')
    return (data.products ?? []).map(normalize)
  },

  create: async (payload: Partial<Product>): Promise<Product> => {
    const { data } = await api.post<{ product: Product }>('/commerce/products', toSnake(payload))
    return normalize(data.product)
  },

  update: async (id: string, payload: Partial<Product>): Promise<Product> => {
    const { data } = await api.put<{ product: Product }>(`/commerce/products/${id}`, toSnake(payload))
    return normalize(data.product)
  },

  deactivate: async (id: string): Promise<void> => {
    await api.delete(`/commerce/products/${id}`)
  },
}
