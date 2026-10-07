import { Outlet } from 'react-router-dom'
import AuthProvider from '../context/AuthProvider'

const AuthRoot = () => (
  <AuthProvider>
    <Outlet />
  </AuthProvider>
)

export default AuthRoot