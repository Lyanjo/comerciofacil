import axios from 'axios'

const isDev = import.meta.env.DEV

// Garante que a URL base sempre termine com /api
function buildBaseUrl(): string {
  if (isDev) return 'http://localhost:3333/api'
  const raw = (import.meta.env.VITE_API_URL as string) || 'https://seu-backend.railway.app/api'
  // Remove barra final e adiciona /api se não tiver
  const clean = raw.replace(/\/+$/, '')
  return clean.endsWith('/api') ? clean : `${clean}/api`
}

const api = axios.create({
  baseURL: buildBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor: adiciona token em todas as requisições
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cf_token') || sessionStorage.getItem('cf_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor: trata erros globais
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('cf_token')
      localStorage.removeItem('cf_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
