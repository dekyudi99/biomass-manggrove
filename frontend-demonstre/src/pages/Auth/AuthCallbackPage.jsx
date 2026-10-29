import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spin, Alert, Button } from 'antd'
import { useAuth as useOidcAuth } from 'react-oidc-context'
import useAuth from '../../hooks/useAuth'
import { validateReturnTo } from '../../utils/ssoSecurity'

const AuthCallbackPage = () => {
  const oidcAuth = useOidcAuth()
  const { isAuthenticated, isLoading, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      // Ambil returnTo dari state OIDC user atau fallback sessionStorage
      const rawReturnTo = oidcAuth.user?.state?.returnTo || (typeof window !== 'undefined' ? sessionStorage.getItem('SSO_RETURN_TO') : null)
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('SSO_RETURN_TO')
      }

      const targetPath = validateReturnTo(rawReturnTo, '/dashboard')
      navigate(targetPath, { replace: true })
    }
  }, [isLoading, isAuthenticated, user, oidcAuth.user?.state?.returnTo, navigate])

  if (oidcAuth.error) {
    return (
      <div className="grid min-h-dvh place-items-center p-4 bg-slate-50 dark:bg-slate-900">
        <div className="max-w-md w-full p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-xl space-y-4 text-center">
          <Alert
            type="error"
            showIcon
            message="SSO Login Failed"
            description={oidcAuth.error.message || 'An error occurred while verifying token from Keycloak.'}
            className="text-left"
          />
          <Button
            type="primary"
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            onClick={() => navigate('/login', { replace: true })}
          >
            Back to Login Page
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50 dark:bg-slate-900">
      <div className="text-center space-y-3">
        <Spin size="large" />
        <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
          Verifying Keycloak SSO session...
        </p>
      </div>
    </div>
  )
}

export default AuthCallbackPage
