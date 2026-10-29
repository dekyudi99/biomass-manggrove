import axios from 'axios'
import { getSpatialApiBaseUrl, getAuthApiBaseUrl } from '../utils/apiUrl'
import { attachCsrfProtection } from '../services/authSessionService'
import { applyOidcInterceptor } from '../services/oidcTokenService'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
const axiosClient = axios.create({
  baseURL: getSpatialApiBaseUrl(apiBaseUrl),
  timeout: 60000,
  withCredentials: true,
})

attachCsrfProtection(axiosClient, { csrfBaseUrl: getAuthApiBaseUrl(apiBaseUrl) })
applyOidcInterceptor(axiosClient)

export default axiosClient


