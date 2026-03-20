import { create } from 'zustand'
import type { User } from '../types'

interface AuthStore {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoaded: boolean
  login: (user: User, token: string, remember: boolean) => void
  logout: () => void
  loadFromStorage: () => void
}

// Lê o storage de forma síncrona para o estado inicial
function readStorage(): { user: User | null; token: string | null } {
  try {
    const token = localStorage.getItem('cf_token') || sessionStorage.getItem('cf_token')
    const userRaw = localStorage.getItem('cf_user') || sessionStorage.getItem('cf_user')
    if (token && userRaw) {
      return { token, user: JSON.parse(userRaw) as User }
    }
  } catch {
    // storage corrompido — ignora
  }
  return { user: null, token: null }
}

const initial = readStorage()

export const useAuthStore = create<AuthStore>(() => ({
  user: initial.user,
  token: initial.token,
  isAuthenticated: !!initial.token,
  isLoaded: true,

  login: (user, token, remember) => {
    const storage = remember ? localStorage : sessionStorage
    storage.setItem('cf_token', token)
    storage.setItem('cf_user', JSON.stringify(user))
    if (remember) {
      sessionStorage.removeItem('cf_token')
      sessionStorage.removeItem('cf_user')
    } else {
      localStorage.removeItem('cf_token')
      localStorage.removeItem('cf_user')
    }
    useAuthStore.setState({ user, token, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('cf_token')
    localStorage.removeItem('cf_user')
    sessionStorage.removeItem('cf_token')
    sessionStorage.removeItem('cf_user')
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false })
  },

  loadFromStorage: () => {
    const { user, token } = readStorage()
    useAuthStore.setState({ user, token, isAuthenticated: !!token, isLoaded: true })
  },
}))


