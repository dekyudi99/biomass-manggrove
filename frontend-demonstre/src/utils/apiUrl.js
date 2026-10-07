const DEFAULT_API_BASE_URL = 'http://localhost:8000/api/spatial'

const normalizeApiBaseUrl = (configuredUrl) => {
  const apiUrl = configuredUrl || DEFAULT_API_BASE_URL
  const trimmed = apiUrl.trim().replace(/\/+$/, '')

  if (trimmed.endsWith('/api/spatial')) return trimmed
  if (trimmed.endsWith('/api')) return `${trimmed}/spatial`
  if (!trimmed.includes('/api')) return `${trimmed}/api/spatial`
  return trimmed
}

export const getSpatialApiBaseUrl = (configuredUrl) => normalizeApiBaseUrl(configuredUrl)

export const getGeeApiBaseUrl = (configuredUrl) => {
  const spatialBaseUrl = normalizeApiBaseUrl(configuredUrl)
  return spatialBaseUrl.replace(/\/spatial$/, '/gee')
}

export const getAuthApiBaseUrl = (configuredUrl) => {
  const spatialBaseUrl = normalizeApiBaseUrl(configuredUrl)
  return spatialBaseUrl.replace(/\/spatial$/, '/auth')
}