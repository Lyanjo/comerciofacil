import api from '../lib/api'
import type { Sale, SaleItem } from '../types'

export interface CreateSalePayload {
  items: Array<{ product_id: string; quantity: number; unit_price: number }>
  payment_method: string
  discount?: number
  notes?: string
}

export interface SaleWithItems extends Sale {
  items: SaleItem[]
}

export const saleService = {
  create: async (payload: CreateSalePayload): Promise<{ saleId: string; total: number }> => {
    const { data } = await api.post('/commerce/sales', payload)
    return data
  },

  list: async (): Promise<SaleWithItems[]> => {
    const { data } = await api.get<{ sales: any[] }>('/commerce/sales') // eslint-disable-line @typescript-eslint/no-explicit-any
    return (data.sales ?? []).map((s) => ({
      id: s.id,
      commerceId: s.commerce_id ?? s.commerceId,
      subtotal: Number(s.subtotal) || 0,
      discount: Number(s.discount) || 0,
      total: Number(s.total) || 0,
      paymentMethod: s.payment_method ?? s.paymentMethod,
      status: s.status,
      notes: s.notes,
      createdAt: s.created_at ?? s.createdAt,
      updatedAt: s.updated_at ?? s.updatedAt,
      items: (s.items ?? []).map((i: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        productId: i.product_id ?? i.productId,
        productName: i.product_name ?? i.productName,
        quantity: Number(i.quantity) || 0,
        unitPrice: Number(i.unit_price ?? i.unitPrice) || 0,
        totalPrice: Number(i.total_price ?? i.totalPrice) || 0,
      })),
    }))
  },

  cancel: async (saleId: string): Promise<void> => {
    await api.delete(`/commerce/sales/${saleId}`)
  },
}
