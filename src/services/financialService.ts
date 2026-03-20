import api from '../lib/api'
import type { FinancialTransaction } from '../types'

export interface FinancialSummary {
  income: number
  expense: number
  balance: number
}

export interface CreateTransactionPayload {
  type: 'income' | 'expense'
  category: string
  description: string
  amount: number
  date: string
}

export const financialService = {
  list: async (): Promise<{ transactions: FinancialTransaction[]; summary: FinancialSummary }> => {
    const { data } = await api.get('/commerce/financial')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transactions: FinancialTransaction[] = (data.transactions ?? []).map((t: any) => ({
      id: t.id,
      commerceId: t.commerce_id ?? t.commerceId,
      type: t.type,
      category: t.category,
      description: t.description,
      amount: Number(t.amount) || 0,
      date: t.date,
      createdAt: t.created_at ?? t.createdAt,
    }))
    return {
      transactions,
      summary: {
        income: Number(data.summary?.income) || 0,
        expense: Number(data.summary?.expense) || 0,
        balance: Number(data.summary?.balance) || 0,
      },
    }
  },

  create: async (payload: CreateTransactionPayload): Promise<FinancialTransaction> => {
    const { data } = await api.post<{ transaction: FinancialTransaction }>('/commerce/financial', payload)
    return data.transaction
  },
}
