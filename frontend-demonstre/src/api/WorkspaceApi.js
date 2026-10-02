import axiosClient from './AxiosClient'

const workspaceApi = {
  getAll: () => axiosClient.get('/workspaces'),
  create: (data) => axiosClient.post('/workspaces', data),
  update: ({ id, data }) => axiosClient.put(`/workspaces/${id}`, data),
  delete: (id) => axiosClient.delete(`/workspaces/${id}`),
}

export default workspaceApi
