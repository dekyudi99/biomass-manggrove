import { Button, Result, Spin } from 'antd'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

const ProtectedRoute = () => {
  const { isAuthenticated, isLoading, accessDenied, portalUrl, logout } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spin size="large" />
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-50 dark:bg-slate-900 p-6">
        <Result
          status="403"
          title={<span className="text-2xl font-bold text-slate-800 dark:text-slate-100">403 - Akses Ditolak</span>}
          subTitle={
            <div className="max-w-md mx-auto space-y-2 text-slate-600 dark:text-slate-400">
              <p className="font-semibold text-base text-red-600 dark:text-red-400">
                Anda belum memiliki akses ke aplikasi ini
              </p>
              <p className="text-sm">
                Akun SSO Anda belum memiliki role yang diizinkan untuk mengakses Grovia (Biomass Mangrove).
                Silakan hubungi administrator atau kembali ke Portal SSO.
              </p>
            </div>
          }
          extra={[
            <Button
              type="primary"
              key="portal"
              size="large"
              className="bg-emerald-600 hover:bg-emerald-700 font-semibold"
              onClick={() => {
                window.location.href = portalUrl || 'http://localhost:5170'
              }}
            >
              Kembali ke Portal SSO
            </Button>,
            <Button
              key="logout"
              size="large"
              onClick={() => logout()}
            >
              Sign out
            </Button>,
          ]}
        />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }

  return <Outlet />
}

export default ProtectedRoute