import api from '../lib/api'

export interface RevenueByReseller {
  id: string
  name: string
  activeClients: number
  monthlyFee: number
  estimated: number
}

export interface AdminStats {
  totalResellers: number
  activeResellers: number
  totalCommerces: number
  activeCommerces: number
  estimatedMonthly: number
  revenueByReseller: RevenueByReseller[]
}

export interface Reseller {
  id: string
  name: string
  email: string
  total_licenses: number
  used_licenses: number
  monthly_fee: number
  active: boolean
  created_at: string
}

export interface CreateResellerPayload {
  name: string
  email: string
  password: string
  total_licenses: number
}

export const adminService = {
  getStats: async (): Promise<AdminStats> => {
    const { data } = await api.get('/admin/stats')
    return data
  },

  listResellers: async (): Promise<Reseller[]> => {
    const { data } = await api.get<{ resellers: any[] }>('/admin/resellers')
    return data.resellers.map((r) => ({
      ...r,
      monthly_fee: r.monthly_fee ?? 0,
      used_licenses: r.active_clients ?? 0,
      active: r.is_active === 1 || r.is_active === true,
    }))
  },

  createReseller: async (payload: CreateResellerPayload): Promise<Reseller> => {
    const { data } = await api.post<{ reseller: Reseller }>('/admin/resellers', payload)
    return data.reseller
  },

  updateLicenses: async (resellerId: string, total_licenses: number): Promise<void> => {
    await api.patch(`/admin/resellers/${resellerId}/licenses`, { total_licenses })
  },

  toggleResellerStatus: async (resellerId: string, active: boolean): Promise<void> => {
    await api.patch(`/admin/resellers/${resellerId}/status`, { is_active: active })
  },

  updateMonthlyFee: async (resellerId: string, monthly_fee: number): Promise<void> => {
    await api.patch(`/admin/resellers/${resellerId}/fee`, { monthly_fee })
  },
}
