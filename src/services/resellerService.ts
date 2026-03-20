import api from '../lib/api'

export interface ClientRevenue {
  id: string
  name: string
  active: boolean
  price: number | null
  estimated: number
}

export interface ResellerDashboard {
  totalClients: number
  activeClients: number
  canceledClients: number
  newClientsThisMonth: number
  totalLicenses: number
  usedLicenses: number
  availableLicenses: number
  monthlyFee: number
  monthlyBill: number
  resellerPrice: number | null
  priceHidden: boolean
  estimatedReceivable: number
  clientsRevenue: ClientRevenue[]
}

export interface ResellerSettings {
  resellerPrice: number | null
  priceHidden: boolean
  monthlyFee: number
}

export interface Client {
  id: string
  name: string
  owner_name: string
  email: string
  phone: string
  address?: string
  status: string
  active: boolean
  created_at: string
  client_price: number | null
}

export interface CreateClientPayload {
  name: string
  owner_name: string
  email: string
  password: string
  phone: string
  address?: string
  client_price?: number | null
}

export const resellerService = {
  getDashboard: async (): Promise<ResellerDashboard> => {
    const { data } = await api.get('/reseller/dashboard')
    return data
  },

  listClients: async (): Promise<Client[]> => {
    const { data } = await api.get<{ clients: any[] }>('/reseller/clients')
    return data.clients.map((c) => ({
      ...c,
      owner_name: c.owner_name ?? '',
      active: c.status === 'active',
    }))
  },

  createClient: async (payload: CreateClientPayload): Promise<Client> => {
    const { data } = await api.post<{ client: Client }>('/reseller/clients', payload)
    return data.client
  },

  toggleClientStatus: async (clientId: string, active: boolean): Promise<void> => {
    await api.patch(`/reseller/clients/${clientId}/status`, { status: active ? 'active' : 'canceled' })
  },

  updateClientPrice: async (clientId: string, price: number | null): Promise<void> => {
    await api.patch(`/reseller/clients/${clientId}/price`, { client_price: price })
  },

  getSettings: async (): Promise<ResellerSettings> => {
    const { data } = await api.get('/reseller/settings')
    return data
  },

  saveSettings: async (payload: { reseller_price: number | null; price_hidden: boolean }): Promise<void> => {
    await api.patch('/reseller/settings', payload)
  },
}
