import axios from 'axios'
import { attachCsrfProtection } from '../services/authSessionService'
import { getAuthApiBaseUrl, getGeeApiBaseUrl } from '../utils/apiUrl'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
const analysisBaseUrl = `${getGeeApiBaseUrl(apiBaseUrl).replace(/\/gee$/, '')}/analysis`
const geeClient = attachCsrfProtection(axios.create({
  baseURL: getGeeApiBaseUrl(apiBaseUrl),
  timeout: 180000, // 3 menit untuk proses komputasi citra satelit
}), { csrfBaseUrl: getAuthApiBaseUrl(apiBaseUrl) })

const analysisClient = attachCsrfProtection(axios.create({
  baseURL: analysisBaseUrl,
  timeout: 20000,
}), { csrfBaseUrl: getAuthApiBaseUrl(apiBaseUrl) })

const geeApi = {
  getIndices: () => geeClient.get('/indices').then((res) => res.data),
  analyzeArea: (payload) => geeClient.post('/analyze', payload).then((res) => res.data),
  saveToAstraGis: (payload) => geeClient.post('/save-to-astragis', payload).then((res) => res.data),
  createAnalysisJob: (payload) => analysisClient.post('', payload).then((res) => res.data),
  getAnalysisJob: (jobId) => analysisClient.get(`/${jobId}`).then((res) => res.data),
  getAnalysisDownloadUrl: (jobId) => `${analysisBaseUrl}/${jobId}/download`,
  registerAnalysisLayer: (jobId, layer) => analysisClient.post(`/${jobId}/layer`, { layer }).then((res) => res.data),
  listAnalysisJobs: () => analysisClient.get('').then((res) => res.data),
  cancelAnalysisJob: (jobId) => analysisClient.delete(`/${jobId}`).then((res) => res.data),
  listAnalysisNotifications: () => analysisClient.get('/notifications').then((res) => res.data),
  getModelStatus: () => analysisClient.get('/model').then((res) => res.data),

  // Dataset Extractor untuk Peneliti / ML Training
  getSatellites: () => geeClient.get('/satellites').then((res) => res.data),
  previewDataset: (payload) => geeClient.post('/dataset/preview', payload).then((res) => res.data),
  getDatasetDownloadUrl: (payload) => geeClient.post('/dataset/download-url', payload).then((res) => res.data),
  saveDatasetToAstraGis: (payload) => geeClient.post('/dataset/save-to-astragis', payload).then((res) => res.data),
}

export default geeApi
