import { terminateLocalSession } from './sessionTerminationService'

let _accessToken = null
let _userManager = null
let isRefreshing = false
let refreshPromise = null

export const setOidcAccessToken = (token) => {
  _accessToken = token || null
}

export const setOidcUserManager = (manager) => {
  _userManager = manager || null
}

export const getOidcUserManager = () => _userManager

export const getOidcAccessToken = () => {
  if (_accessToken) return _accessToken

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i)
        if (key && key.startsWith('oidc.user:')) {
          const raw = window.sessionStorage.getItem(key)
          if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed?.access_token) {
              _accessToken = parsed.access_token
              return _accessToken
            }
          }
        }
      }
    } catch {
      // Ignore parse error
    }
  }

  return null
}

export const applyOidcInterceptor = (axiosInstance) => {
  // Request Interceptor: sisipkan token OIDC Bearer
  axiosInstance.interceptors.request.use((config) => {
    const token = getOidcAccessToken()
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  // Response Interceptor: Tangani 401, coba silent renewal sekali, lalu terminateLocalSession jika gagal
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config

      if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
        originalRequest._retry = true
        const userManager = getOidcUserManager()

        if (userManager && getOidcAccessToken()) {
          try {
            if (!isRefreshing) {
              isRefreshing = true
              refreshPromise = userManager.signinSilent().then((newUser) => {
                if (newUser?.access_token) {
                  setOidcAccessToken(newUser.access_token)
                  return newUser.access_token
                }
                return null
              }).finally(() => {
                isRefreshing = false
                refreshPromise = null
              })
            }

            const newToken = await refreshPromise
            if (newToken) {
              originalRequest.headers = originalRequest.headers || {}
              originalRequest.headers.Authorization = `Bearer ${newToken}`
              return axiosInstance(originalRequest)
            }
          } catch {
            // Token renewal gagal (misal sesi Keycloak sudah tidak berlaku di OP)
          }
        }

        await terminateLocalSession('Sesi berakhir')
      } else if (error.response?.status === 401) {
        await terminateLocalSession('Sesi berakhir')
      }

      return Promise.reject(error)
    }
  )

  return axiosInstance
}
