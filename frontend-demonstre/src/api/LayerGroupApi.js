import axiosClient from './AxiosClient'

const layerGroupApi = {
  list: (params = {}) => axiosClient.get('/layer-groups', { params }),
  create: (data) => axiosClient.post('/layer-groups', data),
  update: ({ id, data }) => axiosClient.put(`/layer-groups/${id}`, data),
  delete: (id) => axiosClient.delete(`/layer-groups/${id}`),
}

export default layerGroupApi
