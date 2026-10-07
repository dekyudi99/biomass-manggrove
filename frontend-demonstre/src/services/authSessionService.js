import axios from 'axios'
import { getAuthApiBaseUrl } from '../utils/apiUrl'

const AUTH_API_BASE_URL = getAuthApiBaseUrl(import.meta.env.VITE_API_BASE_URL)
const csrfClient = axios.create({ baseURL: AUTH_API_BASE_URL, timeout: 20000, withCredentials: true })

let csrfToken = null
let pendingCsrfRequest = null
const AUTH_SESSION_INVALID_EVENT = 'grovia:auth-session-invalid'

export const clearAuthSession = () => {
  csrfToken = null
}

const getCsrfToken = async () => {
  if (csrfToken) return csrfToken
  if (!pendingCsrfRequest) {
    pendingCsrfRequest = csrfClient.get('/csrf')
      .then(({ data }) => {
        csrfToken = data.csrf_token
        return csrfToken
      })
      .finally(() => { pendingCsrfRequest = null })
  }
  return pendingCsrfRequest
}

export const attachCsrfProtection = (client) => {
  client.defaults.withCredentials = true
  client.interceptors.request.use(async (config) => {
    if (!['post', 'put', 'patch', 'delete'].includes((config.method || 'get').toLowerCase())) return config
    config.headers['X-CSRF-Token'] = await getCsrfToken()
    return config
  })

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const config = error.config
      const csrfRejected = error.response?.data?.detail?.code === 'AUTH_CSRF_INVALID'
      if (csrfRejected && config && !config._csrfRetry) {
        clearAuthSession()
        config._csrfRetry = true
        return client.request(config)
      }
      if (error.response?.status === 401) {
        clearAuthSession()
        if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_SESSION_INVALID_EVENT))
      }
      return Promise.reject(error)
    },
  )

  return client
}