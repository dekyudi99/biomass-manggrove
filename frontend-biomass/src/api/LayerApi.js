import axiosClient from './AxiosClient'

const layerApi = {
  list: (params = {}) =>
    axiosClient.get('/layers', { params: { size: 100, ...params } }),

  create: (formData, onProgress) =>
    axiosClient.post('/publish', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percent)
        }
      },
    }),

  updateStyle: ({ layerId, data }) =>
    axiosClient.post(`/layers/${layerId}/style`, data),

  delete: (id) => axiosClient.delete(`/layers/${id}`),

  downloadUrl: (id, params = {}) => {
    const base = axiosClient.defaults.baseURL.replace(/\/+$/, '')
    const query = new URLSearchParams()
    if (params.format) query.append('format', params.format)
    if (params.styled !== undefined) query.append('styled', params.styled)
    if (params.width) query.append('width', params.width)
    if (params.height) query.append('height', params.height)
    return `${base}/layers/${id}/download?${query.toString()}`
  },

  download: (id, params = {}) =>
    axiosClient.get(`/layers/${id}/download`, {
      params,
      responseType: 'blob',
    }),
}

export default layerApi
