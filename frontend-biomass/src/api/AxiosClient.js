import axios from 'axios'

// Mengambil dan menormalkan Base URL dari environment variable
const getBaseURL = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/spatial'
  const trimmed = envUrl.trim().replace(/\/+$/, '')

  // Fleksibilitas: Jika user mengisi http://domain:8000 atau http://domain:8000/api
  if (trimmed.endsWith('/api/spatial')) return trimmed
  if (trimmed.endsWith('/api')) return `${trimmed}/spatial`
  if (!trimmed.includes('/api')) return `${trimmed}/api/spatial`
  return trimmed
}

const axiosClient = axios.create({
  baseURL: getBaseURL(),
  timeout: 60000,
})

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
)

export default axiosClient
