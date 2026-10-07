import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import authApi from '../api/AuthApi'
import AuthContext from './AuthContext'
import { clearAuthSession } from '../services/authSessionService'

const AuthProvider = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const handleSessionInvalid = () => setUser(null)
    window.addEventListener('grovia:auth-session-invalid', handleSessionInvalid)
    let cancelled = false
    authApi.me()
      .then(({ data }) => {
        if (!cancelled) {
          setUser(data)
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearAuthSession()
          setUser(null)
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
      window.removeEventListener('grovia:auth-session-invalid', handleSessionInvalid)
    }
  }, [])

  const login = useCallback(async (payload) => {
    const { data } = await authApi.login(payload)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      clearAuthSession()
      setUser(null)
      navigate('/login', { replace: true, state: { from: location.pathname } })
    }
  }, [location.pathname, navigate])

  const value = useMemo(
    () => ({ user, isLoading, isAuthenticated: Boolean(user), login, logout }),
    [user, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider