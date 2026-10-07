const DEFAULT_NOMINATIM_URL = 'https://nominatim.openstreetmap.org'

export const reverseGeocode = async (latitude, longitude, language = 'id') => {
  const configuredBaseUrl = import.meta.env.VITE_NOMINATIM_URL || DEFAULT_NOMINATIM_URL
  const baseUrl = configuredBaseUrl.replace(/\/+$/, '')
  const response = await fetch(
    `${baseUrl}/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
    {
      headers: {
        'Accept-Language': language,
      },
    },
  )

  return response.json()
}