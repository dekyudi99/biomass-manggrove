import React, { useState, useEffect } from 'react'
import { Modal, Tabs, Select, Input, Button, message, Tooltip, Tag } from 'antd'
import {
  DownloadOutlined,
  CloudUploadOutlined,
  FileTextOutlined,
  TableOutlined,
  PictureOutlined,
  ExperimentOutlined,
  GlobalOutlined,
} from '@ant-design/icons'
import { useLanguage } from '../context/LanguageContext'
import {
  exportAoiToGeoJson,
  exportAoiToCsv,
  triggerBrowserDownload,
} from '../utils/aoiParser'
import workspaceApi from '../api/WorkspaceApi'
import geeApi from '../api/GeeApi'

const AoiExportModal = ({
  isOpen,
  onClose,
  areaPoints = [],
  areaHectares = 0,
  onOpenGeeAnalysis,
  onOpenDatasetExtractor,
}) => {
  const { t } = useLanguage()

  const [activeTab, setActiveTab] = useState('geojson')
  const [fileName, setFileName] = useState('Mangrove_AOI')
  const [fileDesc, setFileDesc] = useState('')

  // State AstraGIS Save
  const [workspaces, setWorkspaces] = useState([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null)
  const [isSavingAstraGis, setIsSavingAstraGis] = useState(false)

  useEffect(() => {
    if (isOpen) {
      const nowStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      setFileName(`Mangrove_AOI_${nowStr}`)
      loadWorkspaces()
    }
  }, [isOpen])

  const loadWorkspaces = async () => {
    try {
      const res = await workspaceApi.getAll()
      const list = res.data?.data || res.data || []
      setWorkspaces(list)
      if (list.length > 0 && !selectedWorkspaceId) {
        setSelectedWorkspaceId(list[0].id)
      }
    } catch (err) {
      console.warn('Gagal memuat workspace AstraGIS:', err)
    }
  }

  // 1. Download GeoJSON
  const handleDownloadGeoJson = () => {
    if (!areaPoints || areaPoints.length < 3) {
      message.error('Area poligon tidak valid.')
      return
    }
    const cleanName = fileName.trim() || 'Mangrove_AOI'
    const geojsonStr = exportAoiToGeoJson(areaPoints, areaHectares, cleanName)
    triggerBrowserDownload(geojsonStr, `${cleanName}.geojson`, 'application/geo+json')
    message.success('Berkas GeoJSON berhasil diunduh!')
  }

  // 2. Download CSV
  const handleDownloadCsv = () => {
    if (!areaPoints || areaPoints.length < 3) {
      message.error('Area poligon tidak valid.')
      return
    }
    const cleanName = fileName.trim() || 'Mangrove_AOI'
    const csvStr = exportAoiToCsv(areaPoints, areaHectares, cleanName)
    triggerBrowserDownload(csvStr, `${cleanName}.csv`, 'text/csv')
    message.success('Berkas CSV koordinat berhasil diunduh!')
  }

  // 3. Simpan GeoTIFF Sentinel-2 ke AstraGIS Workspace
  const handleSaveToAstraGis = async () => {
    if (!selectedWorkspaceId) {
      message.warning(t('selectTargetWorkspace'))
      return
    }
    if (!fileName.trim()) {
      message.warning('Nama layer tidak boleh kosong.')
      return
    }

    setIsSavingAstraGis(true)
    try {
      const payload = {
        coordinates: areaPoints,
        analysis_type: 'ndvi',
        workspace_id: selectedWorkspaceId,
        layer_name: fileName.trim(),
        description: fileDesc.trim() || `AOI Mangrove Polygon (${areaHectares.toFixed(2)} Ha)`,
      }
      await geeApi.saveToAstraGis(payload)
      message.success(t('aoiSavedToAstraGisSuccess'))
      onClose()
    } catch (err) {
      message.error(err.response?.data?.detail || 'Gagal menyimpan layer ke AstraGIS.')
    } finally {
      setIsSavingAstraGis(false)
    }
  }

  const items = [
    {
      key: 'geojson',
      label: (
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <FileTextOutlined className="text-emerald-600" />
          {t('tabGeoJson')}
        </span>
      ),
      children: (
        <div className="flex flex-col gap-3 py-1">
          <p className="text-xs text-gray-600 leading-relaxed">
            {t('geoJsonDesc')}
          </p>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Format:</span>
              <Tag color="green">GeoJSON Feature (Polygon)</Tag>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>CRS:</span>
              <span className="font-mono text-gray-700">EPSG:4326 (WGS84)</span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Total Luas:</span>
              <span className="font-bold text-emerald-700">{areaHectares.toFixed(2)} Ha</span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Jumlah Titik:</span>
              <span className="font-mono text-gray-700">{areaPoints.length} Vertices</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadGeoJson}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95"
          >
            <DownloadOutlined />
            <span>{t('btnDownloadGeoJson')}</span>
          </button>
        </div>
      ),
    },
    {
      key: 'csv',
      label: (
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <TableOutlined className="text-blue-600" />
          {t('tabCsv')}
        </span>
      ),
      children: (
        <div className="flex flex-col gap-3 py-1">
          <p className="text-xs text-gray-600 leading-relaxed">
            {t('csvDesc')}
          </p>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 max-h-36 overflow-y-auto">
            <table className="w-full text-[11px] font-mono text-gray-600">
              <thead>
                <tr className="border-b border-gray-200 text-left font-bold text-gray-800">
                  <th className="pb-1">#</th>
                  <th className="pb-1">Latitude</th>
                  <th className="pb-1">Longitude</th>
                </tr>
              </thead>
              <tbody>
                {areaPoints.map((pt, idx) => (
                  <tr key={idx} className="border-b border-gray-100 last:border-0">
                    <td className="py-0.5 text-blue-600">{idx + 1}</td>
                    <td className="py-0.5">{pt[0].toFixed(6)}</td>
                    <td className="py-0.5">{pt[1].toFixed(6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={handleDownloadCsv}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95"
          >
            <DownloadOutlined />
            <span>{t('btnDownloadCsv')}</span>
          </button>
        </div>
      ),
    },
    {
      key: 'geotiff',
      label: (
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <PictureOutlined className="text-purple-600" />
          {t('tabGeoTiff')}
        </span>
      ),
      children: (
        <div className="flex flex-col gap-3 py-1">
          <p className="text-xs text-gray-600 leading-relaxed">
            {t('geoTiffDesc')}
          </p>

          <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl p-3 flex flex-col gap-2.5 text-xs text-purple-950">
            <span className="font-bold flex items-center gap-1.5 text-purple-900">
              <span>🛰️</span> Pilihan Ekstraksi Citra Satelit GEE:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose()
                  if (onOpenDatasetExtractor) onOpenDatasetExtractor()
                }}
                className="p-2.5 rounded-xl bg-white hover:bg-purple-100/50 border border-purple-300 text-purple-900 text-left font-bold transition cursor-pointer flex flex-col gap-0.5 shadow-xs"
              >
                <span className="text-xs flex items-center gap-1">
                  <span>🔬</span> {t('datasetExtractorTitle')}
                </span>
                <span className="text-[10px] font-normal text-purple-700">
                  Pilih Satelit (S2, Landsat, S1 SAR) & Band sesuka Anda
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose()
                  if (onOpenGeeAnalysis) onOpenGeeAnalysis()
                }}
                className="p-2.5 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-900 text-left font-bold transition cursor-pointer flex flex-col gap-0.5 shadow-xs"
              >
                <span className="text-xs flex items-center gap-1">
                  <span>🌿</span> {t('geeAnalysisTitle')}
                </span>
                <span className="text-[10px] font-normal text-emerald-700">
                  Hitung Indeks Vegetasi / Air (NDVI, EVI, CMRI)
                </span>
              </button>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'astragis',
      label: (
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <CloudUploadOutlined className="text-amber-600" />
          <span>AstraGIS</span>
        </span>
      ),
      children: (
        <div className="flex flex-col gap-3 py-1">
          <p className="text-xs text-gray-600 leading-relaxed">
            Simpan raster GeoTIFF citra satelit pada area ini langsung ke dalam workspace AstraGIS GeoServer Anda.
          </p>

          <div className="flex flex-col gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                {t('selectTargetWorkspace')} *
              </label>
              <Select
                placeholder={t('selectTargetWorkspace')}
                value={selectedWorkspaceId}
                onChange={setSelectedWorkspaceId}
                className="w-full text-xs"
                options={workspaces.map((w) => ({
                  value: w.id,
                  label: `${w.title || w.name} (${w.name})`,
                }))}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                {t('aoiNameLabel')} *
              </label>
              <Input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="Nama Layer GeoTIFF"
                className="text-xs rounded-lg"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                {t('aoiDescriptionLabel')}
              </label>
              <Input.TextArea
                rows={2}
                value={fileDesc}
                onChange={(e) => setFileDesc(e.target.value)}
                placeholder="Deskripsi ringkas layer..."
                className="text-xs rounded-lg"
              />
            </div>
          </div>

          <Button
            type="primary"
            onClick={handleSaveToAstraGis}
            loading={isSavingAstraGis}
            className="w-full py-2.5 h-auto rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
          >
            <CloudUploadOutlined />
            <span>{t('saveAoiToAstraGis')}</span>
          </Button>
        </div>
      ),
    },
  ]

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={560}
      centered
      closable={false}
      title={
        <div className="flex items-center justify-between pb-2 border-b border-gray-100 pr-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-base shrink-0 border border-emerald-200/60">
              💾
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-bold text-gray-800 leading-tight truncate">
                {t('exportModalTitle')}
              </h3>
              <p className="text-[10px] sm:text-[11px] text-gray-500 font-normal leading-snug truncate">
                {areaHectares.toFixed(2)} Ha • {areaPoints.length} Titik Koordinat
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50 flex items-center justify-center font-bold text-xs transition cursor-pointer border border-gray-200"
          >
            ✕
          </button>
        </div>
      }
    >
      <div className="mt-2 flex flex-col gap-3">
        {/* Input Nama File Global */}
        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1">
            {t('aoiNameLabel')}
          </label>
          <Input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            className="text-xs rounded-lg font-medium"
            placeholder="Mangrove_AOI"
          />
        </div>

        {/* Tabs Pilihan Format Ekspor */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={items}
          className="custom-export-tabs"
        />
      </div>
    </Modal>
  )
}

export default AoiExportModal
