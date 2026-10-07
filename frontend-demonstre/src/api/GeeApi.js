import axios from 'axios'
import { getGeeApiBaseUrl } from '../utils/apiUrl'

const geeClient = axios.create({
  baseURL: getGeeApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
  timeout: 180000, // 3 menit untuk proses komputasi citra satelit
})

const geeApi = {
  getIndices: () => geeClient.get('/indices').then((res) => res.data),
  analyzeArea: (payload) => geeClient.post('/analyze', payload).then((res) => res.data),
  saveToAstraGis: (payload) => geeClient.post('/save-to-astragis', payload).then((res) => res.data),

  // Dataset Extractor untuk Peneliti / ML Training
  getSatellites: () => geeClient.get('/satellites').then((res) => res.data),
  previewDataset: (payload) => geeClient.post('/dataset/preview', payload).then((res) => res.data),
  getDatasetDownloadUrl: (payload) => geeClient.post('/dataset/download-url', payload).then((res) => res.data),
  saveDatasetToAstraGis: (payload) => geeClient.post('/dataset/save-to-astragis', payload).then((res) => res.data),
}

export default geeApi
