import api from '../lib/api'
import type { User } from '../types'

export interface LoginResponse {
  token: string
  user: User & { resellerId?: string; commerceId?: string }
}

export const authService = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const { data } = await api.post<LoginResponse>('/auth/login', { email, password })
    return data
  },

  me: async (): Promise<User> => {
    const { data } = await api.get<{ user: User }>('/auth/me')
    return data.user
  },
}
