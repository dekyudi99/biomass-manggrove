import axios from 'axios'
import { attachCsrfProtection } from '../services/authSessionService'
import { getAuthApiBaseUrl } from '../utils/apiUrl'

const authClient = attachCsrfProtection(axios.create({
  baseURL: getAuthApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
  timeout: 20000,
}))

const authApi = {
  register: (payload) => authClient.post('/register', payload),
  verifyEmail: (payload) => authClient.post('/verify-email', payload),
  resendVerification: (payload) => authClient.post('/resend-verification', payload),
  login: (payload) => authClient.post('/login', payload),
  me: () => authClient.get('/me'),
  requestPasswordResetOtp: (payload) => authClient.post('/forgot-password/request-otp', payload),
  resetPassword: (payload) => authClient.post('/forgot-password/reset', payload),
  changePassword: (payload) => authClient.post('/change-password', payload),
  logout: () => authClient.post('/logout'),
}

export default authApi