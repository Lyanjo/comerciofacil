import axios from 'axios'

const isDev = import.meta.env.DEV

const BASE_URL = isDev
  ? 'http://localhost:3333/api'
  : (import.meta.env.VITE_API_URL as string) || 'https://seu-backend.railway.app/api'

const api = axios.create({
  baseURL: BASE_URL,
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
