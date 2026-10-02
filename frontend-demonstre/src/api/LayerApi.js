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

  updateStyle: (args) => {
    const layerId = args?.layerId || args?.layer_id || (args?.data && (args.data.layer_id || args.data.layerId))
    const payload = args?.data || args
    return axiosClient.post(`/layers/${layerId}/style`, payload)
  },

  getRasterInfo: (layerId) =>
    axiosClient.get(`/layers/${layerId}/raster-info`),

  classifyPreview: async (layerId, params = {}) => {
    try {
      const infoRes = await layerApi.getRasterInfo(layerId)
      const stats = infoRes?.data?.statistics || { min: 0, max: 100, mean: 50, std: 10 }
      const count = Number(params.n_classes) || 10
      const method = params.method || 'jenks'
      const colors = params.custom_colors || ['#00e5ff', '#0044ff', '#ff00ee']
      const { generateClassificationClasses } = await import('../utils/styleConstants')
      const classes = generateClassificationClasses({
        min: stats.min,
        max: stats.max,
        count,
        method,
        colors,
      })
      return {
        data: {
          data: {
            statistics: stats,
            classes,
          },
        },
      }
    } catch {
      return {
        data: {
          data: {
            statistics: { min: 0, max: 100, mean: 50, std: 10 },
            classes: [],
          },
        },
      }
    }
  },

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
