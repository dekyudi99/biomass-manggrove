import { WebStorageStateStore } from 'oidc-client-ts'

const authority =
  import.meta.env.VITE_KEYCLOAK_AUTHORITY ||
  `${(import.meta.env.VITE_KEYCLOAK_URL || '').replace(/\/+$/, '')}/realms/${import.meta.env.VITE_KEYCLOAK_REALM || ''}`

export const oidcConfig = {
  authority,
  client_id: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
  redirect_uri: import.meta.env.VITE_KEYCLOAK_REDIRECT_URI,
  post_logout_redirect_uri:
    import.meta.env.VITE_KEYCLOAK_POST_LOGOUT_REDIRECT_URI ||
    import.meta.env.VITE_PORTAL_URL,
  response_type: 'code',
  scope: 'openid profile email',
  automaticSilentRenew: true,
  monitorSession: true,
  checkSessionIntervalInSeconds: 2,
  // Menggunakan default sessionStorage untuk menyimpan token per-sesi tab browser (menghindari localStorage insecure)
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  onSigninCallback: () => {
    // Bersihkan parameter code & state dari URL setelah proses callback selesai
    window.history.replaceState({}, document.title, window.location.pathname)
  },
}
