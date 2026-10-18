import axios from 'axios'
import { getSpatialApiBaseUrl, getAuthApiBaseUrl } from '../utils/apiUrl'
import { attachCsrfProtection } from '../services/authSessionService'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
const axiosClient = axios.create({
  baseURL: getSpatialApiBaseUrl(apiBaseUrl),
  timeout: 60000,
  withCredentials: true,
})

attachCsrfProtection(axiosClient, { csrfBaseUrl: getAuthApiBaseUrl(apiBaseUrl) })

export default axiosClient

