import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth as useOidcAuth } from 'react-oidc-context'
import authApi from '../api/AuthApi'
import AuthContext from './AuthContext'
import { clearAuthSession } from '../services/authSessionService'
import { setOidcAccessToken, setOidcUserManager, getOidcAccessToken } from '../services/oidcTokenService'
import { terminateLocalSession } from '../services/sessionTerminationService'

const AuthProvider = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const oidcAuth = useOidcAuth()

  const [user, setUser] = useState(null)
  const [authType, setAuthType] = useState(null) // 'keycloak' | 'legacy' | null
  const [isLegacyLoading, setIsLegacyLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)

  const portalUrl = import.meta.env.VITE_PORTAL_URL
  const postLogoutRedirect =
    import.meta.env.VITE_KEYCLOAK_POST_LOGOUT_REDIRECT_URI || portalUrl

  // Simpan userManager OIDC ke service global untuk penanganan 401
  useEffect(() => {
    if (oidcAuth) {
      setOidcUserManager(oidcAuth)
    }
  }, [oidcAuth])

  // Daftarkan listener event OIDC: OP Signout (iframe), Silent Renew Error, dan Token Expired
  useEffect(() => {
    if (!oidcAuth?.events) return

    const handleSessionEnded = async () => {
      setUser(null)
      setAuthType(null)
      await terminateLocalSession('Sesi berakhir')
    }

    oidcAuth.events.addUserSignedOut(handleSessionEnded)
    oidcAuth.events.addSilentRenewError(handleSessionEnded)
    oidcAuth.events.addAccessTokenExpired(handleSessionEnded)

    return () => {
      oidcAuth.events.removeUserSignedOut(handleSessionEnded)
      oidcAuth.events.removeSilentRenewError(handleSessionEnded)
      oidcAuth.events.removeAccessTokenExpired(handleSessionEnded)
    }
  }, [oidcAuth?.events])

  // Pengecekan sesi saat tab kembali aktif (visibilitychange & focus) dengan throttle 15 detik
  useEffect(() => {
    let lastCheckTime = 0
    const CHECK_THROTTLE_MS = 15000 // Paling sering 15 detik sekali

    const handleVisibilityOrFocus = async () => {
      if (typeof document !== 'undefined' && document.visibilityState && document.visibilityState !== 'visible') {
        return
      }

      const now = Date.now()
      if (now - lastCheckTime < CHECK_THROTTLE_MS) {
        return
      }
      lastCheckTime = now

      // Hanya verifikasi jika sesi OIDC aktif
      if (oidcAuth.isAuthenticated || getOidcAccessToken()) {
        try {
          await oidcAuth.signinSilent()
        } catch {
          // Jika sesi di Keycloak sudah berakhir di tab lain
          setUser(null)
          setAuthType(null)
          await terminateLocalSession('Sesi berakhir')
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleVisibilityOrFocus)
      document.addEventListener('visibilitychange', handleVisibilityOrFocus)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleVisibilityOrFocus)
        document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      }
    }
  }, [oidcAuth])

  // Sinkronisasi status autentikasi Keycloak / Legacy
  useEffect(() => {
    let cancelled = false

    if (oidcAuth.isAuthenticated && oidcAuth.user?.access_token) {
      setOidcAccessToken(oidcAuth.user.access_token)
      authApi.me()
        .then(({ data }) => {
          if (!cancelled) {
            setUser(data)
            setAuthType('keycloak')
            setAccessDenied(false)
          }
        })
        .catch((err) => {
          if (!cancelled) {
            console.error('Failed to resolve Keycloak user from backend:', err)
            if (err.response?.status === 403) {
              setAccessDenied(true)
            }
            setUser(null)
            setAuthType(null)
            setOidcAccessToken(null)
          }
        })
        .finally(() => {
          if (!cancelled) setIsLegacyLoading(false)
        })
    } else if (!oidcAuth.isLoading) {
      setOidcAccessToken(null)
      const isLegacyEnabled = import.meta.env.VITE_LEGACY_LOGIN_ENABLED !== 'false'

      if (isLegacyEnabled) {
        authApi.me()
          .then(({ data }) => {
            if (!cancelled) {
              setUser(data)
              setAuthType('legacy')
              setAccessDenied(false)
            }
          })
          .catch(() => {
            if (!cancelled) {
              clearAuthSession()
              setUser(null)
              setAuthType(null)
            }
          })
          .finally(() => {
            if (!cancelled) setIsLegacyLoading(false)
          })
      } else {
        setUser(null)
        setAuthType(null)
        setIsLegacyLoading(false)
      }
    }

    return () => {
      cancelled = true
    }
  }, [oidcAuth.isAuthenticated, oidcAuth.isLoading, oidcAuth.user?.access_token])

  // Login lama (Email & Password)
  const login = useCallback(async (payload) => {
    const { data } = await authApi.login(payload)
    setUser(data.user)
    setAuthType('legacy')
    return data.user
  }, [])

  // Login dengan Keycloak SSO
  const signinRedirect = useCallback((args) => {
    setAccessDenied(false)
    return oidcAuth.signinRedirect(args)
  }, [oidcAuth])

  // Logout terpadu
  const logout = useCallback(async () => {
    try {
      if (authType === 'keycloak' || oidcAuth.isAuthenticated) {
        setOidcAccessToken(null)
        setUser(null)
        setAuthType(null)
        await oidcAuth.signoutRedirect({
          post_logout_redirect_uri: postLogoutRedirect,
        })
        return
      }
      await authApi.logout()
    } catch (e) {
      console.warn('Logout error:', e)
    } finally {
      clearAuthSession()
      setOidcAccessToken(null)
      setUser(null)
      setAuthType(null)
      window.location.href = postLogoutRedirect
    }
  }, [authType, oidcAuth, postLogoutRedirect])

  const isLoading = oidcAuth.isLoading || isLegacyLoading

  const value = useMemo(
    () => ({
      user,
      roles: user?.roles || [],
      isLoading,
      isAuthenticated: Boolean(user),
      authType,
      accessDenied,
      portalUrl,
      login,
      signinRedirect,
      logout,
      oidcAuth,
    }),
    [user, isLoading, authType, accessDenied, portalUrl, login, signinRedirect, logout, oidcAuth],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider