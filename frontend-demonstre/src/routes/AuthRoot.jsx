import { Outlet } from 'react-router-dom'
import { AuthProvider as OidcAuthProvider } from 'react-oidc-context'
import { oidcConfig } from '../config/oidc'
import AuthProvider from '../context/AuthProvider'

const AuthRoot = () => (
  <OidcAuthProvider {...oidcConfig}>
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  </OidcAuthProvider>
)

export default AuthRoot