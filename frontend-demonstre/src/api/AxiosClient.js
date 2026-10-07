import axios from 'axios'
import { getSpatialApiBaseUrl } from '../utils/apiUrl'

const axiosClient = axios.create({
  baseURL: getSpatialApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
  timeout: 60000,
})

export default axiosClient
