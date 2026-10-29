/**
 * Utilitas validasi URL returnTo untuk mencegah serangan Open Redirect.
 * Aturan:
 * 1. Harus string dan dimulai dengan satu '/'
 * 2. Tidak boleh diawali '//' (protokol relatif)
 * 3. Tidak boleh memuat skema/protokol (http:, https:, javascript:, data:)
 * 4. Tidak boleh mengarah kembali ke '/sso/start' (mencegah loop)
 * 
 * @param {string|null|undefined} returnTo
 * @param {string} defaultPath
 * @returns {string} path relatif yang aman
 */
export const validateReturnTo = (returnTo, defaultPath = '/dashboard') => {
  if (!returnTo || typeof returnTo !== 'string') {
    return defaultPath
  }

  const trimmed = returnTo.trim()

  // Harus diawali satu '/' dan tidak boleh '//'
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return defaultPath
  }

  // Tidak boleh ada skema/host (misal: 'javascript:', 'https:', dsb)
  if (trimmed.includes(':')) {
    return defaultPath
  }

  // Tidak boleh mengarah ke rute /sso/start untuk mencegah infinite loop
  if (trimmed.startsWith('/sso/start')) {
    return defaultPath
  }

  return trimmed
}

export default validateReturnTo
